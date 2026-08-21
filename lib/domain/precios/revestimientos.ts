import { z } from "zod";
import { Adicional } from "./tipos";

/**
 * Revestimiento de piscina.
 *
 *   piso   = largo × ancho
 *   paredes = 2 × profundidad promedio × (largo + ancho)
 *   m² total = piso + paredes + escalera + desperdicio + Σ adicionales de m²
 *
 * ⚠️ CADA MATERIAL TILDADO DA SU PROPIO TOTAL, Y NO SE SUMAN ENTRE SÍ.
 *    Con dos materiales el documento muestra dos totales para que el cliente
 *    elija, no la suma de los dos. Modelados como líneas `alternativa` (ver
 *    tipos.ts). Punto 5 de docs/reglas-de-negocio.md: confirmado, se mantiene
 *    exactamente. Es la regla más fácil de romper sin querer al migrar.
 *
 * Cada material se cobra por m² o por obra (precio fijo), según su `porM2`.
 *
 * Transcrito de `computeM2Total()` y `computeRevestimientoTotal()` en
 * public/revestimientos-calc.js, verificado contra las fixtures del oráculo.
 */

export const MaterialRevestimiento = z.object({
  clave: z.string().nullable(),
  descripcion: z.string(),
  /** null = "a cotizar": sale en el documento sin importe. */
  precio: z.number().nullable(),
  /** true → precio × m². false → precio fijo por obra. */
  porM2: z.boolean().default(true),
  incluida: z.boolean(),
});
export type MaterialRevestimiento = z.infer<typeof MaterialRevestimiento>;

export const EntradaRevestimientos = z.object({
  largo: z.number().min(0),
  ancho: z.number().min(0),
  /** Profundidad mínima y máxima. Si sólo hay una, esa es la profundidad. */
  profMin: z.number().min(0).default(0),
  profMax: z.number().min(0).default(0),
  escalera: z.number().min(0).default(0),
  desperdicio: z.number().min(0).default(0),
  /** m² sueltos que se suman al total sin cálculo (escalón extra, borde…). */
  adicionalesM2: z.array(z.number()).default([]),
  materiales: z.array(MaterialRevestimiento).default([]),
  adicionales: z.array(Adicional).default([]),
});
export type EntradaRevestimientos = z.input<typeof EntradaRevestimientos>;

export interface ResultadoRevestimientos {
  m2Piso: number;
  m2Paredes: number;
  m2Total: number;
  profundidadMin: number;
  profundidadMax: number;
  /** true si la pileta va de menor a mayor profundidad. */
  profundidadVariable: boolean;
  profundidadPromedio: number;
  adicionales: number;
  /** Un total por cada material tildado. NO se suman entre sí. */
  alternativas: { clave: string | null; descripcion: string; total: number }[];
  /** Suma de los totales de las alternativas más los adicionales. Es lo que
   *  devuelve `computeRevestimientoTotal()` en el legacy: se usa para la línea
   *  única cuando hay un solo material tildado (o ninguno). */
  totalUnico: number;
}

/**
 * Reproduce `profRango()`: descarta los valores no positivos y ordena, así que
 * cargar el máximo en el campo del mínimo no rompe nada.
 */
function rangoProfundidad(profMin: number, profMax: number) {
  const vals = [profMin, profMax]
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  if (!vals.length) return { min: 0, max: 0, variable: false };
  const min = vals[0];
  const max = vals[vals.length - 1];
  return { min, max, variable: vals.length > 1 && max !== min };
}

export function calcularRevestimiento(
  entrada: EntradaRevestimientos
): ResultadoRevestimientos {
  const e = EntradaRevestimientos.parse(entrada);

  const { min, max, variable } = rangoProfundidad(e.profMin, e.profMax);
  const promedio = (min + max) / 2;

  const m2Piso = e.largo * e.ancho;
  const m2Paredes = 2 * promedio * (e.largo + e.ancho);
  const m2Adicionales = e.adicionalesM2.reduce((s, m) => s + m, 0);
  const m2Total = m2Piso + m2Paredes + e.escalera + e.desperdicio + m2Adicionales;

  const adicionales = e.adicionales.reduce((s, a) => s + a.precio, 0);

  const alternativas = e.materiales
    .filter((m) => m.incluida && m.precio !== null)
    .map((m) => ({
      clave: m.clave,
      descripcion: m.descripcion,
      // Por m² multiplica; por obra es un precio fijo.
      total: (m.porM2 ? (m.precio as number) * m2Total : (m.precio as number)) + 0,
    }));

  const totalUnico =
    alternativas.reduce((s, a) => s + a.total, 0) + adicionales;

  return {
    m2Piso,
    m2Paredes,
    m2Total,
    profundidadMin: min,
    profundidadMax: max,
    profundidadVariable: variable,
    profundidadPromedio: promedio,
    adicionales,
    alternativas,
    totalUnico,
  };
}

/**
 * Los importes que imprime el documento.
 *
 * Con 0 o 1 material tildado: una sola línea "TOTAL REVESTIMIENTO".
 * Con 2 o más: una línea por material, cada una con su propio total.
 *
 * Reproduce el comportamiento verificado en las fixtures. La suma de los
 * adicionales entra en el total único; con varias alternativas el legacy la
 * reparte igual en cada línea, porque cada total sale de
 * `precio × m² + adicionales`.
 */
export function importesAMostrar(r: ResultadoRevestimientos): number[] {
  if (r.alternativas.length >= 2) {
    return r.alternativas.map((a) => a.total + r.adicionales);
  }
  return [r.totalUnico];
}
