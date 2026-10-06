/**
 * Precios de lista de piscinas COMPLETAS (hormigón por tamaño, fibra Indusplast).
 *
 * Viven en el catálogo de `piscinas` como cualquier ítem, pero NO son opcionales
 * del presupuesto: son el punto de partida del subtotal de construcción. Se
 * distinguen por el prefijo de la clave, así que dar de alta uno nuevo desde la
 * pantalla de Catálogo con ese prefijo alcanza para que aparezca en el selector.
 */
export const PREFIJOS_LISTA_PISCINA = ["lista_hormigon_", "indusplast_"] as const;

export function esListaDePrecios(clave: string): boolean {
  return PREFIJOS_LISTA_PISCINA.some((p) => clave.startsWith(p));
}
