import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EL ORÁCULO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Antes de reescribir una calculadora hay que poder demostrar que la nueva da
 * los mismos números que la vieja. El problema es que las fórmulas viven dentro
 * de funciones que necesitan el DOM (`buildDocumentBody`), así que no se pueden
 * testear sin extraerlas — y extraerlas sin tests es justo lo que no queremos.
 *
 * La salida es no transcribir la fórmula sino PREGUNTARLE AL SISTEMA REAL qué
 * contesta: este arnés levanta la calculadora legacy tal cual está, dentro de un
 * DOM de mentira, le carga datos por sus propios campos y lee el total del
 * documento que ella misma renderiza.
 *
 * Se corre sin servidor, sin login y sin Supabase, en menos de un segundo.
 *
 * ── Por qué queda determinista ──────────────────────────────────────────────
 * `aplicarCatalogoCompartido()` arranca con `if(!window.obtenerCatalogoCompartido) return;`.
 * Al no instalar ese puente, la calculadora usa sus precios por defecto —los que
 * tiene hardcodeados el propio archivo— en vez de los que haya hoy en la base.
 * Es lo que queremos: las fixtures no pueden depender de que alguien cambie un
 * precio en producción.
 *
 * ── Qué NO cubre ───────────────────────────────────────────────────────────
 * jsdom no es un navegador: no valida cómo se ve nada, ni el PDF, ni el Word, ni
 * las fotos. Cubre exactamente una cosa, que es la que importa acá: la aritmética
 * y el texto del documento.
 *
 * Corre con runScripts:'dangerously' para que jsdom ejecute los handlers inline
 * del markup (onclick=, onchange=, oninput=), que losetas usa bastante. Es lo
 * que hace un navegador de verdad; el markup no trae ningún <script> propio, así
 * que lo único que se ejecuta es el código de la calculadora.
 */

const RAIZ = path.join(__dirname, "..", "..");

// Cercos y cobertores ya no están acá: se migraron a React (Fase 5) y sus
// `public/*-calc.js` / `markup.ts` se borraron. Sus fixtures
// (tests/oracle/fixtures/{cercos,cobertores}.json) siguen vivas y protegidas
// para siempre por lib/domain/precios/contra-oraculo.test.ts, que compara el
// motor nuevo contra esa misma foto sin necesitar la calculadora vieja.
export type TipoLegacy = "piscinas" | "revestimientos";

/** Extrae el HTML del markup.ts sin compilar TypeScript: es un template literal. */
function leerMarkup(tipo: TipoLegacy): string {
  const src = fs.readFileSync(
    path.join(RAIZ, "app", "dashboard", tipo, "markup.ts"),
    "utf8"
  );
  const i = src.indexOf("`");
  const j = src.lastIndexOf("`");
  if (i < 0 || j <= i) throw new Error(`${tipo}: no encontré el markup`);
  return src.slice(i + 1, j);
}

