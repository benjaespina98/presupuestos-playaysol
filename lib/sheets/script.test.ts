import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Prueba el script de Google Apps Script (docs/sheets-sync/Sincronizar.gs) sin
 * Google: se carga el archivo tal cual y se le dan "planillas" falsas. Lo que se
 * verifica es lo que más importa: que no pise fórmulas, que no borre la planilla
 * si el catálogo viene vacío y que reconozca bien las filas por su nombre.
 */

const FUENTE = fs.readFileSync(path.join(process.cwd(), "docs", "sheets-sync", "Sincronizar.gs"), "utf8");

// ── Una hoja falsa con la API mínima que usa el script ───────────────────────────
type Hoja = ReturnType<typeof crearHoja>;
function crearHoja(inicial: Record<string, unknown> = {}) {
  const valores = new Map<string, unknown>();
  const formulas = new Map<string, string>();
  const formatos = new Map<string, string>();
  const clave = (f: number, c: number) => `${f},${c}`;
  for (const [k, v] of Object.entries(inicial)) {
    if (typeof v === "string" && v.startsWith("=")) formulas.set(k, v);
    else valores.set(k, v);
  }
  const rango = (f: number, c: number, nf = 1, nc = 1) => ({
    getValues: () => Array.from({ length: nf }, (_, i) => Array.from({ length: nc }, (_, j) => valores.get(clave(f + i, c + j)) ?? "")),
    getFormulas: () => Array.from({ length: nf }, (_, i) => Array.from({ length: nc }, (_, j) => formulas.get(clave(f + i, c + j)) ?? "")),
    setValues: (m: unknown[][]) => m.forEach((fila, i) => fila.forEach((v, j) => { valores.set(clave(f + i, c + j), v); formulas.delete(clave(f + i, c + j)); })),
    setValue: (v: unknown) => { valores.set(clave(f, c), v); formulas.delete(clave(f, c)); },
    setFormula: (fx: string) => { formulas.set(clave(f, c), fx); valores.delete(clave(f, c)); },
    clearContent: () => { for (let i = 0; i < nf; i++) for (let j = 0; j < nc; j++) { valores.delete(clave(f + i, c + j)); formulas.delete(clave(f + i, c + j)); } },
    setNumberFormat: (fmt: string) => { for (let i = 0; i < nf; i++) formatos.set(clave(f + i, c), fmt); },
  });
  return {
    valores, formulas, formatos,
    getRange: rango,
    getLastRow: () => Math.max(0, ...[...valores.keys(), ...formulas.keys()].map((k) => Number(k.split(",")[0]))),
    getLastColumn: () => Math.max(0, ...[...valores.keys(), ...formulas.keys()].map((k) => Number(k.split(",")[1]))),
    v: (f: number, c: number) => valores.get(clave(f, c)),
    fx: (f: number, c: number) => formulas.get(clave(f, c)),
  };
}

function cargarScript(opciones: { hojas: Record<string, Hoja>; respuesta: { codigo: number; cuerpo: unknown }; props?: Record<string, string> }) {
  const props: Record<string, string> = { URL: "https://ejemplo.test/api/sheets/catalogo", TOKEN: "t", ...opciones.props };
  const pedidos: { url: string; headers: Record<string, string> }[] = [];
  const entorno = {
    SpreadsheetApp: { getActive: () => ({ getSheetByName: (n: string) => opciones.hojas[n] ?? null, insertSheet: (n: string) => (opciones.hojas[n] = crearHoja()) }), flush: () => undefined },
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
        pedidos.push({ url, headers: o.headers });
        return { getResponseCode: () => opciones.respuesta.codigo, getContentText: () => JSON.stringify(opciones.respuesta.cuerpo) };
      },
    },
  };
  const fabrica = new Function(
    "module", "SpreadsheetApp", "PropertiesService", "LockService", "UrlFetchApp",
    `${FUENTE}\nreturn { sincronizar_, claveDePrecio, valorDePrecio, validarDatos, valorDeStock, buscarEncabezadoStock };`
  );
  const api = fabrica({}, entorno.SpreadsheetApp, entorno.PropertiesService, entorno.LockService, entorno.UrlFetchApp);
  return { ...api, props, pedidos };
}

