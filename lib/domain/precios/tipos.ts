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
 * Qué papel juega una línea en el total del presupuesto.
 *
 * Esta distinción existe porque el sistema actual la tiene, aunque en ninguna
 * parte del código legacy esté nombrada: hay líneas que se muestran con precio
 * y NO entran en el total. Modelarla acá evita que la próxima persona que lea
 * un total "que no cierra" crea que encontró un bug.
 *
 *   cotiza       Suma al total. Los adicionales de todas las calculadoras.
 *
 *   informativa  Se muestra —con precio si está tildada, o "No incluye" si no—
 *                pero NUNCA suma. Los opcionales de piscinas y cercos: son un
 *                anexo de cotización, no parte del trabajo presupuestado.
 *                Ver puntos 3 de docs/reglas-de-negocio.md.
 *
 *   alternativa  Genera su PROPIO total, y no se suma con las otras
 *                alternativas. Los revestimientos: dos materiales tildados dan
 *                dos totales separados para que el cliente elija, no la suma de
 *                los dos. Ver punto 5 de docs/reglas-de-negocio.md.
 */
export const NaturalezaLinea = z.enum(["cotiza", "informativa", "alternativa"]);
export type NaturalezaLinea = z.infer<typeof NaturalezaLinea>;

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
  /** cantidad × precioUnitario, o null si no hay precio. Se guarda calculado
   *  para que reconstruir el presupuesto no dependa de rehacer la cuenta. */
  total: z.number().nullable(),
  naturaleza: NaturalezaLinea,
  /** Si el vendedor la marcó para ESTE presupuesto. Una línea informativa sin
   *  marcar igual aparece en el documento, como "No incluye". */
  incluida: z.boolean(),
  /**
   * De dónde salió el precio de esta línea.
   *   catalogo → se tomó del catálogo vigente al crear el presupuesto
   *   manual   → el vendedor lo escribió para este presupuesto
   */
  origen: z.enum(["catalogo", "manual"]),
});
export type LineaPresupuesto = z.infer<typeof LineaPresupuesto>;

/** Construye una línea calculando su total, para no repetir la multiplicación
 *  ni olvidarse de que un precio null da un total null. */
export function crearLinea(
  datos: Omit<LineaPresupuesto, "total"> & { total?: number | null }
): LineaPresupuesto {
  const total =
    datos.total !== undefined
      ? datos.total
      : datos.precioUnitario === null
        ? null
        : datos.precioUnitario * datos.cantidad;
  return LineaPresupuesto.parse({ ...datos, total });
}

/**
 * Suma SOLO lo que corresponde: líneas `cotiza`, marcadas y con precio.
 *
 * Las informativas y las alternativas quedan afuera a propósito. Si alguna vez
 * un total "no cierra" contra lo que se ve en el documento, la explicación está
 * casi siempre acá.
 */
export function sumarLineasQueCotizan(lineas: LineaPresupuesto[]): number {
  return lineas.reduce((s, l) => {
    if (l.naturaleza !== "cotiza") return s;
    if (!l.incluida) return s;
    return s + (l.total ?? 0);
  }, 0);
}

/** Las alternativas incluidas, cada una con su total propio. */
export function alternativas(
  lineas: LineaPresupuesto[]
): { descripcion: string; total: number }[] {
  return lineas
    .filter((l) => l.naturaleza === "alternativa" && l.incluida && l.total !== null)
    .map((l) => ({ descripcion: l.descripcion, total: l.total as number }));
}
