import { z } from "zod";
import { TipoCalculadora } from "../presupuesto/v1";
import { CATEGORIA_POR_DEFECTO, CATEGORIAS, Categoria } from "./categorias";
import { lineaDeClave, MODELOS_INDUSPLAST, modeloIndusplast, ordenMedida, type LineaPiscina } from "./listas";

/** Qué clase de producto ver: una línea de piscinas completas, o "otros" (todo lo
 *  que no es una piscina de lista: opcionales, cercos, cobertores...). */
export type VistaCatalogo = LineaPiscina | "otros";

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
  /** Si el ítem está vigente. Dado de baja (false) deja de ofrecerse en el
   *  listado de Catálogo y como opcional/material de las calculadoras (ver
   *  `disponibleEnCalculadora`). No se borra la fila: presupuestos viejos la
   *  referencian por clave (ver PresupuestoV1) y siguen mostrándola. No
   *  afecta ningún cálculo. */
  activo: z.boolean(),
  /** Posición manual dentro de su categoría. null = sin orden explícito, se
   *  ordena alfabéticamente. */
  orden: z.number().nullable(),
  /** Unidades físicas en el local. null = el ítem no lleva stock (se pide a
   *  pedido: hierros, luces...); 0 = lleva stock y está agotado. Sólo existe si
   *  corrió `supabase/migration_stock_piscinas.sql`; sin ella llega como null. */
  stock: z.number().int().nonnegative().nullable().default(null),
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

/**
 * Agrupa una lista YA ORDENADA (ver `ordenarCatalogo`) en bloques
 * consecutivos por categoría efectiva, preservando el orden. Sirve para
 * pintar un encabezado por categoría en vez de repetir la columna
 * "Categoría" en cada fila — más rápido de escanear con la vista llena de
 * ítems. No reordena nada: si `items` no viene ya ordenado por categoría,
 * el mismo nombre de categoría puede aparecer en más de un grupo.
 */
export function agruparPorCategoria(items: ItemCatalogo[]): { categoria: Categoria; items: ItemCatalogo[] }[] {
  const grupos: { categoria: Categoria; items: ItemCatalogo[] }[] = [];
  for (const item of items) {
    const categoria = categoriaEfectiva(item);
    const actual = grupos[grupos.length - 1];
    if (actual && actual.categoria === categoria) actual.items.push(item);
    else grupos.push({ categoria, items: [item] });
  }
  return grupos;
}

/**
 * Texto listo para pegar en WhatsApp ("Modo consulta rápida", punto 6):
 * `Cerco perimetral con instalación: $79.500/ml` o `Baño químico: a cotizar`.
 * Pura — separada del botón "Copiar" para poder testearla sin
 * `navigator.clipboard`, que no existe en todos los entornos de test.
 */
export function textoParaCopiar(
  item: Pick<ItemCatalogo, "descripcion" | "clave" | "precio" | "unidad"> & { stock?: number | null },
  formatearPrecio: (n: number) => string
): string {
  const nombre = item.descripcion || item.clave;
  const precio = item.precio === null ? "a cotizar" : formatearPrecio(item.precio) + (item.unidad ? `/${item.unidad}` : "");
  const stock = llevaStock(item) ? ` · ${textoStock(item.stock)}` : "";
  return `${nombre}: ${precio}${stock}`;
}

/** ¿Este ítem se guarda en el local? (stock null = no, se pide a pedido). */
export function llevaStock(item: { stock?: number | null }): item is { stock: number } {
  return item.stock !== null && item.stock !== undefined;
}

/** "Sin stock" / "1 en stock" / "3 en stock": para pegar en WhatsApp o mostrar. */
export function textoStock(stock: number): string {
  return stock <= 0 ? "sin stock" : `${stock} en stock`;
}

/** Filtro por disponibilidad: con unidades, agotado (lleva stock y hay 0) o
 *  "no lleva stock" (se pide a pedido). */
export type FiltroStock = "disponible" | "agotado" | "sin-control";

