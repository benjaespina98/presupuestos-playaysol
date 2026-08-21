import { z } from "zod";
import { TipoCalculadora } from "../presupuesto/v1";
import { CATEGORIA_POR_DEFECTO, CATEGORIAS, Categoria } from "./categorias";

/**
 * Una fila de `catalogo_items` tal como la necesita la pantalla de Catálogo
 * (Fase 4) — no la misma forma que usa el puente legacy (`CatalogoRow` en
 * lib/catalogo.ts), que sólo lee `clave/precio/descripcion` porque es lo único
 * que las calculadoras necesitan.
 *
 * `categoria`, `unidad`, `activo` y `orden` sólo existen si ya corrió
 * `supabase/migration_catalogo_categorias.sql` (Fase 2). El schema los pide
 * igual: el código de Fase 4 asume la migración aplicada, no se cubre "por las
 * dudas" con columnas opcionales — si falta, `lib/catalogo.ts` lo va a
 * detectar en la query y avisar en pantalla, no fingir datos que no están.
 */
export const ItemCatalogo = z.object({
  id: z.string(),
  tipo: TipoCalculadora,
  clave: z.string(),
  /** null = sin descripción cargada. Distinto de "" (raro, pero posible). */
  descripcion: z.string().nullable(),
  /** null = "a cotizar": el ítem existe pero no tiene precio fijo. */
  precio: z.number().nullable(),
  /** null = sin clasificar todavía; se trata como CATEGORIA_POR_DEFECTO al
   *  ordenar/filtrar, pero se distingue en la UI para poder completarla. */
  categoria: Categoria.nullable(),
  /** Texto informativo ("m²", "ml", "unidad", "obra"). Suelto a propósito
   *  (no el enum `Unidad`): una fila cargada a mano en Supabase con otro
   *  valor no tiene que romper el listado, sólo se ve rara. */
  unidad: z.string().nullable(),
  /** Si aparece en el listado de Catálogo. No afecta ningún cálculo ni a las
   *  calculadoras: `obtenerCatalogo()` (lib/catalogo.ts) no filtra por esto,
   *  como dice el comentario de la migración ("La pantalla lista por
   *  categoría y filtra los inactivos"). Es puramente un flag de la pantalla
   *  de administración, para dar de baja un material discontinuado sin
   *  borrar su fila (que rompería presupuestos viejos que la referencian por
   *  clave — ver PresupuestoV1). */
  activo: z.boolean(),
  /** Posición manual dentro de su categoría. null = sin orden explícito, se
   *  ordena alfabéticamente. */
  orden: z.number().nullable(),
  updated_at: z.string(),
});
export type ItemCatalogo = z.infer<typeof ItemCatalogo>;

/** La categoría con la que un ítem participa del listado/filtro, tratando
 *  "sin clasificar" como CATEGORIA_POR_DEFECTO. */
export function categoriaEfectiva(item: Pick<ItemCatalogo, "categoria">): Categoria {
  return item.categoria ?? CATEGORIA_POR_DEFECTO;
}

const INDICE_CATEGORIA = new Map(CATEGORIAS.map((c, i) => [c, i]));

/** Orden razonable para el listado: por categoría (en el orden acordado de
 *  Fase 2), después por `orden` manual (los sin orden van al final), después
 *  alfabético por descripción. Puro: no toca Supabase. */
export function ordenarCatalogo(items: ItemCatalogo[]): ItemCatalogo[] {
  return [...items].sort((a, b) => {
    const ca = INDICE_CATEGORIA.get(categoriaEfectiva(a))!;
    const cb = INDICE_CATEGORIA.get(categoriaEfectiva(b))!;
    if (ca !== cb) return ca - cb;

    const oa = a.orden ?? Number.POSITIVE_INFINITY;
    const ob = b.orden ?? Number.POSITIVE_INFINITY;
    if (oa !== ob) return oa - ob;

    return (a.descripcion ?? a.clave).localeCompare(b.descripcion ?? b.clave, "es");
  });
}

export interface FiltroCatalogo {
  busqueda?: string;
  categoria?: Categoria | null;
  /** default false: por default el listado no muestra los dados de baja. */
  incluirInactivos?: boolean;
}

/** Búsqueda + filtro por categoría + inactivos, todo en un solo paso porque
 *  siempre se aplican juntos en la pantalla de listado. Busca en descripción
 *  y clave (a veces la descripción está vacía y la clave es lo único legible). */
export function filtrarCatalogo(items: ItemCatalogo[], filtro: FiltroCatalogo): ItemCatalogo[] {
  const q = filtro.busqueda?.trim().toLowerCase() ?? "";
  return items.filter((item) => {
    if (!filtro.incluirInactivos && !item.activo) return false;
    if (filtro.categoria && categoriaEfectiva(item) !== filtro.categoria) return false;
    if (q) {
      const enDescripcion = (item.descripcion ?? "").toLowerCase().includes(q);
      const enClave = item.clave.toLowerCase().includes(q);
      if (!enDescripcion && !enClave) return false;
    }
    return true;
  });
}
