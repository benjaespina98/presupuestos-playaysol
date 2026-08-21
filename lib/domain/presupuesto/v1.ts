import { z } from "zod";
import { LineaPresupuesto } from "../precios/tipos";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EL PRESUPUESTO GUARDADO — versión 1
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La regla, en una línea:
 *
 *   El CATÁLOGO tiene los precios de hoy.
 *   El PRESUPUESTO tiene los precios del día en que se creó.
 *
 * Cambiar un precio en el catálogo no toca ningún presupuesto ya guardado.
 *
 * Lo que hacía el sistema antes: guardaba QUÉ opcionales estaban incluidos
 * (por slug) pero no CUÁNTO costaban, así que reabrir un presupuesto de hace
 * seis meses lo re-cotizaba con los precios actuales. Ver "Los precios no se
 * guardan con el presupuesto" en docs/reglas-de-negocio.md.
 *
 * ── Por qué la foto incluye la descripción y no sólo el importe ────────────
 * Los textos del catálogo también cambian. Si mañana se reescribe el nombre de
 * un material, el presupuesto viejo tiene que seguir diciendo lo que decía
 * cuando se lo entregaron al cliente. Un presupuesto guardado es autosuficiente:
 * se reconstruye entero sin consultar el catálogo.
 *
 * ── Las cuatro rutas de lectura ───────────────────────────────────────────
 *   presupuesto nuevo        → precios del catálogo vigente
 *   abrir/editar uno v1      → precios de su propio snapshot
 *   duplicar uno cualquiera  → precios del catálogo vigente (es uno NUEVO)
 *   abrir uno v0 (histórico) → precios del catálogo, con aviso en pantalla
 */

export const TipoCalculadora = z.enum([
  "piscinas",
  "cercos",
  "cobertores",
  "revestimientos",
  "losetas",
]);
export type TipoCalculadora = z.infer<typeof TipoCalculadora>;

export const DatosCliente = z.object({
  nombre: z.string().default(""),
  domicilio: z.string().default(""),
  localidad: z.string().default(""),
  telefono: z.string().default(""),
  email: z.string().default(""),
});
export type DatosCliente = z.infer<typeof DatosCliente>;

/**
 * Los precios base que usó ESTE presupuesto. Son los que no vienen de una línea
 * del catálogo sino de un campo suelto: el precio por metro de cerco, el precio
 * por m² de cobertor según el tramo, el costo de instalación.
 *
 * Se guarda como mapa abierto a propósito: cada calculadora tiene los suyos y
 * agregar uno nuevo no debería exigir migrar el esquema de los presupuestos ya
 * guardados.
 */
export const PreciosBase = z.record(z.string(), z.number().nullable());
export type PreciosBase = z.infer<typeof PreciosBase>;

export const PresupuestoV1 = z.object({
  v: z.literal(1),
  tipo: TipoCalculadora,
  fecha: z.string(),
  validezDias: z.string().default(""),
  cliente: DatosCliente,

  /** Medidas y opciones propias de cada tipo. Sin forma fija: es lo que cambia
   *  entre calculadoras y lo que el motor de precios recibe como entrada. */
  medidas: z.record(z.string(), z.unknown()).default({}),

  /** LA FOTO. Todas las líneas con su precio y su descripción congelados. */
  lineas: z.array(LineaPresupuesto).default([]),

  /** LA FOTO, parte dos: los precios sueltos que usó el cálculo. */
  preciosBase: PreciosBase.default({}),

  /** Los totales tal como se imprimieron, para poder reconstruir el documento
   *  sin volver a correr el motor. Si el motor cambia, el histórico no se mueve. */
  totales: z.array(z.number()).default([]),

  /** Texto libre que describe el trabajo. En el legacy es `dimension`. */
  detalle: z.string().default(""),

  /** Metadatos del documento que también son del presupuesto, no del catálogo. */
  variacionEncabezado: z.string().default("teal"),
  modoPrecio: z.enum(["sin", "con", "ambos"]).default("ambos"),

  /** Fotos: sólo la referencia, los bytes viven en Storage. */
  fotos: z
    .array(
      z.object({
        id: z.string(),
        caption: z.string().default(""),
        width: z.number().nullable().default(null),
        height: z.number().nullable().default(null),
        storageUrl: z.string().nullable().default(null),
      })
    )
    .default([]),
});
export type PresupuestoV1 = z.infer<typeof PresupuestoV1>;

/**
 * Un presupuesto anterior a la migración. No tiene `v` ni precios congelados.
 * Se lee, nunca se escribe: sólo existe para poder abrir lo que ya está guardado.
 */
export const PresupuestoV0 = z.looseObject({
  v: z.undefined().optional(),
});
export type PresupuestoV0 = Record<string, unknown>;

/** Qué versión tiene una fila de `presupuestos.datos`. */
export function versionDe(datos: unknown): 0 | 1 {
  if (datos && typeof datos === "object" && (datos as { v?: unknown }).v === 1) return 1;
  return 0;
}

/**
 * Si los importes de este presupuesto son los que se cotizaron, o se
 * recalcularon con el catálogo de hoy.
 *
 * La interfaz tiene que avisar cuando es `false`: sin eso, alguien reabre un
 * presupuesto viejo, ve otro total y no entiende por qué.
 */
export function tienePreciosCongelados(datos: unknown): boolean {
  return versionDe(datos) === 1;
}
