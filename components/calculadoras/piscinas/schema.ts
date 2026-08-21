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
  /**
   * Largo/ancho: puramente informativos (Mejoras de catálogo/formularios,
   * punto 1). NO alimentan el subtotal — piscinas sigue sin fórmula de
   * m²×precio, a diferencia de cercos/cobertores/revestimientos, porque el
   * subtotal de construcción de una piscina depende de demasiadas variables
   * (profundidad variable, escalones, terreno) para reducirlo a dos medidas.
   * Se guardan en `medidas` (mismo nombre de campo que usan las otras 3) para
   * que, si algún día se decide calcular el subtotal automático, el dato ya
   * esté ahí — no habría que rehacer el formulario, sólo el motor.
   */
  largo: z.number().nonnegative("No puede ser negativo").default(0),
  ancho: z.number().nonnegative("No puede ser negativo").default(0),
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
    largo: 0,
    ancho: 0,
    subtotal: 0,
    adicionales: [],
    opcionales: [],
  };
}
