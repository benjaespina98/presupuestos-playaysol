import fs from "node:fs";
import path from "node:path";

/**
 * Una "planilla de Google" falsa y el script real (docs/sheets-sync/Sincronizar.gs) cargado tal cual: sirve
 * para probar qué escribe el script sin Google. La usan lib/sheets/script.test.ts y tests/local/sync.spec.ts.
 */

export const FUENTE = fs.readFileSync(path.join(process.cwd(), "docs", "sheets-sync", "Sincronizar.gs"), "utf8");

// ── Una hoja falsa con la API mínima que usa el script ───────────────────────────
export type Hoja = ReturnType<typeof crearHoja>;
export function crearHoja(inicial: Record<string, unknown> = {}) {
  const valores = new Map<string, unknown>();
  const formulas = new Map<string, string>();
  const formatos = new Map<string, string>();
  let escrituras = 0;
  const clave = (f: number, c: number) => `${f},${c}`;
  for (const [k, v] of Object.entries(inicial)) {
    if (typeof v === "string" && v.startsWith("=")) formulas.set(k, v);
    else valores.set(k, v);
  }
  const desplazar = (desde: number) => {
    for (const mapa of [valores, formulas, formatos] as Map<string, never>[]) {
      const copia = [...mapa.entries()];
      mapa.clear();
      for (const [k, v] of copia) {
        const [fila, col] = k.split(",").map(Number);
        mapa.set(clave(fila >= desde ? fila + 1 : fila, col), v);
      }
    }
  };
  const rango = (f: number, c: number, nf = 1, nc = 1) => ({
    getValues: () => Array.from({ length: nf }, (_, i) => Array.from({ length: nc }, (_, j) => valores.get(clave(f + i, c + j)) ?? "")),
    getFormulas: () => Array.from({ length: nf }, (_, i) => Array.from({ length: nc }, (_, j) => formulas.get(clave(f + i, c + j)) ?? "")),
    // Como Sheets: un texto con "=" adelante pasa a ser una FÓRMULA, salvo que lleve el apóstrofe de
    // "forzar texto", que se guarda sin el apóstrofe.
    setValues: (m: unknown[][]) => m.forEach((fila, i) => fila.forEach((v, j) => {
      const k = clave(f + i, c + j);
      if (typeof v === "string" && v.startsWith("'")) { valores.set(k, v.slice(1)); formulas.delete(k); }
      else if (typeof v === "string" && v.startsWith("=")) { formulas.set(k, v); valores.delete(k); }
      else { valores.set(k, v); formulas.delete(k); }
    })),
    setValue: (v: unknown) => { valores.set(clave(f, c), v); formulas.delete(clave(f, c)); },
    setFormula: (fx: string) => { formulas.set(clave(f, c), fx); valores.delete(clave(f, c)); },
    clearContent: () => { for (let i = 0; i < nf; i++) for (let j = 0; j < nc; j++) { valores.delete(clave(f + i, c + j)); formulas.delete(clave(f + i, c + j)); } },
    setNumberFormat: (fmt: string) => { for (let i = 0; i < nf; i++) formatos.set(clave(f + i, c), fmt); },
  });
  return {
    valores, formulas, formatos,
    // Cuenta las escrituras (para verificar que sólo se toca lo que cambió).
    getRange: (f: number, c: number, nf = 1, nc = 1) => {
      const r = rango(f, c, nf, nc);
      return {
        ...r,
        setValues: (m: unknown[][]) => { escrituras++; return r.setValues(m); },
        setValue: (v: unknown) => { escrituras++; return r.setValue(v); },
        setFormula: (fx: string) => { escrituras++; return r.setFormula(fx); },
        clearContent: () => { escrituras++; return r.clearContent(); },
        // Copia formato o fórmulas de una fila a otra (las fórmulas con la referencia de fila ajustada, como Sheets).
        copyTo: (destino: { _f: number }, tipo: string) => {
          escrituras++;
          for (let j = 0; j < nc; j++) {
            if (tipo === "FORMAT") {
              const fmt = formatos.get(clave(f, c + j));
              if (fmt) formatos.set(clave(destino._f, c + j), fmt);
            } else {
              const fx = formulas.get(clave(f, c + j));
              if (fx) formulas.set(clave(destino._f, c + j), fx.replace(new RegExp(`([A-Z]+)${f}\\b`, "g"), `$1${destino._f}`));
            }
          }
        },
        _f: f,
      };
    },
    // Insertar una fila corre hacia abajo todo lo que está de ahí en adelante.
    insertRowAfter: (n: number) => desplazar(n + 1),
    insertRowBefore: (n: number) => desplazar(n),
    escrituras: () => escrituras,
    getLastRow: () => Math.max(0, ...[...valores.keys(), ...formulas.keys()].map((k) => Number(k.split(",")[0]))),
    getLastColumn: () => Math.max(0, ...[...valores.keys(), ...formulas.keys()].map((k) => Number(k.split(",")[1]))),
    v: (f: number, c: number) => valores.get(clave(f, c)),
    fx: (f: number, c: number) => formulas.get(clave(f, c)),
  };
}

export function cargarScript(opciones: { hojas: Record<string, Hoja>; respuesta: { codigo: number; cuerpo: unknown }; props?: Record<string, string> }) {
  const props: Record<string, string> = { URL: "https://ejemplo.test/api/sheets/catalogo", TOKEN: "t", ...opciones.props };
  const pedidos: { url: string; headers: Record<string, string>; opciones: Record<string, unknown> }[] = [];
  const entorno = {
    SpreadsheetApp: { getActive: () => ({ getSheetByName: (n: string) => opciones.hojas[n] ?? null, insertSheet: (n: string) => (opciones.hojas[n] = crearHoja()) }), flush: () => undefined, CopyPasteType: { PASTE_FORMAT: "FORMAT", PASTE_FORMULA: "FORMULA" } },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => props[k] ?? null,
        setProperty: (k: string, v: string) => { props[k] = v; },
        deleteProperty: (k: string) => { delete props[k]; },
      }),
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => undefined }) },
    UrlFetchApp: {
      fetch: (url: string, o: { headers: Record<string, string> }) => {
        pedidos.push({ url, headers: o.headers, opciones: o as unknown as Record<string, unknown> });
        return { getResponseCode: () => opciones.respuesta.codigo, getContentText: () => JSON.stringify(opciones.respuesta.cuerpo) };
      },
    },
  };
  const fabrica = new Function(
    "module", "SpreadsheetApp", "PropertiesService", "LockService", "UrlFetchApp",
    `${FUENTE}\nreturn { sincronizar_, etiquetaDePiscina, claveDePrecio, valorDePrecio, validarDatos, valorDeStock, buscarEncabezadoStock, celdaParaEscribir_ };`
  );
  const api = fabrica({}, entorno.SpreadsheetApp, entorno.PropertiesService, entorno.LockService, entorno.UrlFetchApp);
  return { ...api, props, pedidos };
}

