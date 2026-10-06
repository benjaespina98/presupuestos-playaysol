import { z } from "zod";

/**
 * Profundidad de la pileta en el plano: una sola para toda la pileta, o una
 * distinta por tramos ("de 0 a 3 m, 1,00 m; el resto, 1,10 m").
 *
 * Los tramos se miden a lo largo de la pileta, desde el lado del solar (el
 * extremo izquierdo del plano). Lo que no cae dentro de ningún tramo tiene la
 * profundidad general (`base`).
 *
 * Todo esto es dibujo e información para el cliente: no interviene en ningún
 * precio.
 */
export const TramoProfundidad = z.object({
  desde: z.number().min(0).default(0),
  hasta: z.number().min(0).default(0),
  prof: z.number().min(0).default(0),
});
export type TramoProfundidad = z.infer<typeof TramoProfundidad>;

/** Una franja de la pileta con su profundidad (`prof` 0 = sin dato). */
export interface ZonaProfundidad {
  desde: number;
  hasta: number;
  prof: number;
  /** true = es un tramo cargado a mano; false = es el "resto" (profundidad general). */
  esTramo: boolean;
}

/**
 * Deja sólo tramos válidos: recorta a [0, largo], descarta los vacíos (hasta ≤
 * desde) y los sin profundidad, ordena por inicio y, si dos se pisan, el
 * segundo arranca donde termina el anterior. Nunca lanza: una entrada a medio
 * cargar (el usuario está tipeando) simplemente no dibuja ese tramo todavía.
 */
export function normalizarTramos(tramos: readonly TramoProfundidad[], largo: number): TramoProfundidad[] {
  const validos = tramos
    .map((t) => ({
      desde: Math.max(0, Math.min(t.desde, largo)),
      hasta: Math.max(0, Math.min(t.hasta, largo)),
      prof: t.prof,
    }))
    .filter((t) => t.hasta > t.desde && t.prof > 0)
    .sort((a, b) => a.desde - b.desde);

  const resultado: TramoProfundidad[] = [];
  let tope = 0;
  for (const t of validos) {
    const desde = Math.max(t.desde, tope);
    if (t.hasta <= desde) continue;
    resultado.push({ desde, hasta: t.hasta, prof: t.prof });
    tope = t.hasta;
  }
  return resultado;
}

/**
 * La pileta partida en franjas contiguas que cubren todo el largo: los tramos
 * cargados y, entre ellos, el "resto" con la profundidad general. Las franjas
 * del resto sólo existen si hay profundidad general (`base` > 0).
 */
export function zonasProfundidad(base: number, tramos: readonly TramoProfundidad[], largo: number): ZonaProfundidad[] {
  if (largo <= 0) return [];
  const ts = normalizarTramos(tramos, largo);
  const zonas: ZonaProfundidad[] = [];
  let cursor = 0;
  const EPS = 1e-9;
  const resto = (desde: number, hasta: number) => {
    if (hasta - desde > EPS && base > 0) zonas.push({ desde, hasta, prof: base, esTramo: false });
  };
  for (const t of ts) {
    resto(cursor, t.desde);
    zonas.push({ desde: t.desde, hasta: t.hasta, prof: t.prof, esTramo: true });
    cursor = t.hasta;
  }
  resto(cursor, largo);
  return zonas;
}

/** Los cortes entre franjas (en metros), sin los bordes de la pileta. */
export function cortesProfundidad(zonas: readonly ZonaProfundidad[]): number[] {
  return zonas.slice(1).map((z) => z.desde);
}

export const fmtProfundidad = (n: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(n);

/**
 * El resumen para el título del plano: "1,15 m" si es toda igual, "1,00 a
 * 1,10 m" si varía. Vacío si no hay ninguna profundidad cargada.
 */
export function resumenProfundidad(zonas: readonly ZonaProfundidad[]): string {
  const valores = zonas.map((z) => z.prof).filter((p) => p > 0);
  if (valores.length === 0) return "";
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  return min === max ? `${fmtProfundidad(min)} m` : `${fmtProfundidad(min)} a ${fmtProfundidad(max)} m`;
}

/** Problemas de los tramos cargados, para avisarle a quien los carga (el plano
 *  igual dibuja lo que puede). Lista vacía = todo en orden. */
export function problemasTramos(tramos: readonly TramoProfundidad[], largo: number): string[] {
  const problemas: string[] = [];
  const cargados = tramos.filter((t) => t.desde > 0 || t.hasta > 0 || t.prof > 0);
  if (cargados.some((t) => t.hasta > 0 && t.hasta <= t.desde)) {
    problemas.push('En algún tramo "hasta" tiene que ser mayor que "desde".');
  }
  if (largo > 0 && cargados.some((t) => t.hasta > largo || t.desde > largo)) {
    problemas.push("Hay un tramo que se pasa del largo de la pileta: se recorta.");
  }
  const ordenados = [...cargados].filter((t) => t.hasta > t.desde).sort((a, b) => a.desde - b.desde);
  for (let i = 1; i < ordenados.length; i++) {
    if (ordenados[i].desde < ordenados[i - 1].hasta) {
      problemas.push("Hay tramos que se pisan: el segundo arranca donde termina el anterior.");
      break;
    }
  }
  return problemas;
}
