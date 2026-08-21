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
 * ── Qué NO cubre ───────────────────────────────────────────────────────────
 * jsdom no es un navegador: no valida cómo se ve nada, ni el PDF, ni el Word, ni
 * las fotos. Cubre exactamente una cosa, que es la que importa acá: la aritmética
 * y el texto del documento.
 *
 * Corre con runScripts:'dangerously' para que jsdom ejecute los handlers inline
 * del markup (onclick=, onchange=, oninput=), que losetas usa bastante. Es lo
 * que hace un navegador de verdad; el markup no trae ningún <script> propio, así
 * que lo único que se ejecuta es el código de la calculadora.
 *
 * ── Cercos, cobertores, piscinas y revestimientos ya no están acá ──────────
 * Se migraron a React (Fase 5) y sus `public/*-calc.js` / `markup.ts` se
 * borraron, así que el arnés genérico que los levantaba (`abrirCalculadora`,
 * `TipoLegacy`, `Calculadora`) se borró con ellos — no tenía más consumidores.
 * Sus fixtures (tests/oracle/fixtures/{cercos,cobertores,piscinas,
 * revestimientos}.json) siguen vivas y protegidas para siempre por
 * lib/domain/precios/contra-oraculo.test.ts, que compara el motor nuevo
 * contra esa misma foto sin necesitar la calculadora vieja.
 *
 * Losetas es la última que queda: usa `abrirLosetas`, más abajo, porque no
 * comparte nada con las otras (ver el comentario ahí).
 */

const RAIZ = path.join(__dirname, "..", "..");
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
