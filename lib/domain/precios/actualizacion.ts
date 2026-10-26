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
