import { z } from "zod";
import { DatosCliente } from "@/lib/domain/presupuesto/v1";
import { ModoPrecio } from "@/lib/domain/precios/cercos";

/**
 * Forma del formulario React de Cobertores. Sólo valida FORMA/entrada — el
 * total sale de `calcularCobertor` (lib/domain/precios), nunca de acá. Ver
 * decisión 8 en docs/decisiones-tecnicas.md. Mismo criterio que
 * components/calculadoras/cercos/schema.ts (comentado ahí con más detalle).
 */
export const Adicional = z.object({
  descripcion: z.string().min(1, "Descripción obligatoria"),
  precio: z.number({ error: "Precio obligatorio" }).nonnegative("No puede ser negativo"),
});
export type AdicionalForm = z.infer<typeof Adicional>;

export const OpcionalCatalogo = z.object({
  clave: z.string(),
  descripcion: z.string(),
  precio: z.number().nullable(),
  incluida: z.boolean(),
});
export type OpcionalCatalogoForm = z.infer<typeof OpcionalCatalogo>;

export const CobertorFormSchema = z.object({
  fecha: z.string(),
  validezDias: z.string(),
  cliente: DatosCliente,
  detalle: z.string(),
  largo: z.number({ error: "Ingresá el largo" }).nonnegative("No puede ser negativo"),
  ancho: z.number({ error: "Ingresá el ancho" }).nonnegative("No puede ser negativo"),
  adicionalM2: z.number().nonnegative("No puede ser negativo").default(0),
  precioPorM2HastaUmbral: z.number({ error: "Precio obligatorio" }).nonnegative("No puede ser negativo"),
  precioPorM2SobreUmbral: z.number({ error: "Precio obligatorio" }).nonnegative("No puede ser negativo"),
  precioInstalacion: z.number({ error: "Precio obligatorio" }).nonnegative("No puede ser negativo"),
  modoPrecio: ModoPrecio,
  adicionales: z.array(Adicional).default([]),
  opcionales: z.array(OpcionalCatalogo).default([]),
  /** Qué banner de marca lleva el documento — ver HEADER_VARIANTS en
   *  DocumentoCobertor.tsx. Elegible por el vendedor, "teal" por default
   *  porque es la variante que se venía usando siempre. */
  variacionEncabezado: z.enum(["teal", "navy"]).default("teal"),
});
export type CobertorForm = z.infer<typeof CobertorFormSchema>;

export function formularioVacio(): CobertorForm {
  return {
    fecha: new Date().toLocaleDateString("es-AR"),
    validezDias: "7",
    cliente: { nombre: "", domicilio: "", localidad: "", telefono: "", email: "" },
    detalle: "",
    largo: 0,
    ancho: 0,
    adicionalM2: 0,
    precioPorM2HastaUmbral: 0,
    precioPorM2SobreUmbral: 0,
    precioInstalacion: 0,
    modoPrecio: "ambos",
    adicionales: [],
    opcionales: [],
    variacionEncabezado: "teal",
  };
}
