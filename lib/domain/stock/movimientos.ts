import { z } from "zod";

/**
 * Lógica pura del libro de movimientos de stock (sin red ni React).
 *
 * El libro vive en la base (supabase/migrations/20261022000100_stock_movimientos.sql):
 * sólo se agregan filas, y corregir es agregar otra (ajuste o anulación). Acá
 * están las piezas que usan la pantalla y la capa de datos: tipos, etiquetas,
 * validación de lo que se tipea, qué movimientos se pueden anular y cómo se
 * traducen los errores de la base.
 */

export const TIPOS_MOVIMIENTO = ["apertura", "ingreso", "venta", "ajuste", "anulacion"] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

export const ETIQUETA_TIPO: Record<TipoMovimiento, string> = {
  apertura: "Stock inicial",
  ingreso: "Ingreso",
  venta: "Venta",
  ajuste: "Ajuste de conteo",
  anulacion: "Anulación",
};

export const CANTIDAD_MAX = 10_000;
export const MOTIVO_MIN = 3;
export const MOTIVO_MAX = 500;
export const REFERENCIA_MAX = 200;

/** Una fila del libro tal como la lee la pantalla. */
export const MovimientoStock = z.object({
  id: z.string(),
  item_id: z.string(),
  tipo: z.enum(TIPOS_MOVIMIENTO),
  cantidad: z.number().int(),
  stock_resultante: z.number().int(),
  motivo: z.string().nullable(),
  referencia: z.string().nullable(),
  anula_a: z.string().nullable(),
  creado_por: z.string().nullable(),
  creado_at: z.string(),
});
export type MovimientoStock = z.infer<typeof MovimientoStock>;

/** Lo que devuelven las tres funciones de la base. */
export const ResultadoStock = z.object({
  /** null cuando un ajuste no cambió nada (el conteo coincidía): no se crea movimiento. */
  movimiento_id: z.string().nullable(),
  tipo: z.enum(TIPOS_MOVIMIENTO),
  cantidad: z.number().int(),
  stock_resultante: z.number().int(),
  stock_negativo: z.boolean(),
  repetido: z.boolean(),
});
export type ResultadoStock = z.infer<typeof ResultadoStock>;

/** Un movimiento con lo que la pantalla necesita saber: si fue anulado y si es un contra-asiento. */
export interface MovimientoVista extends MovimientoStock {
  /** Otro movimiento (una anulación) lo dejó sin efecto. */
  anulado: boolean;
  creadorNombre: string | null;
}

/** Marca como anulados los movimientos que tienen una anulación apuntándoles. */
export function marcarAnulados(movimientos: readonly MovimientoStock[], nombres: ReadonlyMap<string, string> = new Map()): MovimientoVista[] {
  const anulados = new Set(movimientos.map((m) => m.anula_a).filter((id): id is string => !!id));
  return movimientos.map((m) => ({
    ...m,
    anulado: anulados.has(m.id),
    creadorNombre: m.creado_por ? (nombres.get(m.creado_por) ?? null) : null,
  }));
}

/** ¿Se puede anular? No las anulaciones, no las aperturas (se corrigen con un ajuste) ni lo ya anulado. */
export function esAnulable(m: Pick<MovimientoVista, "tipo" | "anulado">): boolean {
  return (m.tipo === "ingreso" || m.tipo === "venta" || m.tipo === "ajuste") && !m.anulado;
}

/** Por qué NO se puede anular (para mostrarlo en lugar del botón), o null si se puede. */
export function motivoNoAnulable(m: Pick<MovimientoVista, "tipo" | "anulado">): string | null {
  if (m.anulado) return "Ya anulado";
  if (m.tipo === "anulacion") return "Es una anulación";
  if (m.tipo === "apertura") return "Se corrige con un ajuste";
  return null;
}

export type ResultadoNumero = { valor: number; error: null } | { valor: null; error: string };

/** Lo que se tipea en "cantidad": un entero de 1 al tope. Acepta espacios alrededor. */
export function parsearCantidad(texto: string): ResultadoNumero {
  const t = texto.trim();
  if (!t) return { valor: null, error: "Escribí la cantidad." };
  if (!/^\d+$/.test(t)) return { valor: null, error: "La cantidad tiene que ser un número entero, sin decimales ni signo." };
  const n = Number(t);
  if (n < 1) return { valor: null, error: "La cantidad tiene que ser al menos 1." };
  if (n > CANTIDAD_MAX) return { valor: null, error: `La cantidad no puede pasar de ${CANTIDAD_MAX}.` };
  return { valor: n, error: null };
}

