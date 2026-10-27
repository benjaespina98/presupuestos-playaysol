import { parseARS } from "@/lib/format/ars";

/**
 * Lógica pura de la pantalla "Actualizar precios": interpretar lo que se tipeó, calcular el precio nuevo
 * de un ajuste por porcentaje y decidir qué filas cambiaron. No toca la base de datos ni la red.
 */

/** Lo que dice un campo de precio nuevo: sin tocar, un número válido o algo que no se entiende. */
export type PrecioTipeado = { tipo: "vacio" } | { tipo: "valido"; valor: number } | { tipo: "invalido" };

/** El precio máximo que acepta la base (numeric(14,2)): un cero de más no debe pasar por un error de tipeo. */
export const PRECIO_MAXIMO = 999_999_999_999.99;

export function interpretarPrecio(texto: string | undefined): PrecioTipeado {
  const t = (texto ?? "").trim();
  if (t === "") return { tipo: "vacio" };
  const n = parseARS(t);
  if (n === null || n < 0 || n > PRECIO_MAXIMO) return { tipo: "invalido" };
  return { tipo: "valido", valor: Math.round(n * 100) / 100 };
}

/** El precio que resulta de subir (o bajar, con porcentaje negativo) el actual; redondeado al peso. */
export function aplicarPorcentaje(actual: number, porcentaje: number): number {
  const nuevo = actual * (1 + porcentaje / 100);
  return Math.max(0, Math.round(nuevo));
}

/** "+12,5 %" / "−3 %" / "0 %"; vacío si no hay precio anterior (no se puede comparar). */
export function variacionPorcentual(actual: number | null, nuevo: number): number | null {
  if (actual === null || actual <= 0) return null;
  return ((nuevo - actual) / actual) * 100;
}

export function textoVariacion(v: number | null): string {
  if (v === null) return "";
  const redondo = Math.round(v * 10) / 10;
  if (redondo === 0) return "0 %";
  const abs = Math.abs(redondo).toLocaleString("es-AR", { maximumFractionDigits: 1 });
  return `${redondo > 0 ? "+" : "−"}${abs} %`;
}

/** Un porcentaje tipeado ("10", "-5", "7,5"): null si no se entiende o es absurdo (±90 %). */
export function interpretarPorcentaje(texto: string): number | null {
  const t = texto.trim().replace("%", "").trim();
  if (t === "") return null;
  const n = parseARS(t);
  if (n === null || n === 0 || n < -90 || n > 1000) return null;
  return n;
}

export interface FilaEditable {
  id: string;
  /** El precio que tiene hoy (null = a confirmar / a cotizar). */
  actual: number | null;
}

export interface CambioDePrecio {
  id: string;
  anterior: number | null;
  nuevo: number;
}

/**
 * Las filas cuyo precio tipeado es válido y distinto del actual (las únicas que se guardan), más los ids de las que
 * tienen algo tipeado que no se entiende (para marcarlas y no guardar nada hasta corregirlas).
 */
export function cambiosPendientes(
  filas: readonly FilaEditable[],
  tipeado: Readonly<Record<string, string>>
): { cambios: CambioDePrecio[]; invalidas: string[] } {
  const cambios: CambioDePrecio[] = [];
  const invalidas: string[] = [];
  for (const f of filas) {
    const r = interpretarPrecio(tipeado[f.id]);
    if (r.tipo === "invalido") invalidas.push(f.id);
    else if (r.tipo === "valido" && r.valor !== f.actual) cambios.push({ id: f.id, anterior: f.actual, nuevo: r.valor });
  }
  return { cambios, invalidas };
}

// ── Pegar una lista de precios ───────────────────────────────────────────────

export interface LineaDeLista {
  nombre: string;
  texto: string;
}

/** Minúsculas, sin tildes ni signos: "Bomba BAP 0.50HP" y "bomba bap 0,50 hp" se parecen. */
export function normalizarNombre(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Lee lo que se pegó: una línea por producto, con el precio al final ("Racionalista 400 — 6.230.000", "Cal 4620",
 * una fila copiada de una planilla con tabulaciones, "Bomba | US$ 166,36"). Devuelve el nombre y el precio tal cual
 * lo escribieron; las líneas sin un precio al final se ignoran.
 */
export function leerListaPegada(texto: string): LineaDeLista[] {
  const salida: LineaDeLista[] = [];
  for (const cruda of texto.split(/\r?\n/)) {
    const linea = cruda.trim();
    if (!linea) continue;
    const m = /^(.*?)[\s\-–—:|=\t]*(?:US\$|u\$s|usd|\$)?\s*(-?[\d][\d.,]*)\s*$/i.exec(linea);
    if (!m) continue;
    const nombre = m[1].replace(/[\s\-–—:|=\t]+$/g, "").trim();
    if (nombre) salida.push({ nombre, texto: m[2] });
  }
  return salida;
}

export interface Emparejamiento {
  /** id de la fila → precio tipeado. */
  asignados: Record<string, string>;
  /** Las líneas que no se pudieron emparejar con una sola fila, con el motivo. */
  sinPareja: { nombre: string; motivo: "no existe" | "varias coinciden" }[];
}

/**
 * Empareja cada línea pegada con UNA fila de la lista: primero por nombre igual (sin tildes ni signos) y, si no, por
 * nombre contenido en el otro, siempre que haya una sola candidata. Ante la duda no adivina: la deja sin pareja.
 */
export function emparejarLista(lineas: readonly LineaDeLista[], filas: readonly { id: string; nombre: string }[]): Emparejamiento {
  // Se comparan sin espacios: "0,50 HP" y "0.50HP" son lo mismo.
  const clave = (x: string) => normalizarNombre(x).replace(/ /g, "");
  const normalizadas = filas.map((f) => ({ id: f.id, n: clave(f.nombre) }));
  const asignados: Record<string, string> = {};
  const sinPareja: Emparejamiento["sinPareja"] = [];
  for (const l of lineas) {
    const n = clave(l.nombre);
    if (!n) continue;
    let candidatas = normalizadas.filter((f) => f.n === n);
    if (candidatas.length === 0) candidatas = normalizadas.filter((f) => f.n.includes(n) || (f.n.length >= 6 && n.includes(f.n)));
    if (candidatas.length === 1) asignados[candidatas[0].id] = l.texto;
    else sinPareja.push({ nombre: l.nombre, motivo: candidatas.length === 0 ? "no existe" : "varias coinciden" });
  }
  return { asignados, sinPareja };
}
