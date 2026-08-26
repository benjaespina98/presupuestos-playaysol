import type { LineaPresupuesto } from "../precios/tipos";

export interface AdicionalDesdeLinea {
  descripcion: string;
  precio: number;
}

/**
 * Los adicionales manuales ("cotiza") de un presupuesto ya leído, listos
 * para volver a poblar el array editable del formulario.
 *
 * Antes esta extracción sólo vivía en la rama `preciosCongelados` de cada
 * `formularioDesdePresupuesto` (piscinas/cercos/cobertores/revestimientos);
 * la rama "no congelados" la ignoraba directamente. Como `paraDuplicar()`
 * (ver adaptadores.ts) fuerza siempre `preciosCongelados: false`, duplicar
 * un presupuesto perdía sus adicionales aunque el original los tuviera.
 *
 * Usar esta misma función en las DOS ramas resuelve eso sin distinguir "es
 * un v0 real" de "es un v1 duplicado": un v0 real llega acá con
 * `lineas: []` (ver `leerPresupuesto`), así que sigue devolviendo `[]`
 * exactamente como antes — el contrato de v0 (nunca se inventan adicionales
 * que no se guardaron) no cambia.
 */
export function adicionalesDesdeLineas(lineas: LineaPresupuesto[]): AdicionalDesdeLinea[] {
  return lineas
    .filter((l) => l.naturaleza === "cotiza")
    .map((l) => ({ descripcion: l.descripcion, precio: l.precioUnitario ?? 0 }));
}
