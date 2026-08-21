import { z } from "zod";

/**
 * Plano de Piscina — borde perimetral de losetas.
 *
 *   m² incluidos = (largo + 2 × borde) × (ancho + 2 × borde)
 *   m² finales   = (largo + solar + opuesto) × (ancho + lateral1 + lateral2)
 *   m² a cotizar = máximo(0, finales − incluidos)
 *
 * El ancho por lado se carga TERMINADO, incluyendo el borde que ya viene de
 * fábrica. El borde incluido se descuenta una sola vez, como perímetro completo.
 *
 * El máximo(0, …) importa: si los lados cargados dan menos superficie que el
 * borde de fábrica, no se cotiza en negativo, se cotiza cero.
 *
 * ⚠️ Los labios de una pileta de fibra NO afectan estos m². Sólo cambian el
 *    dibujo del espejo de agua dentro de la medida exterior. Punto 6 de
 *    docs/reglas-de-negocio.md.
 *
 * Transcrito de `calc()` en app/dashboard/losetas/script.ts y verificado contra
 * tests/unit/oraculo-losetas.test.ts.
 */

export const Material = z.object({
  nombre: z.string(),
  /** Precio por m². 0 significa "todavía no cargado", que es como arranca. */
  precioPorM2: z.number().min(0),
});
export type Material = z.infer<typeof Material>;

export const EntradaLosetas = z.object({
  largo: z.number().min(0),
  ancho: z.number().min(0),
  /** Ancho de loseta que ya viene incluido, igual en los cuatro lados. */
  bordeIncluido: z.number().min(0).default(0),
  /** Ancho TERMINADO de cada lado, incluyendo el borde de fábrica. */
  solar: z.number().min(0).default(0),
  opuesto: z.number().min(0).default(0),
  lateral1: z.number().min(0).default(0),
  lateral2: z.number().min(0).default(0),
  materiales: z.array(Material).default([]),
});
export type EntradaLosetas = z.input<typeof EntradaLosetas>;

export interface ResultadoLosetas {
  /** Superficie que cubre el borde que viene de fábrica. */
  m2Incluidos: number;
  /** Superficie total del rectángulo terminado. */
  m2Finales: number;
  /** Lo que se cotiza aparte. Nunca negativo. */
  m2ACotizar: number;
  costos: { nombre: string; total: number }[];
}

export function calcularLoseta(entrada: EntradaLosetas): ResultadoLosetas {
  const e = EntradaLosetas.parse(entrada);

  const m2Incluidos =
    (e.largo + 2 * e.bordeIncluido) * (e.ancho + 2 * e.bordeIncluido);
  const m2Finales =
    (e.largo + e.solar + e.opuesto) * (e.ancho + e.lateral1 + e.lateral2);
  const m2ACotizar = Math.max(0, m2Finales - m2Incluidos);

  return {
    m2Incluidos,
    m2Finales,
    m2ACotizar,
    costos: e.materiales.map((m) => ({
      nombre: m.nombre,
      total: m2ACotizar * m.precioPorM2,
    })),
  };
}
