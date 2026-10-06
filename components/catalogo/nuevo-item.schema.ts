import { z } from "zod";
import { Categoria, UNIDADES } from "@/lib/domain/catalogo/categorias";
import { TipoCalculadora } from "@/lib/domain/presupuesto/v1";
import type { NuevoItemCatalogo } from "@/lib/catalogo";
import { datosPiscinaHormigon, datosPiscinaIndusplast } from "@/lib/domain/catalogo/listas";

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
/** Qué se agrega: una piscina de hormigón o de fibra Indusplast (la clave, la categoría y la unidad se arman solas) u otro ítem. */
export const TIPOS_ALTA = ["otro", "hormigon", "indusplast"] as const;
export type TipoAlta = (typeof TIPOS_ALTA)[number];

export const NuevoItemSchema = z.object({
  alta: z.enum(TIPOS_ALTA),
  /** Piscina de hormigón: medidas en metros. */
  largo: z.number().nonnegative("No puede ser negativo").nullable(),
  ancho: z.number().nonnegative("No puede ser negativo").nullable(),
  /** Piscina Indusplast: modelo ("caribe") y medida ("750"). */
  modelo: z.string(),
  medida: z.number().nonnegative("No puede ser negativo").nullable(),
  tipo: TipoCalculadora,
  // Opcional: vacía, se arma con la descripción.
  clave: z.string(),
  descripcion: z.string(),
  precio: z.number().nonnegative("El precio no puede ser negativo").nullable(),
  categoria: z.union([Categoria, z.literal("")]),
  unidad: z.union([z.enum(UNIDADES), z.literal("")]),
  activo: z.boolean(),
  /** Si el ítem se guarda en el local. Tildado → `stock` es la cantidad. */
  llevaStock: z.boolean(),
  stock: z.number().int("El stock tiene que ser un número entero").nonnegative("El stock no puede ser negativo").nullable(),
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
    alta: "otro",
    largo: null,
    ancho: null,
    modelo: "caribe",
    medida: null,
    tipo: TIPOS_CON_TITULO[0],
    clave: "",
    descripcion: "",
    precio: null,
    categoria: "",
    unidad: "",
    activo: true,
    llevaStock: false,
    stock: null,
  };
}

/** Los datos que se arman solos al agregar una piscina (clave, descripción, nombre en la planilla), o null si faltan datos. */
export function datosDeAlta(form: NuevoItemForm): { clave: string; descripcion: string; medida: string } | null {
  if (form.alta === "hormigon") return datosPiscinaHormigon(form.largo ?? 0, form.ancho ?? 0);
  if (form.alta === "indusplast") return datosPiscinaIndusplast(form.modelo, form.medida ?? 0);
  return null;
}

/** Form → lo que espera `crearItemCatalogo`. Devuelve null si falta algo para armarlo (medidas de una
 *  piscina, o una clave/descripción de la que sacar la clave) — la pantalla lo trata como error de validación. */
export function aNuevoItem(form: NuevoItemForm): NuevoItemCatalogo | null {
  const stock = form.llevaStock ? (form.stock ?? 0) : null;
  if (form.alta !== "otro") {
    const piscina = datosDeAlta(form);
    if (!piscina) return null;
    return {
      tipo: "piscinas",
      clave: piscina.clave,
      descripcion: piscina.descripcion,
      precio: form.precio,
      categoria: "Piscinas",
      unidad: "obra",
      activo: form.activo,
      stock,
    };
  }
  // Sin clave escrita, sale de la descripción.
  const clave = normalizarClave(form.clave) || normalizarClave(form.descripcion);
  if (!clave) return null;
  return {
    tipo: form.tipo,
    clave,
    descripcion: form.descripcion.trim() || null,
    precio: form.precio,
    categoria: form.categoria === "" ? null : form.categoria,
    unidad: form.unidad === "" ? null : form.unidad,
    activo: form.activo,
    stock,
  };
}
