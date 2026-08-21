import { z } from "zod";
import { DatosCliente } from "@/lib/domain/presupuesto/v1";
import { ModoPrecio } from "@/lib/domain/precios/cercos";

/**
 * Forma del formulario React de Cercos. Sólo valida FORMA/entrada — nada de
 * esto es la fórmula: el total sale de `calcularCerco` (lib/domain/precios),
 * nunca de este schema. Ver decisión 8 en docs/decisiones-tecnicas.md.
 *
 * `metrosLineales`/los dos precios son números "de verdad" (no `null`): a
 * diferencia de un precio de catálogo, acá no existe la noción de "a
 * cotizar" — son la entrada mínima para poder calcular algo. Por eso son
 * `z.number()` y no `.nullable()`: MoneyField/NumberField igual entregan
 * `null` mientras el campo está vacío, y esa forma intermedia es justo lo que
 * el mensaje de "obligatorio" cubre.
 */
export const Adicional = z.object({
  descripcion: z.string().min(1, "Descripción obligatoria"),
  precio: z.number({ error: "Precio obligatorio" }).nonnegative("No puede ser negativo"),
});
export type AdicionalForm = z.infer<typeof Adicional>;

/** Un opcional del catálogo con su estado de "incluido en este presupuesto".
 *  `descripcion`/`precio` vienen del catálogo (sólo lectura en este form);
 *  lo único que la persona edita acá es `incluida`. */
export const OpcionalCatalogo = z.object({
  clave: z.string(),
  descripcion: z.string(),
  precio: z.number().nullable(),
  incluida: z.boolean(),
});
export type OpcionalCatalogoForm = z.infer<typeof OpcionalCatalogo>;

export const CercosFormSchema = z.object({
  fecha: z.string(),
  validezDias: z.string(),
  cliente: DatosCliente,
  detalle: z.string(),
  metrosLineales: z
    .number({ error: "Ingresá los metros lineales" })
    .nonnegative("No puede ser negativo"),
  precioPorMlSinInstalacion: z
    .number({ error: "Precio obligatorio" })
    .nonnegative("No puede ser negativo"),
  precioPorMlConInstalacion: z
    .number({ error: "Precio obligatorio" })
    .nonnegative("No puede ser negativo"),
  modoPrecio: ModoPrecio,
  adicionales: z.array(Adicional).default([]),
  opcionales: z.array(OpcionalCatalogo).default([]),
});
export type CercosForm = z.infer<typeof CercosFormSchema>;

export function formularioVacio(): CercosForm {
  return {
    fecha: new Date().toLocaleDateString("es-AR"),
    validezDias: "15",
    cliente: { nombre: "", domicilio: "", localidad: "", telefono: "", email: "" },
    detalle: "",
    metrosLineales: 0,
    precioPorMlSinInstalacion: 0,
    precioPorMlConInstalacion: 0,
    modoPrecio: "ambos",
    adicionales: [],
    opcionales: [],
  };
}
