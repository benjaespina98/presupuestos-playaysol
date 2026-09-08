import { z } from "zod";
import { Categoria, UNIDADES } from "@/lib/domain/catalogo/categorias";
import { TipoCalculadora } from "@/lib/domain/presupuesto/v1";
import type { NuevoItemCatalogo } from "@/lib/catalogo";

const TIPOS_CON_TITULO = TipoCalculadora.options;

/**
 * Forma del formulario de alta de un ítem — mismo criterio que
 * editar-item.schema.ts (categoria/unidad viajan como string, "" = sin
 * elegir), más `tipo`/`clave`: acá SÍ se cargan, porque recién se están
 * definiendo (en editar-item.schema.ts quedan afuera a propósito, ver el
 * comentario de `CambiosItemCatalogo`).
 *
 * `clave` es el identificador estable que van a usar los precios cableados
 * a mano en el código (`actualizarCatalogoItem`) y las claves reservadas de
 * texto — se normaliza a snake_case simple para que no dependa de que quien
 * carga el ítem ya conozca esa convención.
 */
export const NuevoItemSchema = z.object({
  tipo: TipoCalculadora,
  clave: z.string().min(1, "Ingresá una clave"),
  descripcion: z.string(),
  precio: z.number().nonnegative("El precio no puede ser negativo").nullable(),
  categoria: z.union([Categoria, z.literal("")]),
  unidad: z.union([z.enum(UNIDADES), z.literal("")]),
  activo: z.boolean(),
});
export type NuevoItemForm = z.infer<typeof NuevoItemSchema>;

/** `clave` normalizada a snake_case simple (sin tildes, sin espacios) — se
 *  aplica al mandar el form, no mientras se escribe, para no pelearle el
 *  cursor a quien está tipeando. */
function normalizarClave(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // saca tildes (marcas combinantes)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function nuevoItemFormVacio(): NuevoItemForm {
  return {
    tipo: TIPOS_CON_TITULO[0],
    clave: "",
    descripcion: "",
    precio: null,
    categoria: "",
    unidad: "",
    activo: true,
  };
}

/** Form → lo que espera `crearItemCatalogo`. Devuelve `clave: null` si, ya
 *  normalizada, queda vacía (p. ej. alguien tipeó sólo símbolos) — la
 *  pantalla lo trata como error de validación, no como un insert con clave
 *  vacía. */
export function aNuevoItem(form: NuevoItemForm): NuevoItemCatalogo | null {
  const clave = normalizarClave(form.clave);
  if (!clave) return null;
  return {
    tipo: form.tipo,
    clave,
    descripcion: form.descripcion.trim() || null,
    precio: form.precio,
    categoria: form.categoria === "" ? null : form.categoria,
    unidad: form.unidad === "" ? null : form.unidad,
    activo: form.activo,
  };
}
