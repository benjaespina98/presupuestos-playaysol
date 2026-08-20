import { z } from "zod";

/**
 * Tipos compartidos del motor de precios.
 *
 * Todo acá es puro: sin DOM, sin React, sin Supabase. Se puede ejecutar en un
 * test en milisegundos, que es justamente lo que hoy no se puede hacer con las
 * fórmulas enterradas en `buildDocumentBody()`.
 */

/** Un cargo que se suma al total tal cual, sin cálculo. En las calculadoras
 *  legacy son los "Adicionales incluidos en el TOTAL" (state.items). */
export const Adicional = z.object({
  descripcion: z.string(),
  precio: z.number(),
});
export type Adicional = z.infer<typeof Adicional>;

/**
 * Una línea del presupuesto, ya con su precio congelado.
 *
 * Es la pieza central de la decisión de precios: el catálogo tiene los precios
 * de hoy, el presupuesto guarda una COPIA de los que usó. Por eso la línea lleva
 * la descripción además del importe — si mañana se reescribe el texto de un
 * material en el catálogo, el presupuesto viejo tiene que seguir diciendo lo que
 * decía cuando se entregó.
 */
export const LineaPresupuesto = z.object({
  /** Clave del ítem en el catálogo. null si lo agregó a mano el vendedor. */
  clave: z.string().nullable(),
  descripcion: z.string(),
  /** m², ml, unidad, obra. Informativo: no participa del cálculo. */
  unidad: z.string().nullable(),
  cantidad: z.number(),
  /** null = "a cotizar": el ítem sale en el documento sin importe. */
  precioUnitario: z.number().nullable(),
  total: z.number().nullable(),
  /**
   * De dónde salió el precio de esta línea.
   *   catalogo → se tomó del catálogo vigente al crear el presupuesto
   *   manual   → el vendedor lo escribió para este presupuesto
   */
  origen: z.enum(["catalogo", "manual"]),
});
export type LineaPresupuesto = z.infer<typeof LineaPresupuesto>;

/** Redondeo del dinero. Hoy el legacy no redondea: multiplica y muestra lo que
 *  salga, con hasta 3 decimales por el formateador. Se preserva ese
 *  comportamiento — cambiarlo sería alterar totales durante la migración. */
export function redondearComoLegacy(n: number): number {
  return n;
}
