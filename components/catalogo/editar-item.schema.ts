import { z } from "zod";
import { Categoria, UNIDADES } from "@/lib/domain/catalogo/categorias";
import type { ItemCatalogo } from "@/lib/domain/catalogo/item";
import type { CambiosItemCatalogo } from "@/lib/catalogo";

/**
 * Forma del formulario de edición de un ítem de catálogo. Sólo valida FORMA
 * y restricciones de entrada — nada de esto es una fórmula de negocio, eso
 * sigue siendo enteramente de lib/domain/precios (ver decisión 8 en
 * docs/decisiones-tecnicas.md).
 *
 * `categoria`/`unidad` viajan como string (incluido "" para "sin elegir")
 * porque así es como responde un `<select>` nativo — RHF/Zod no tienen forma
 * de que un `<option>` valga `null`. `aFormulario`/`aCambios` son la única
 * traducción entre esa forma de UI y la forma real de la fila (`null`).
 */
export const EditarItemSchema = z.object({
  descripcion: z.string(),
  // No es una fórmula: es una restricción de entrada (un precio no puede ser
  // negativo), igual que "el campo es obligatorio". La aritmética de negocio
  // sigue viviendo enteramente en lib/domain/precios.
  precio: z.number().nonnegative("El precio no puede ser negativo").nullable(),
  categoria: z.union([Categoria, z.literal("")]),
  unidad: z.union([z.enum(UNIDADES), z.literal("")]),
  activo: z.boolean(),
  /** Si el ítem se guarda en el local. Tildado → `stock` es la cantidad. */
  llevaStock: z.boolean(),
  stock: z.number().int("El stock tiene que ser un número entero").nonnegative("El stock no puede ser negativo").nullable(),
});
export type EditarItemForm = z.infer<typeof EditarItemSchema>;

/** Fila → valores por defecto del form. */
export function aFormulario(item: ItemCatalogo): EditarItemForm {
  return {
    descripcion: item.descripcion ?? "",
    precio: item.precio,
    categoria: item.categoria ?? "",
    // Una unidad legacy fuera del enum (fila cargada a mano) no rompe el
    // form: cae a "sin elegir" en vez de un <option> inválido.
    unidad: (UNIDADES as readonly string[]).includes(item.unidad ?? "")
      ? (item.unidad as EditarItemForm["unidad"])
      : "",
    activo: item.activo,
    llevaStock: item.stock !== null,
    stock: item.stock,
  };
}

/** Form → lo que espera `actualizarItemCatalogo`. */
export function aCambios(form: EditarItemForm): CambiosItemCatalogo {
  return {
    descripcion: form.descripcion.trim() || null,
    precio: form.precio,
    categoria: form.categoria === "" ? null : form.categoria,
    unidad: form.unidad === "" ? null : form.unidad,
    activo: form.activo,
    // Sin tildar "Llevar stock" el ítem deja de llevarlo (null); tildado y sin
    // número, arranca en 0.
    stock: form.llevaStock ? (form.stock ?? 0) : null,
  };
}
