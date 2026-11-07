import type { MovimientoVista } from "./movimientos";

/** Un movimiento del libro con el nombre del modelo, para la pestaña Movimientos. */
export interface MovimientoConItem extends MovimientoVista {
  itemNombre: string;
}

export interface ResumenMovimientos {
  movimientos: number;
  /** Unidades que salieron por ventas (sin contar las anuladas). */
  vendidas: number;
  /** Unidades que entraron por ingresos (sin contar las anuladas). */
  ingresadas: number;
  ajustes: number;
  /** Quién hizo cuántos movimientos, de más a menos. */
  porPersona: { nombre: string; cantidad: number }[];
  /** Los modelos más vendidos, de más a menos. */
  masVendidos: { nombre: string; unidades: number }[];
}

const SIN_NOMBRE = "Sin nombre";

/** Las métricas de un conjunto de movimientos. Lo anulado y sus contra-asientos no cuentan como ventas ni ingresos. */
export function resumirMovimientos(movs: readonly MovimientoConItem[]): ResumenMovimientos {
  let vendidas = 0;
  let ingresadas = 0;
  let ajustes = 0;
  const personas = new Map<string, number>();
  const modelos = new Map<string, number>();
  for (const m of movs) {
    const quien = m.creadorNombre ?? SIN_NOMBRE;
    personas.set(quien, (personas.get(quien) ?? 0) + 1);
    if (m.anulado || m.tipo === "anulacion") continue;
    if (m.tipo === "venta") {
      vendidas += -m.cantidad;
      modelos.set(m.itemNombre, (modelos.get(m.itemNombre) ?? 0) + -m.cantidad);
    } else if (m.tipo === "ingreso") ingresadas += m.cantidad;
    else if (m.tipo === "ajuste") ajustes++;
  }
  const ordenado = <T extends { nombre: string }>(filas: T[], valor: (f: T) => number) =>
    filas.sort((a, b) => valor(b) - valor(a) || a.nombre.localeCompare(b.nombre, "es"));
  return {
    movimientos: movs.length,
    vendidas,
    ingresadas,
    ajustes,
    porPersona: ordenado([...personas].map(([nombre, cantidad]) => ({ nombre, cantidad })), (f) => f.cantidad),
    masVendidos: ordenado([...modelos].map(([nombre, unidades]) => ({ nombre, unidades })), (f) => f.unidades),
  };
}

export interface Agotamiento {
  itemId: string;
  nombre: string;
  /** El momento en que el stock llegó a 0 (o menos). */
  fecha: string;
  quien: string | null;
  /** El stock de ese modelo ahora. */
  stockActual: number;
}

/**
 * Los modelos que hoy están en 0 o menos y cuándo se agotaron: el último movimiento que los dejó sin stock, con quién lo hizo.
 * `movs` va del más nuevo al más viejo.
 */
export function agotadosAhora(movs: readonly MovimientoConItem[]): Agotamiento[] {
  const vistos = new Set<string>();
  const salida: Agotamiento[] = [];
  const porItem = new Map<string, MovimientoConItem[]>();
  for (const m of movs) porItem.set(m.item_id, [...(porItem.get(m.item_id) ?? []), m]);
  for (const [itemId, lista] of porItem) {
    if (vistos.has(itemId)) continue;
    vistos.add(itemId);
    const actual = lista[0].stock_resultante;
    if (actual > 0) continue;
    // El primer movimiento (yendo hacia atrás) cuyo saldo anterior era positivo: ahí se agotó. Si no hay, se agotó desde el inicio.
    const causa = lista.find((m) => m.stock_resultante <= 0 && m.stock_resultante - m.cantidad > 0);
    const fuente = causa ?? lista[lista.length - 1];
    salida.push({ itemId, nombre: lista[0].itemNombre, fecha: fuente.creado_at, quien: fuente.creadorNombre, stockActual: actual });
  }
  return salida.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export type PeriodoMovimientos = "hoy" | "7" | "30" | "todo";

/** Los movimientos desde el comienzo del período (hoy = desde las 0:00; 7 y 30 = últimos días). */
export function delPeriodo<T extends { creado_at: string }>(movs: readonly T[], periodo: PeriodoMovimientos, ahora: Date = new Date()): T[] {
  if (periodo === "todo") return [...movs];
  const desde = new Date(ahora);
  if (periodo === "hoy") desde.setHours(0, 0, 0, 0);
  else desde.setTime(ahora.getTime() - Number(periodo) * 24 * 60 * 60 * 1000);
  return movs.filter((m) => new Date(m.creado_at).getTime() >= desde.getTime());
}