const fila = (nombre: string, precio: number | null, usd: number | null = null): (string | number | null)[] => [
  nombre, "Ranco", "bolsa", precio, "18/06/2026", "Materiales", "Siempre",
  50, "", "", "", "", "", "", "", "", "", "", usd, "una nota",
];

const DATOS = {
  version: "abc123",
  generado: "2026-10-05T00:00:00Z",
  proveedores: [["Ranco", "Corralón", "Juan", "123", "", "", "nota"]],
  articulos: [
    { usd: false, fila: fila("Cemento", 6461) },
    { usd: true, fila: fila("Filtro VC30", null, 114.68) },
  ],
  precios: { "piscinas:luces": 240000, "piscinas:cascada": null, "piscinas:lista_hormigon_8x4": 15390000 } as Record<string, number | null>,
  tamanos: [],
};

function hojasBase() {
  return {
    Proveedores: crearHoja({ "6,1": "Viejo proveedor", "7,1": "Otro viejo" }),
    "Artículos": crearHoja({ "6,1": "Material viejo", "7,1": "Otro", "3,2": 1450 }),
    "Precios y margen": crearHoja({
      "6,1": "8x4", "6,2": 1,
      "7,1": "6.5x2.5", "7,2": "=SUMPRODUCT(1)", // una fórmula: nunca se pisa
      "8,1": "Luces de acero inoxidable", "8,2": 1,
      "9,1": "Cascada lámina de agua", "9,2": 1,
      "10,1": "Algo que no se sincroniza", "10,2": 999,
      "11,1": "Cerámico Bali Brasil", "11,2": 112000,
    }),
  };
}

describe("claveDePrecio", () => {
  const { claveDePrecio } = cargarScript({ hojas: {}, respuesta: { codigo: 200, cuerpo: {} } });

  it("reconoce los tamaños de piscina de hormigón, igual que la migración que los cargó", () => {
    expect(claveDePrecio("8x4")).toBe("piscinas:lista_hormigon_8x4");
    expect(claveDePrecio("7x3.50")).toBe("piscinas:lista_hormigon_7x3_50");
    expect(claveDePrecio("6.5x2.5")).toBe("piscinas:lista_hormigon_6_5x2.5");
  });

  it("reconoce los modelos Indusplast", () => {
    expect(claveDePrecio("RACIONALISTA 400")).toBe("piscinas:indusplast_racionalista_400");
    expect(claveDePrecio("SPA 240")).toBe("piscinas:indusplast_spa_240");
  });

  it("reconoce los adicionales por su nombre, de cada calculadora", () => {
    expect(claveDePrecio("Luces de acero inoxidable")).toBe("piscinas:luces");
    expect(claveDePrecio("  Cobertor hasta 15 m²  ")).toBe("cobertores:precioMenos15");
    expect(claveDePrecio("Cerco perimetral con instalación")).toBe("cercos:precioCon");
    expect(claveDePrecio("Cerámico Bali Brasil")).toBe("revestimientos:revestimiento_ceramico_bali");
  });

  it("cualquier otra fila no se sincroniza", () => {
    for (const t of ["", "Concepto", "COSTO TOTAL", "Equipamiento y servicios", "Piscina 8x4", null, undefined, 5]) {
      expect(claveDePrecio(t as never)).toBeNull();
    }
  });
});

describe("valorDePrecio", () => {
  const { valorDePrecio } = cargarScript({ hojas: {}, respuesta: { codigo: 200, cuerpo: {} } });
  it("número, 'A cotizar' para null, y undefined si el catálogo no conoce el ítem", () => {
    expect(valorDePrecio({ "a:b": 100 }, "a:b")).toBe(100);
    expect(valorDePrecio({ "a:b": null }, "a:b")).toBe("A cotizar");
    expect(valorDePrecio({}, "a:b")).toBeUndefined();
  });
});

