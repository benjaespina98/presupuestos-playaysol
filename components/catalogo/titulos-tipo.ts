import type { TipoCalculadora } from "@/lib/presupuestos";

/** Nombre para mostrar de cada calculadora, para la pantalla de Catálogo
 *  (listado + modal de edición). Historial tiene su propia copia local — acá
 *  se comparte entre page.tsx y EditarItemModal.tsx porque son dos archivos
 *  de la misma pantalla, no dos pantallas distintas. */
export const TITULOS_TIPO: Record<TipoCalculadora, string> = {
  piscinas: "Piscinas",
  cercos: "Cercos",
  cobertores: "Cobertores",
  losetas: "Plano de Piscina",
  revestimientos: "Revestimientos",
};
