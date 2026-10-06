/**
 * Precios de lista de piscinas COMPLETAS (hormigón por tamaño, fibra Indusplast).
 *
 * Viven en el catálogo de `piscinas` como cualquier ítem, pero NO son opcionales
 * del presupuesto: son el punto de partida del subtotal de construcción. Se
 * distinguen por el prefijo de la clave, así que dar de alta uno nuevo desde la
 * pantalla de Catálogo con ese prefijo alcanza para que aparezca en el selector
 * de la calculadora y bajo su filtro de línea en el Catálogo.
 */
export const LINEAS_PISCINA = [
  { id: "hormigon", etiqueta: "Hormigón", prefijo: "lista_hormigon_" },
  { id: "indusplast", etiqueta: "Indusplast", prefijo: "indusplast_" },
] as const;

export type LineaPiscina = (typeof LINEAS_PISCINA)[number]["id"];

export const PREFIJOS_LISTA_PISCINA = LINEAS_PISCINA.map((l) => l.prefijo);

export function esListaDePrecios(clave: string): boolean {
  return PREFIJOS_LISTA_PISCINA.some((p) => clave.startsWith(p));
}

/** La línea de una piscina completa (por el prefijo de su clave), o null si el
 *  ítem no es una piscina de lista. */
export function lineaDeClave(clave: string): LineaPiscina | null {
  return LINEAS_PISCINA.find((l) => clave.startsWith(l.prefijo))?.id ?? null;
}
