/**
 * Anular en lugar de borrar (presupuestos y pedidos).
 *
 * La regla de fondo vive en la base (supabase/migrations/20261021000200_anulacion.sql):
 * el motivo tiene que tener entre 3 y 500 caracteres, `anulado_at` y `anulado_por`
 * los fija el servidor, y un registro anulado no se puede modificar. Esto es la
 * parte del cliente: validar antes de mandar, esconder lo anulado por defecto y
 * traducir los errores de la base a un mensaje entendible.
 */

import { z } from "zod";

export const MOTIVO_MIN = 3;
export const MOTIVO_MAX = 500;

export const MotivoAnulacion = z
  .string()
  .trim()
  .min(MOTIVO_MIN, `Escribí el motivo (al menos ${MOTIVO_MIN} caracteres).`)
  .max(MOTIVO_MAX, `El motivo es demasiado largo (máximo ${MOTIVO_MAX} caracteres).`);

export type ResultadoMotivo = { motivo: string; error: null } | { motivo: null; error: string };

/** El motivo ya recortado, o el mensaje de por qué no sirve. */
export function validarMotivo(texto: string): ResultadoMotivo {
  const r = MotivoAnulacion.safeParse(texto);
  if (r.success) return { motivo: r.data, error: null };
  return { motivo: null, error: r.error.issues[0]?.message ?? "El motivo no es válido." };
}

/** Lo mínimo que hace falta saber de un registro para decir si está anulado. */
export interface PuedeEstarAnulado {
  anulado_at?: string | null;
}

export function estaAnulado(registro: PuedeEstarAnulado): boolean {
  return !!registro.anulado_at;
}

/** Por defecto la lista no muestra lo anulado; con `mostrarAnulados` aparece junto al resto. */
export function filtrarAnulados<T extends PuedeEstarAnulado>(items: readonly T[], mostrarAnulados: boolean): T[] {
  return mostrarAnulados ? [...items] : items.filter((i) => !estaAnulado(i));
}

export function contarAnulados(items: readonly PuedeEstarAnulado[]): number {
  return items.filter(estaAnulado).length;
}

const YA_ANULADO = "Este registro ya está anulado y no se puede modificar.";

/**
 * Traduce el error que devuelve la base (triggers de anulación) a un mensaje
 * para la persona. Lo que no reconoce lo devuelve tal cual.
 */
export function mensajeDeErrorAnulacion(mensaje: string | null | undefined): string {
  const m = mensaje ?? "";
  if (/est[aá] anulado/i.test(m)) return YA_ANULADO;
  if (/motivo/i.test(m)) return `Para anular hace falta un motivo de entre ${MOTIVO_MIN} y ${MOTIVO_MAX} caracteres.`;
  return m || "No se pudo anular.";
}