/** Lo que se tipea en "conteo": un entero de 0 en adelante. */
export function parsearConteo(texto: string): ResultadoNumero {
  const t = texto.trim();
  if (!t) return { valor: null, error: "Escribí cuántas unidades contaste (0 si no hay)." };
  if (!/^\d+$/.test(t)) return { valor: null, error: "El conteo tiene que ser un número entero de 0 en adelante." };
  const n = Number(t);
  if (n > 1_000_000) return { valor: null, error: "Ese conteo es demasiado grande." };
  return { valor: n, error: null };
}

/** ¿Vender `cantidad` deja el stock por debajo de 0? (Se permite, pero se pide confirmar.) */
export function ventaDejaNegativo(stock: number, cantidad: number): boolean {
  return stock - cantidad < 0;
}

/** Cuánto va a cambiar el stock con un conteo: positivo suma, negativo resta, 0 no hace nada. */
export function diferenciaDeConteo(stockActual: number, conteo: number): number {
  return conteo - stockActual;
}

/** "+3", "−2" (con el signo menos tipográfico) o "0". */
export function cantidadConSigno(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return "0";
}

export function validarMotivo(texto: string): { motivo: string; error: null } | { motivo: null; error: string } {
  const t = texto.trim();
  if (t.length < MOTIVO_MIN) return { motivo: null, error: `Escribí el motivo (al menos ${MOTIVO_MIN} caracteres).` };
  if (t.length > MOTIVO_MAX) return { motivo: null, error: `El motivo es demasiado largo (máximo ${MOTIVO_MAX} caracteres).` };
  return { motivo: t, error: null };
}

export function validarReferencia(texto: string): { referencia: string | null; error: null } | { referencia: null; error: string } {
  const t = texto.trim();
  if (t.length > REFERENCIA_MAX) return { referencia: null, error: `La referencia es demasiado larga (máximo ${REFERENCIA_MAX} caracteres).` };
  return { referencia: t || null, error: null };
}

/** Una clave nueva para una operación de stock (se genera una vez por diálogo y se reusa en los reintentos). */
export function nuevaClaveIdempotencia(): string {
  return crypto.randomUUID();
}

const SIN_CONEXION = "No se pudo conectar. Revisá tu conexión a internet e intentá de nuevo.";
const GENERICO = "No se pudo registrar el movimiento. Probá de nuevo.";

/**
 * Traduce el error de la base a un mensaje claro en castellano. Nunca devuelve
 * texto interno de Postgres: lo que no reconoce cae en un mensaje genérico.
 * Los códigos ST0xx los definen las funciones de la migración.
 */
export function mensajeErrorStock(error: { code?: string | null; message?: string | null } | null | undefined): string {
  if (!error) return GENERICO;
  switch (error.code) {
    case "ST002":
      return "Ese ítem o ese movimiento ya no existe. Actualizá la pantalla.";
    case "ST003":
      return "Este ítem no lleva stock.";
    case "ST004":
      return "Revisá los datos: algo no es válido (cantidad, motivo o referencia).";
    case "ST005":
      return "Esa operación ya se había registrado con otros datos. Cerrá el diálogo y volvé a empezar.";
    case "ST006":
      return "Una anulación o un stock inicial no se anula: para corregir el stock usá «Ajustar conteo».";
    case "ST007":
      return "Ese movimiento ya fue anulado.";
    case "ST010":
      return "El stock no se cambia directamente: usá Ingreso, Venta o Ajustar conteo.";
    case "ST011":
      return "Un ítem nuevo no puede crearse con stock: cargá las unidades con un Ingreso.";
    case "42501":
      return "No tenés permiso para hacer esto o se venció tu sesión. Volvé a iniciar sesión.";
    case "PGRST202":
    case "42883":
      return "Falta aplicar la actualización de la base de datos del stock.";
    default:
      break;
  }
  const m = (error.message ?? "").toLowerCase();
  if (!error.code && (m.includes("fetch") || m.includes("network") || m.includes("conexi"))) return SIN_CONEXION;
  return GENERICO;
}