export function coincideStock(item: { stock?: number | null }, filtro: FiltroStock): boolean {
  if (!llevaStock(item)) return filtro === "sin-control";
  return filtro === "disponible" ? item.stock > 0 : filtro === "agotado" ? item.stock === 0 : false;
}

/** Resumen del stock de un conjunto de ítems: cuántos modelos lo llevan, cuántos
 *  tienen unidades y el total de unidades. Los que no llevan stock no cuentan. */
export function resumenStock(items: { stock?: number | null }[]): { modelos: number; conUnidades: number; unidades: number } {
  let modelos = 0;
  let conUnidades = 0;
  let unidades = 0;
  for (const it of items) {
    if (!llevaStock(it)) continue;
    modelos++;
    if (it.stock > 0) conUnidades++;
    unidades += it.stock;
  }
  return { modelos, conUnidades, unidades };
}

export interface FiltroCatalogo {
  busqueda?: string;
  categoria?: Categoria | null;
  /** Sólo las piscinas completas de esa línea (hormigón / Indusplast), o "otros"
   *  para todo lo que no es una piscina de lista. */
  linea?: VistaCatalogo | null;
  /** Sólo los ítems de esa calculadora. null/undefined = todas. */
  tipo?: ItemCatalogo["tipo"] | null;
  /** Disponibilidad: con unidades / agotado / no lleva stock. null = todos. */
  stock?: FiltroStock | null;
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
    if (filtro.tipo && item.tipo !== filtro.tipo) return false;
    if (filtro.linea === "otros") {
      if (lineaDeClave(item.clave)) return false;
    } else if (filtro.linea && lineaDeClave(item.clave) !== filtro.linea) return false;
    if (filtro.stock && !coincideStock(item, filtro.stock)) return false;
    if (q) {
      const enDescripcion = (item.descripcion ?? "").toLowerCase().includes(q);
      const enClave = item.clave.toLowerCase().includes(q);
      if (!enDescripcion && !enClave) return false;
    }
    return true;
  });
}

/**
 * Cuántos ítems hay por categoría después de aplicar el resto de los filtros
 * (búsqueda, calculadora, inactivos) — ignora a propósito el filtro de
 * categoría: son los contadores de los chips, que le dicen al usuario cuánto
 * encontraría si eligiera cada uno. Sólo trae las categorías con al menos un
 * ítem. `total` es la suma de todas.
 */
export function contarPorCategoria(
  items: ItemCatalogo[],
  filtro: Omit<FiltroCatalogo, "categoria">
): { total: number; porCategoria: Partial<Record<Categoria, number>> } {
  const porCategoria: Partial<Record<Categoria, number>> = {};
  const coincidentes = filtrarCatalogo(items, { ...filtro, categoria: null });
  for (const item of coincidentes) {
    const c = categoriaEfectiva(item);
    porCategoria[c] = (porCategoria[c] ?? 0) + 1;
  }
  return { total: coincidentes.length, porCategoria };
}

/** Cuántas piscinas completas hay por línea, con el resto de los filtros
 *  aplicados (ignora el de línea, como `contarPorCategoria` ignora el de
 *  categoría). Sólo trae las líneas que tienen algo. */
export function contarPorLinea(
  items: ItemCatalogo[],
  filtro: Omit<FiltroCatalogo, "linea">
): Partial<Record<VistaCatalogo, number>> {
  const conteo: Partial<Record<VistaCatalogo, number>> = {};
  for (const item of filtrarCatalogo(items, { ...filtro, linea: null })) {
    const l: VistaCatalogo = lineaDeClave(item.clave) ?? "otros";
    conteo[l] = (conteo[l] ?? 0) + 1;
  }
  return conteo;
}

export interface GrupoListado {
  /** Identificador estable del bloque (para las keys). */
  id: string;
  titulo: string;
  items: ItemCatalogo[];
}