describe("validarDatos", () => {
  const { validarDatos } = cargarScript({ hojas: {}, respuesta: { codigo: 200, cuerpo: {} } });
  it("acepta lo bueno y rechaza un catálogo vacío, incompleto o con filas de otro largo", () => {
    expect(validarDatos(DATOS)).toBeNull();
    expect(validarDatos({ ...DATOS, articulos: [] })).toMatch(/no se actualiza/);
    expect(validarDatos({ ...DATOS, proveedores: [] })).toMatch(/no se actualiza/);
    expect(validarDatos({ proveedores: [] })).toMatch(/incompleta/);
    expect(validarDatos(null)).toMatch(/no es válida/);
    expect(validarDatos({ ...DATOS, articulos: [{ usd: false, fila: ["x"] }] })).toMatch(/columnas/);
  });
});

describe("sincronizar_", () => {
  it("manda el token en el encabezado y reemplaza proveedores y artículos", () => {
    const hojas = hojasBase();
    const s = cargarScript({ hojas, respuesta: { codigo: 200, cuerpo: DATOS } });

    const r = s.sincronizar_(true);

    expect(s.pedidos[0].headers.Authorization).toBe("Bearer t");
    expect(r).toMatchObject({ estado: "actualizada", proveedores: 1, materiales: 2 });
    expect(hojas.Proveedores.v(6, 1)).toBe("Ranco");
    expect(hojas.Proveedores.v(7, 1)).toBeUndefined(); // el sobrante se borra
    expect(hojas["Artículos"].v(6, 1)).toBe("Cemento");
    expect(hojas["Artículos"].v(7, 1)).toBe("Filtro VC30");
    expect(hojas["Artículos"].v(8, 1)).toBeUndefined();
  });

  it("el precio en dólares queda como fórmula (USD × tipo de cambio), no como valor", () => {
    const hojas = hojasBase();
    cargarScript({ hojas, respuesta: { codigo: 200, cuerpo: DATOS } }).sincronizar_(true);

    expect(hojas["Artículos"].v(6, 4)).toBe(6461); // en pesos: el valor
    expect(hojas["Artículos"].fx(7, 4)).toBe("=S7*$B$3"); // en dólares: la fórmula
    expect(hojas["Artículos"].v(7, 19)).toBe(114.68);
  });

  it("no toca el tipo de cambio ni escribe 'Actualizado' como fecha", () => {
    const hojas = hojasBase();
    cargarScript({ hojas, respuesta: { codigo: 200, cuerpo: DATOS } }).sincronizar_(true);

    expect(hojas["Artículos"].v(3, 2)).toBe(1450);
    expect(hojas["Artículos"].formatos.get("6,5")).toBe("@");
    expect(hojas["Artículos"].v(6, 5)).toBe("18/06/2026");
  });

  it("actualiza los precios de venta por nombre de fila, 'A cotizar' para null, y respeta fórmulas y filas ajenas", () => {
    const hojas = hojasBase();
    const r = cargarScript({ hojas, respuesta: { codigo: 200, cuerpo: DATOS } }).sincronizar_(true);
    const p = hojas["Precios y margen"];

    expect(p.v(6, 2)).toBe(15390000); // 8x4
    expect(p.v(8, 2)).toBe(240000); // luces
    expect(p.v(9, 2)).toBe("A cotizar"); // cascada
    expect(p.fx(7, 2)).toBe("=SUMPRODUCT(1)"); // fórmula intacta
    expect(p.v(10, 2)).toBe(999); // fila que no se sincroniza
    expect(p.v(11, 2)).toBe(112000); // el catálogo no la conoce: queda como estaba
    expect(r).toMatchObject({ precios: 3 });
  });

  it("un catálogo vacío NO borra la planilla", () => {
    const hojas = hojasBase();
    const s = cargarScript({ hojas, respuesta: { codigo: 200, cuerpo: { ...DATOS, articulos: [] } } });

    expect(() => s.sincronizar_(true)).toThrow(/no se actualiza/);
    expect(hojas["Artículos"].v(6, 1)).toBe("Material viejo");
    expect(hojas.Proveedores.v(6, 1)).toBe("Viejo proveedor");
  });

  it("si la versión no cambió y no se fuerza, no escribe nada", () => {
    const hojas = hojasBase();
    const s = cargarScript({ hojas, respuesta: { codigo: 200, cuerpo: DATOS }, props: { VERSION: "abc123" } });

    expect(s.sincronizar_(false)).toEqual({ estado: "sin cambios" });
    expect(hojas["Artículos"].v(6, 1)).toBe("Material viejo");
  });

  it("guarda la versión y la hora de la última actualización", () => {
    const s = cargarScript({ hojas: hojasBase(), respuesta: { codigo: 200, cuerpo: DATOS } });
    s.sincronizar_(true);
    expect(s.props.VERSION).toBe("abc123");
    expect(s.props.ULTIMA).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("explica con claridad un token rechazado, una web sin configurar y un error del servidor", () => {
    const con = (codigo: number) => cargarScript({ hojas: hojasBase(), respuesta: { codigo, cuerpo: {} } });
    expect(() => con(401).sincronizar_(true)).toThrow(/rechazó el token/);
    expect(() => con(503).sincronizar_(true)).toThrow(/no tiene activada la sincronización/);
    expect(() => con(500).sincronizar_(true)).toThrow(/respondió 500/);
  });

  it("sin URL o token configurados pide configurarlos", () => {
    const s = cargarScript({ hojas: hojasBase(), respuesta: { codigo: 200, cuerpo: DATOS }, props: { URL: "" } });
    expect(() => s.sincronizar_(true)).toThrow(/Configurar conexión/);
  });

  it("si falta una hoja lo dice por nombre", () => {
    const hojas = hojasBase();
    delete (hojas as Record<string, unknown>)["Artículos"];
    const s = cargarScript({ hojas: hojas as Record<string, Hoja>, respuesta: { codigo: 200, cuerpo: DATOS } });
    expect(() => s.sincronizar_(true)).toThrow(/Artículos/);
  });
});

describe("stock en 'Precios y margen'", () => {
  const conStock = { ...DATOS, stock: { "piscinas:indusplast_caribe_550": 3, "piscinas:indusplast_spa_240": 0 } as Record<string, number> };
  const hojasConIndusplast = (extra: Record<string, unknown> = {}) => ({
    ...hojasBase(),
    "Precios y margen": crearHoja({
      "1,1": "Concepto", "1,2": "Precio de venta", "1,3": "Costo",
      "2,1": "CARIBE 550", "2,2": 1, "2,3": 100,
      "3,1": "SPA 240", "3,2": 1, "3,3": 100,
      "4,1": "RACIONALISTA 400", "4,2": 1, "4,3": 100, // no lleva stock
      "5,1": "Algo que no se sincroniza", "5,2": 5,
      ...extra,
    }),
  });

  it("si la hoja no tiene columna 'Stock', la agrega a la derecha de todo, con su encabezado", () => {
    const hojas = hojasConIndusplast();
    const r = cargarScript({ hojas, respuesta: { codigo: 200, cuerpo: conStock } }).sincronizar_(true);
    const p = hojas["Precios y margen"];

    expect(p.v(1, 4)).toBe("Stock"); // junto al encabezado de la tabla, en la primera columna libre
    expect(p.v(2, 4)).toBe(3);
    expect(p.v(3, 4)).toBe(0); // agotado se ve como 0, no vacío
    expect(p.v(4, 4)).toBeUndefined(); // lo que no lleva stock queda vacío
    expect(p.v(2, 3)).toBe(100); // no pisa la columna de costo
    expect(r).toMatchObject({ stocks: 2 });
  });

  it("si ya hay una columna 'Stock', usa esa", () => {
    const hojas = hojasConIndusplast({ "1,7": "Stock", "2,7": 99 });
    cargarScript({ hojas, respuesta: { codigo: 200, cuerpo: conStock } }).sincronizar_(true);
    const p = hojas["Precios y margen"];

    expect(p.v(2, 7)).toBe(3);
    expect(p.v(1, 8)).toBeUndefined(); // no agregó otra
  });

  it("al volver a correr no repite escrituras, y si el stock cambia en la web, cambia en la planilla", () => {
    const hojas = hojasConIndusplast();
    cargarScript({ hojas, respuesta: { codigo: 200, cuerpo: conStock } }).sincronizar_(true);
    const otra = cargarScript({ hojas, respuesta: { codigo: 200, cuerpo: conStock } }).sincronizar_(true);
    expect(otra).toMatchObject({ stocks: 0 });

    const cambio = { ...conStock, stock: { "piscinas:indusplast_caribe_550": 5 } };
    cargarScript({ hojas, respuesta: { codigo: 200, cuerpo: cambio } }).sincronizar_(true);
    expect(hojas["Precios y margen"].v(2, 4)).toBe(5);
    expect(hojas["Precios y margen"].v(3, 4)).toBe(""); // dejó de llevar stock
  });

  it("no pisa una fórmula en la columna de stock", () => {
    const hojas = hojasConIndusplast({ "1,4": "Stock", "2,4": "=1+1" });
    cargarScript({ hojas, respuesta: { codigo: 200, cuerpo: conStock } }).sincronizar_(true);
    expect(hojas["Precios y margen"].fx(2, 4)).toBe("=1+1");
  });

  it("un catálogo viejo, sin el campo stock, no toca la columna", () => {
    const hojas = hojasConIndusplast({ "1,4": "Stock", "2,4": 7 });
    const r = cargarScript({ hojas, respuesta: { codigo: 200, cuerpo: DATOS } }).sincronizar_(true);
    expect(hojas["Precios y margen"].v(2, 4)).toBe(7);
    expect(r).toMatchObject({ stocks: 0 });
  });

  it("valida que el stock sea un objeto", () => {
    const { validarDatos } = cargarScript({ hojas: {}, respuesta: { codigo: 200, cuerpo: {} } });
    expect(validarDatos(conStock)).toBeNull();
    expect(validarDatos({ ...DATOS, stock: [] })).toMatch(/stock/);
    expect(validarDatos({ ...DATOS, stock: null })).toMatch(/stock/);
  });

  it("valorDeStock y buscarEncabezadoStock", () => {
    const { valorDeStock, buscarEncabezadoStock } = cargarScript({ hojas: {}, respuesta: { codigo: 200, cuerpo: {} } });
    expect(valorDeStock({ "a:b": 0 }, "a:b")).toBe(0);
    expect(valorDeStock({}, "a:b")).toBe("");
    expect(buscarEncabezadoStock([["x", " STOCK "]])).toEqual({ fila: 1, columna: 2 });
    expect(buscarEncabezadoStock([["x", "y"]])).toBeNull();
  });
});

describe("buscarEncabezadoStock · encabezados con otro texto", () => {
  const { buscarEncabezadoStock } = cargarScript({ hojas: {}, respuesta: { codigo: 200, cuerpo: {} } });
  it("acepta 'Stock actual' o 'Stock (unid.)', pero no una palabra que sólo lo contiene", () => {
    expect(buscarEncabezadoStock([["a", "Stock actual"]])).toEqual({ fila: 1, columna: 2 });
    expect(buscarEncabezadoStock([["a", "Stock (unid.)"]])).toEqual({ fila: 1, columna: 2 });
    expect(buscarEncabezadoStock([["a", "Sin stock"]])).toBeNull();
    expect(buscarEncabezadoStock([["a", "Stockeo"]])).toBeNull();
  });

  it("lo encuentra aunque esté más abajo de la fila 10", () => {
    const filas = Array.from({ length: 25 }, (_, i) => (i === 24 ? ["x", "Stock"] : ["x", ""]));
    expect(buscarEncabezadoStock(filas)).toEqual({ fila: 25, columna: 2 });
  });
});

describe("hoja 'Catálogo web' (todos los campos de los precios de venta)", () => {
  const FILAS = [
    ["Piscinas", "indusplast_caribe_550", "Piscina de fibra Caribe 550", "Piscinas", "obra", 8810000, 3, "Activo", "05/10/2026"],
    ["Cercos", "precioCon", "Precio por metro lineal con instalación", "Cercos", "ml", "A cotizar", "", "De baja", "01/10/2026"],
  ];
  const conCatalogo = { ...DATOS, catalogo: FILAS };

  it("la crea si no existe, con encabezados y una fila por precio de venta", () => {
    const hojas = hojasBase() as Record<string, Hoja>;
    const r = cargarScript({ hojas, respuesta: { codigo: 200, cuerpo: conCatalogo } }).sincronizar_(true);
    const h = hojas["Catálogo web"];

    expect(h).toBeTruthy();
    expect(h.v(1, 1)).toBe("Calculadora");
    expect(h.v(1, 9)).toBe("Actualizado");
    expect(h.v(2, 2)).toBe("indusplast_caribe_550");
    expect(h.v(2, 6)).toBe(8810000);
    expect(h.v(2, 7)).toBe(3);
    expect(h.v(3, 6)).toBe("A cotizar");
    expect(h.v(3, 8)).toBe("De baja");
    expect(r).toMatchObject({ catalogo: 2 });
  });

  it("al volver a sincronizar la reescribe entera: lo borrado en la web desaparece", () => {
    const hojas = hojasBase() as Record<string, Hoja>;
    cargarScript({ hojas, respuesta: { codigo: 200, cuerpo: conCatalogo } }).sincronizar_(true);
    cargarScript({ hojas, respuesta: { codigo: 200, cuerpo: { ...DATOS, catalogo: [FILAS[0]] } } }).sincronizar_(true);
    expect(hojas["Catálogo web"].v(2, 2)).toBe("indusplast_caribe_550");
    expect(hojas["Catálogo web"].v(3, 2)).toBeUndefined();
  });

  it("un catálogo viejo (sin el campo) no crea ni toca la hoja", () => {
    const hojas = hojasBase() as Record<string, Hoja>;
    cargarScript({ hojas, respuesta: { codigo: 200, cuerpo: DATOS } }).sincronizar_(true);
    expect(hojas["Catálogo web"]).toBeUndefined();
  });

  it("rechaza filas con otra cantidad de columnas", () => {
    const { validarDatos } = cargarScript({ hojas: {}, respuesta: { codigo: 200, cuerpo: {} } });
    expect(validarDatos(conCatalogo)).toBeNull();
    expect(validarDatos({ ...DATOS, catalogo: [["x"]] })).toMatch(/columnas/);
    expect(validarDatos({ ...DATOS, catalogo: "no" })).toMatch(/no es válido/);
  });
});

describe("proveedores nuevos o con datos nuevos llegan a la hoja Proveedores", () => {
  it("agregar un proveedor, o cargarle el teléfono, aparece en la próxima sincronización", () => {
    const hojas = hojasBase() as Record<string, Hoja>;
    const conTelefono = {
      ...DATOS,
      proveedores: [
        ["Ranco", "Corralón", "Juan", "+54 9 3534 111111", "Contado", "48 hs", "nota"],
        ["Proveedor Nuevo", "Filtros", "Ana", "+54 9 3534 222222", "", "", ""],
      ],
    };
    cargarScript({ hojas, respuesta: { codigo: 200, cuerpo: conTelefono } }).sincronizar_(true);

    expect(hojas.Proveedores.v(6, 4)).toBe("+54 9 3534 111111");
    expect(hojas.Proveedores.v(7, 1)).toBe("Proveedor Nuevo");
    expect(hojas.Proveedores.v(7, 4)).toBe("+54 9 3534 222222");
  });
});