export interface Calculadora {
  /** Escribe un valor en un campo y dispara el evento que escucha la calculadora. */
  set(id: string, valor: string): void;
  /** Marca o desmarca un checkbox por su id. */
  check(id: string, valor: boolean): void;
  /** Hace click en un elemento por id. */
  click(id: string): void;
  /** Marca el opcional n-ésimo del catálogo (los checkboxes se generan con
   *  data-id, no con id, así que se los ubica por posición). */
  opcional(indice: number, valor: boolean): void;
  /** Cuántos opcionales trae el catálogo por defecto de esta calculadora. */
  cantidadOpcionales(): number;
  /** Texto de las líneas de SUBTOTAL y TOTAL del documento renderizado.
   *  Se incluye el subtotal porque piscinas sólo dibuja la línea de TOTAL si hay
   *  adicionales cargados: sin el subtotal, esa calculadora quedaría sin ningún
   *  número congelado. */
  totales(): string[];
  /** Agrega un "adicional incluido en el TOTAL" y le carga descripción y precio.
   *  Las filas se generan por JS con data-id, así que se ubican por posición. */
  agregarAdicional(descripcion: string, precio: string): void;
  /** Valor de un campo calculado por la propia app (m² totales, etc.). */
  leer(id: string): string;
  /** Espera a que termine el re-render pendiente. */
  asentar(): Promise<void>;
  /** Errores no capturados durante toda la sesión. */
  errores: string[];
  window: JSDOM["window"];
  cerrar(): void;
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Levanta una calculadora legacy y espera a que termine su arranque asincrónico.
 */
export async function abrirCalculadora(tipo: TipoLegacy): Promise<Calculadora> {
  const markup = leerMarkup(tipo);
  const script = fs.readFileSync(path.join(RAIZ, "public", `${tipo}-calc.js`), "utf8");

  const dom = new JSDOM(`<!doctype html><html><body>${markup}</body></html>`, {
    runScripts: "dangerously",
    url: `https://oraculo.local/dashboard/${tipo}`,
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const doc = window.document;

  // Lo mínimo que el script espera del entorno y jsdom no trae. Todo apunta a que
  // el sembrado de fotos falle rápido y en silencio: `fotosDesdeSeeds` ya usa
  // Promise.allSettled, así que descarta las que no cargan y sigue.
  window.fetch = () => Promise.reject(new Error("el oráculo corre sin red"));
  // @ts-expect-error entorno de prueba
  window.indexedDB = undefined;
  window.URL.createObjectURL = () => "blob:oraculo";
  window.URL.revokeObjectURL = () => {};

  const errores: string[] = [];
  window.addEventListener("error", (e: ErrorEvent) =>
    errores.push(String(e.error?.stack || e.error || e.message))
  );
  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) =>
    errores.push(String(e.reason?.stack || e.reason))
  );

  window.eval(script);

  // El init es asincrónico (loadCatalog → catálogo compartido → fotos → renderForm).
  // #f-fecha arranca vacío en el markup y sólo se puebla en renderForm(): que tenga
  // valor es la señal real de que el arranque terminó.
  for (let k = 0; k < 60; k++) {
    await dormir(20);
    if ((doc.getElementById("f-fecha") as HTMLInputElement | null)?.value) break;
  }
  if (!(doc.getElementById("f-fecha") as HTMLInputElement | null)?.value) {
    throw new Error(
      `${tipo}: la calculadora no terminó de arrancar.\n${errores.join("\n")}`
    );
  }

  const disparar = (el: Element, evento: string) =>
    el.dispatchEvent(new window.Event(evento, { bubbles: true }));

  return {
    window,
    errores,
    set(id, valor) {
      const el = doc.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
      if (!el) throw new Error(`${tipo}: no existe el campo #${id}`);
      el.value = valor;
      // Los <select> escuchan 'change'; los <input>, 'input'. Se disparan los dos
      // para no tener que saber cuál es cada uno desde el caso de prueba.
      disparar(el, "input");
      disparar(el, "change");
    },
    check(id, valor) {
      const el = doc.getElementById(id) as HTMLInputElement | null;
      if (!el) throw new Error(`${tipo}: no existe el checkbox #${id}`);
      el.checked = valor;
      disparar(el, "change");
    },
    click(id) {
      const el = doc.getElementById(id);
      if (!el) throw new Error(`${tipo}: no existe #${id}`);
      (el as HTMLElement).click();
    },
    opcional(indice, valor) {
      const checks = doc.querySelectorAll<HTMLInputElement>(".opt-check");
      const el = checks[indice];
      if (!el) {
        throw new Error(
          `${tipo}: no hay opcional en la posición ${indice} (hay ${checks.length})`
        );
      }
      el.checked = valor;
      disparar(el, "change");
    },
    cantidadOpcionales() {
      return doc.querySelectorAll(".opt-check").length;
    },
    leer(id) {
      const el = doc.getElementById(id) as HTMLInputElement | null;
      return el ? el.value : "";
    },
    totales() {
      return [
        ...doc.querySelectorAll(
          "#sheet-body .price-line.total, #sheet-body .price-line.subtotal"
        ),
      ].map((el) => (el.textContent || "").replace(/\s+/g, " ").trim());
    },
    agregarAdicional(descripcion, precio) {
      const boton = doc.getElementById("btn-add-item");
      if (!boton) throw new Error(`${tipo}: no existe #btn-add-item`);
      (boton as HTMLElement).click();

      const descs = doc.querySelectorAll<HTMLInputElement>("#items-list .item-desc");
      const precios = doc.querySelectorAll<HTMLInputElement>("#items-list .item-price");
      const d = descs[descs.length - 1];
      const p = precios[precios.length - 1];
      if (!d || !p) throw new Error(`${tipo}: no se generó la fila del adicional`);

      d.value = descripcion;
      disparar(d, "input");
      p.value = precio;
      disparar(p, "input");
    },
    async asentar() {
      await dormir(30);
    },
    cerrar() {
      window.close();
    },
  };
}

/**
 * Convierte el texto de una línea de total en el número que representa.
 * Formato de salida de la app: "TOTAL SIN INSTALACIÓN$ 1.524.000".
 */
export function montoDeLinea(linea: string): number {
  const m = linea.match(/\$\s*([\d.,]+)/);
  if (!m) return NaN;
  // es-AR: el punto separa miles y la coma separa decimales.
  return Number(m[1].replace(/\./g, "").replace(",", "."));
}

/** Igual que montoDeLinea pero para un texto que es sólo el número, sin "$". */
export function numeroDeTexto(texto: string): number {
  const m = texto.match(/([\d.,]+)/);
  if (!m) return NaN;
  return Number(m[1].replace(/\./g, "").replace(",", "."));
}

/* ══════════════════════════════════════════════════════════════════════════
   LOSETAS (Plano de Piscina)
   ══════════════════════════════════════════════════════════════════════════
   No comparte nada con las otras cuatro: su script y su markup viven en el
   bundle (no en /public), no tiene el layout de dos paneles y no renderiza un
   documento con líneas de precio. Su salida son dos números —m² incluidos y
   m² a cotizar— más una tarjeta de costo por material.                     */

export interface Losetas {
  set(id: string, valor: string): void;
  check(id: string, valor: boolean): void;
  /** m² incluidos y m² a cotizar, como los muestra la pantalla. */
  m2(): { incluidos: number; extra: number };
  /** Costo por material, leyendo las tarjetas que genera la calculadora. */
  costos(): { material: string; monto: number }[];
  /** Carga el precio del material n-ésimo, por su <input> real. */
  precioMaterial(indice: number, precio: number): void;
  asentar(): Promise<void>;
  errores: string[];
  cerrar(): void;
}

export async function abrirLosetas(): Promise<Losetas> {
  const dir = path.join(RAIZ, "app", "dashboard", "losetas");

  const markupTs = fs.readFileSync(path.join(dir, "markup.ts"), "utf8");
  const markup = markupTs.slice(markupTs.indexOf("`") + 1, markupTs.lastIndexOf("`"));

  // El script es un template literal de TS: hay que devolverle los backticks y
  // los ${...} que estaban escapados para que no los interpretara TypeScript.
  const scriptTs = fs.readFileSync(path.join(dir, "script.ts"), "utf8");
  const script = scriptTs
    .slice(scriptTs.indexOf("`") + 1, scriptTs.lastIndexOf("`"))
    .replace(/\\`/g, "`")
    .replace(/\\\$\{/g, "${");

  const dom = new JSDOM(
    `<!doctype html><html><body><div class="pys-calc">${markup}</div></body></html>`,
    { runScripts: "dangerously", url: "https://oraculo.local/dashboard/losetas", pretendToBeVisual: true }
  );
  const { window } = dom;
  const doc = window.document;

  window.fetch = () => Promise.reject(new Error("el oráculo corre sin red"));
  window.URL.createObjectURL = () => "blob:oraculo";
  window.URL.revokeObjectURL = () => {};

  const errores: string[] = [];
  window.addEventListener("error", (e: ErrorEvent) =>
    errores.push(String(e.error?.stack || e.error || e.message))
  );
  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) =>
    errores.push(String(e.reason?.stack || e.reason))
  );

  window.eval(script);
  await dormir(60);

  if (!doc.querySelector("#materialsContainer .material-row")) {
    throw new Error(`losetas: no arrancó.\n${errores.join("\n")}`);
  }

  const disparar = (el: Element, evento: string) =>
    el.dispatchEvent(new window.Event(evento, { bubbles: true }));

  return {
    errores,
    set(id, valor) {
      const el = doc.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
      if (!el) throw new Error(`losetas: no existe #${id}`);
      el.value = valor;
      disparar(el, "input");
      disparar(el, "change");
    },
    check(id, valor) {
      const el = doc.getElementById(id) as HTMLInputElement | null;
      if (!el) throw new Error(`losetas: no existe #${id}`);
      el.checked = valor;
      disparar(el, "change");
    },
    m2() {
      return {
        incluidos: numeroDeTexto(doc.getElementById("m2inc")?.textContent || ""),
        extra: numeroDeTexto(doc.getElementById("m2extra")?.textContent || ""),
      };
    },
    precioMaterial(indice, precio) {
      const inputs = doc.querySelectorAll<HTMLInputElement>(
        "#materialsContainer .material-row input[type=number]"
      );
      const el = inputs[indice];
      if (!el) {
        throw new Error(
          `losetas: no hay material en la posición ${indice} (hay ${inputs.length})`
        );
      }
      el.value = String(precio);
      disparar(el, "input");
    },
    costos() {
      return [...doc.querySelectorAll("#materialCostCards .card")].map((card) => ({
        material: (card.querySelector(".label")?.textContent || "").replace(/\s+/g, " ").trim(),
        monto: numeroDeTexto(card.querySelector(".value")?.textContent || ""),
      }));
    },
    async asentar() {
      await dormir(30);
    },
    cerrar() {
      window.close();
    },
  };
}