/**
 * Los bloques del listado. Las piscinas completas van primero y cada modelo en
 * su bloque, de menor a mayor tamaño ("Indusplast · Caribe", "Hormigón"); lo
 * demás (opcionales, cercos...) sigue agrupado por categoría. Así las piscinas
 * ya no quedan mezcladas con kits y opcionales dentro de "Piscinas".
 *
 * Recibe la lista ya ordenada (`ordenarCatalogo`) y no reordena el resto.
 */
export function agruparParaListado(items: ItemCatalogo[]): GrupoListado[] {
  const grupos: GrupoListado[] = [];

  const fibra = items.filter((i) => lineaDeClave(i.clave) === "indusplast");
  const modelos = [...new Set(fibra.map((i) => modeloIndusplast(i.clave) ?? "Otros modelos"))];
  const posicion = (m: string) => {
    const k = MODELOS_INDUSPLAST.indexOf(m.toLowerCase() as (typeof MODELOS_INDUSPLAST)[number]);
    return k === -1 ? MODELOS_INDUSPLAST.length : k;
  };
  modelos.sort((a, b) => posicion(a) - posicion(b));
  for (const modelo of modelos) {
    const delModelo = fibra.filter((i) => (modeloIndusplast(i.clave) ?? "Otros modelos") === modelo);
    grupos.push({ id: `indusplast-${modelo}`, titulo: `Indusplast · ${modelo}`, items: [...delModelo].sort((a, b) => ordenMedida(a.clave) - ordenMedida(b.clave)) });
  }

  const hormigon = items.filter((i) => lineaDeClave(i.clave) === "hormigon");
  if (hormigon.length > 0) {
    grupos.push({ id: "hormigon", titulo: "Hormigón · precio de lista", items: [...hormigon].sort((a, b) => ordenMedida(a.clave) - ordenMedida(b.clave)) });
  }

  for (const g of agruparPorCategoria(items.filter((i) => !lineaDeClave(i.clave)))) {
    grupos.push({ id: `categoria-${g.categoria}`, titulo: g.categoria, items: g.items });
  }
  return grupos;
}

/** Cuántos ítems hay por disponibilidad, con el resto de los filtros aplicados
 *  (ignora el de stock, como `contarPorCategoria` ignora el de categoría). */
export function contarPorStock(items: ItemCatalogo[], filtro: Omit<FiltroCatalogo, "stock">): Record<FiltroStock, number> {
  const conteo: Record<FiltroStock, number> = { disponible: 0, agotado: 0, "sin-control": 0 };
  for (const item of filtrarCatalogo(items, { ...filtro, stock: null })) {
    for (const f of Object.keys(conteo) as FiltroStock[]) if (coincideStock(item, f)) conteo[f]++;
  }
  return conteo;
}

/**
 * ¿Se ofrece este ítem al armar un presupuesto NUEVO? Un ítem dado de baja
 * (`activo === false`) deja de ofrecerse, pero se conserva si el presupuesto
 * que se está reabriendo ya lo tenía incluido (`clavesAMantener`): dar de baja
 * un material no puede hacer desaparecer una línea de un presupuesto viejo.
 *
 * `activo` undefined (fila leída por una versión que no lo traía) cuenta como
 * activo. Sólo se aplica a opcionales/materiales: los precios base se leen por
 * clave y no se filtran, así que dar de baja uno no los pone en $0.
 */
export function disponibleEnCalculadora(
  fila: { clave: string; activo?: boolean },
  clavesAMantener: readonly string[] = []
): boolean {
  return fila.activo !== false || clavesAMantener.includes(fila.clave);
}

/**
 * Los precios base de cada calculadora (cercos, cobertores). Las calculadoras
 * los leen por clave: si faltaran, el precio caería a $0. Por eso no se pueden
 * eliminar desde el Catálogo (sí editar el precio).
 */
export const CLAVES_PRECIO_BASE = [
  "precioSin",
  "precioCon",
  "precioMenos15",
  "precioMas15",
  "precioInstalacion",
] as const;

export function esPrecioBase(clave: string): boolean {
  return (CLAVES_PRECIO_BASE as readonly string[]).includes(clave);
}
