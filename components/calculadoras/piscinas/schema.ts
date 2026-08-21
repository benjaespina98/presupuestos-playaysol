import { z } from "zod";
import { DatosCliente } from "@/lib/domain/presupuesto/v1";

/**
 * Forma del formulario React de Piscinas. Sólo valida FORMA/entrada — el
 * total sale de `calcularPiscina` (lib/domain/precios), nunca de acá.
 *
 * A diferencia de cercos/cobertores, acá TODOS los opcionales viajan en el
 * form (no sólo los tildados): el documento los muestra siempre — tildado y
 * con precio da el importe, cualquier otro caso da "No incluye"
 * (`precioDeOpcional` en el motor). No hay `modoPrecio`: piscinas no tiene
 * concepto de instalación aparte.
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

export const PiscinaFormSchema = z.object({
  fecha: z.string(),
  validezDias: z.string(),
  cliente: DatosCliente,
  detalle: z.string(),
  subtotal: z.number({ error: "Ingresá el subtotal" }),
  adicionales: z.array(Adicional).default([]),
  opcionales: z.array(OpcionalCatalogo).default([]),
});
export type PiscinaForm = z.infer<typeof PiscinaFormSchema>;

export function formularioVacio(): PiscinaForm {
  return {
    fecha: new Date().toLocaleDateString("es-AR"),
    validezDias: "7",
    cliente: { nombre: "", domicilio: "", localidad: "", telefono: "", email: "" },
    detalle: "",
    subtotal: 0,
    adicionales: [],
    opcionales: [],
  };
}
