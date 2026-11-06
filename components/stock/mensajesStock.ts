import type { ResultadoStock } from "@/lib/domain/stock/movimientos";

/**
 * Qué se le dice a la persona cuando una operación de stock terminó bien. `exito` es el aviso normal y `aviso` el que
 * pide atención (el stock quedó negativo); nunca vienen los dos. Lo usan las pantallas que mueven stock (Stock y la
 * edición de un ítem en Precios), para que digan lo mismo.
 */
export function mensajeDeStock(nombre: string, r: ResultadoStock): { exito: string | null; aviso: string | null } {
  if (r.movimiento_id === null) {
    return { exito: `El conteo de "${nombre}" coincidía con el stock cargado: no hubo cambios.`, aviso: null };
  }
  if (r.repetido) {
    return { exito: `Esa operación de "${nombre}" ya estaba registrada: no se repitió.`, aviso: null };
  }
  if (r.stock_negativo) {
    return {
      exito: null,
      aviso: `"${nombre}" quedó en stock negativo (−${Math.abs(r.stock_resultante)}). Revisá el conteo o cargá el ingreso que falta.`,
    };
  }
  return { exito: `Stock de "${nombre}": ${r.stock_resultante}.`, aviso: null };
}
