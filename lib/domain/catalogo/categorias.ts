import { z } from "zod";

/**
 * Rubros comerciales del catálogo de precios.
 *
 * Sirven para agrupar la pantalla de Catálogo. NO participan de ningún cálculo:
 * el catálogo describe y precia ítems, los motores de dominio calculan. Cambiar
 * la categoría de un producto no puede mover el total de un presupuesto.
 */
export const CATEGORIAS = [
  "Piscinas",
  "Filtración",
  "Revestimientos",
  "Iluminación",
  "Cobertores",
  "Cercos",
  "Accesorios",
  "Mano de obra",
  "Otros",
] as const;

export const Categoria = z.enum(CATEGORIAS);
export type Categoria = z.infer<typeof Categoria>;

/** Cuando una fila no tiene categoría asignada. */
export const CATEGORIA_POR_DEFECTO: Categoria = "Otros";

/**
 * Unidades en las que se cotiza un ítem. Es texto informativo que se imprime
 * junto al precio; no interviene en la cuenta.
 */
export const UNIDADES = ["m²", "ml", "unidad", "obra"] as const;
export type Unidad = (typeof UNIDADES)[number];

/**
 * Las claves reservadas que `catalogo_items` usa para guardar los textos
 * compartidos del documento (el aviso legal y los campos del pie). NO son
 * productos: la pantalla de Catálogo tiene que excluirlas.
 *
 * Convivir en la misma tabla no es lo ideal, pero separarlas exigiría migrar
 * datos existentes. Mientras tanto, este predicado es el único lugar donde vive
 * la regla.
 */
export function esTextoCompartido(clave: string): boolean {
  return clave.startsWith("__");
}

/** Sólo los productos: lo que se muestra en la pantalla de Catálogo. */
export function soloProductos<T extends { clave: string }>(filas: T[]): T[] {
  return filas.filter((f) => !esTextoCompartido(f.clave));
}
