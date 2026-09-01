import { z } from "zod";
import { DatosCliente } from "@/lib/domain/presupuesto/v1";

/**
 * Forma del formulario React de Revestimientos. Sólo valida FORMA/entrada —
 * el total sale de `calcularRevestimiento` (lib/domain/precios), nunca de
 * acá.
 *
 * `porM2` no es un dato del catálogo (`catalogo_items` no tiene esa
 * columna): es una propiedad fija de cada material, igual que en
 * `defaultOptionales` del legacy — todos por m² salvo el disqueado, que es
 * precio fijo "por obra". Ver `PORM2_POR_CLAVE` en Revestimientos
 * Calculadora.tsx.
 */
export const Adicional = z.object({
  descripcion: z.string().min(1, "Descripción obligatoria"),
  precio: z.number({ error: "Precio obligatorio" }).nonnegative("No puede ser negativo"),
});
export type AdicionalForm = z.infer<typeof Adicional>;

/** Un adicional de m² (escalón extra, borde…): suma directo al total de m²,
 *  sin ningún cálculo — ver computeM2Total() en el legacy. */
export const AdicionalM2 = z.object({
  label: z.string().min(1, "Descripción obligatoria"),
  m2: z.number({ error: "m² obligatorio" }).nonnegative("No puede ser negativo"),
});
export type AdicionalM2Form = z.infer<typeof AdicionalM2>;

export const MaterialCatalogo = z.object({
  clave: z.string(),
  descripcion: z.string(),
  precio: z.number().nullable(),
  porM2: z.boolean(),
  incluida: z.boolean(),
});
export type MaterialCatalogoForm = z.infer<typeof MaterialCatalogo>;

export const RevestimientoFormSchema = z.object({
  fecha: z.string(),
  validezDias: z.string(),
  cliente: DatosCliente,
  detalle: z.string(),
  largo: z.number({ error: "Ingresá el largo" }).nonnegative("No puede ser negativo"),
  ancho: z.number({ error: "Ingresá el ancho" }).nonnegative("No puede ser negativo"),
  profMin: z.number().nonnegative("No puede ser negativo").default(0),
  profMax: z.number().nonnegative("No puede ser negativo").default(0),
  escalera: z.number().nonnegative("No puede ser negativo").default(0),
  desperdicio: z.number().nonnegative("No puede ser negativo").default(0),
  adicionalesM2: z.array(AdicionalM2).default([]),
  adicionales: z.array(Adicional).default([]),
  materiales: z.array(MaterialCatalogo).default([]),
  /** Qué banner de marca lleva el documento — ver HEADER_VARIANTS en
   *  DocumentoRevestimiento.tsx. Elegible por el vendedor, "teal" por
   *  default porque es la variante que se venía usando siempre. */
  variacionEncabezado: z.enum(["teal", "navy"]).default("teal"),
});
export type RevestimientoForm = z.infer<typeof RevestimientoFormSchema>;

export function formularioVacio(): RevestimientoForm {
  return {
    fecha: new Date().toLocaleDateString("es-AR"),
    validezDias: "7",
    cliente: { nombre: "", domicilio: "", localidad: "", telefono: "", email: "" },
    detalle: "",
    largo: 0,
    ancho: 0,
    profMin: 0,
    profMax: 0,
    escalera: 0,
    desperdicio: 0,
    adicionalesM2: [],
    adicionales: [],
    materiales: [],
    variacionEncabezado: "teal",
  };
}
