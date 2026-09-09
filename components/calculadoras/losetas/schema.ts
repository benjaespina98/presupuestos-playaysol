import { z } from "zod";
import { LuzPos, EscaleraPos, TipoPileta, Revestimiento } from "@/lib/domain/plano/losetas";

/**
 * Forma del formulario React de Losetas. Sólo valida FORMA/entrada — la
 * aritmética de m² sale de `calcularLoseta` (lib/domain/precios/losetas.ts)
 * y el dibujo de `calcularGeometriaPlano` (lib/domain/plano/losetas.ts),
 * nunca de acá.
 *
 * Nombres de campo alineados 1:1 con `getState()` del legacy para que
 * `snapshot.ts` (la conversión hacia/desde PresupuestoV1) sea un mapeo
 * directo, sin traducciones que puedan introducir un desvío.
 */
export const LosetasFormSchema = z.object({
  nombre: z.string().default(""),
  largo: z.number({ error: "Ingresá el largo" }).nonnegative("No puede ser negativo"),
  ancho: z.number({ error: "Ingresá el ancho" }).nonnegative("No puede ser negativo"),
  incluido: z.number().nonnegative("No puede ser negativo").default(0.5),
  solar: z.number().nonnegative("No puede ser negativo").default(0),
  opuesto: z.number().nonnegative("No puede ser negativo").default(0),
  lateral1: z.number().nonnegative("No puede ser negativo").default(0),
  lateral2: z.number().nonnegative("No puede ser negativo").default(0),

  solarHumedo: z.boolean().default(false),
  solarHumedoAncho: z.number().nonnegative("No puede ser negativo").default(0),

  escalera: z.boolean().default(false),
  escaleraPos: EscaleraPos.default("solar"),
  escaleraAncho: z.number().nonnegative("No puede ser negativo").default(0.5),
  escaleraEscalones: z.number().nonnegative("No puede ser negativo").default(3),
  escaleraMedidaEscalon: z.number().nonnegative("No puede ser negativo").default(0.3),
  escaleraMovible: z.boolean().default(false),
  escaleraPosLibre: LuzPos.default({ x: 0.5, y: 0.5 }),

  tipoPileta: TipoPileta.default("hormigon"),
  labios: z.number().nonnegative("No puede ser negativo").default(0.2),

  luces: z.boolean().default(false),
  cantLuces: z.number().min(0).default(0),
  lucesPos: z.array(LuzPos).default([]),

  revestimiento: Revestimiento.default(""),
  revestimientoOtro: z.string().default(""),

  colorAgua: z.string().default("#A6D1EC"),
  colorLoseta: z.string().default("#F7E6D3"),

  lblSolar: z.string().default("Solar"),
  lblOpuesto: z.string().default("Opuesto"),
  lblLateral1: z.string().default("Lateral 1"),
  lblLateral2: z.string().default("Lateral 2"),
});
export type LosetasForm = z.infer<typeof LosetasFormSchema>;

export function formularioVacio(): LosetasForm {
  return {
    nombre: "",
    largo: 0,
    ancho: 0,
    incluido: 0.5,
    solar: 0,
    opuesto: 0,
    lateral1: 0,
    lateral2: 0,
    solarHumedo: false,
    solarHumedoAncho: 0,
    escalera: false,
    escaleraPos: "solar",
    escaleraAncho: 0.5,
    escaleraEscalones: 3,
    escaleraMedidaEscalon: 0.3,
    escaleraMovible: false,
    escaleraPosLibre: { x: 0.5, y: 0.5 },
    tipoPileta: "hormigon",
    labios: 0.2,
    luces: false,
    cantLuces: 0,
    lucesPos: [],
    revestimiento: "",
    revestimientoOtro: "",
    colorAgua: "#A6D1EC",
    colorLoseta: "#F7E6D3",
    lblSolar: "Solar",
    lblOpuesto: "Opuesto",
    lblLateral1: "Lateral 1",
    lblLateral2: "Lateral 2",
  };
}
