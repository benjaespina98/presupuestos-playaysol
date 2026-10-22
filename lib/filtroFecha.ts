/**
 * El filtro "Fecha" de las listas con fecha de alta (Pedidos, Historial): sólo decide qué se muestra, no toca los datos.
 */
export type FiltroFecha = "" | "7" | "30" | "90" | "anio";

export const OPCIONES_FECHA: readonly { id: FiltroFecha; etiqueta: string }[] = [
  { id: "", etiqueta: "Cualquier fecha" },
  { id: "7", etiqueta: "Últimos 7 días" },
  { id: "30", etiqueta: "Últimos 30 días" },
  { id: "90", etiqueta: "Últimos 90 días" },
  { id: "anio", etiqueta: "Este año" },
];

const DIA = 24 * 60 * 60 * 1000;

/** ¿La fecha (ISO) cae dentro del período elegido? Sin filtro, siempre. */
export function dentroDeFecha(iso: string, filtro: FiltroFecha, ahora: Date = new Date()): boolean {
  if (!filtro) return true;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return true;
  if (filtro === "anio") return new Date(iso).getFullYear() === ahora.getFullYear();
  return ahora.getTime() - t <= Number(filtro) * DIA;
}

/** Cuántos elementos hay en cada período (para los contadores del filtro). */
export function contarPorFecha<T>(items: readonly T[], fecha: (item: T) => string, ahora: Date = new Date()): Record<FiltroFecha, number> {
  const r: Record<FiltroFecha, number> = { "": items.length, "7": 0, "30": 0, "90": 0, anio: 0 };
  for (const item of items) {
    for (const o of OPCIONES_FECHA) if (o.id && dentroDeFecha(fecha(item), o.id, ahora)) r[o.id]++;
  }
  return r;
}
