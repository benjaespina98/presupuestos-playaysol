import { createClient } from "@/lib/supabase";
import type { TipoCalculadora } from "@/lib/presupuestos";
import { esTextoCompartido } from "@/lib/domain/catalogo/categorias";
import { ItemCatalogo } from "@/lib/domain/catalogo/item";

// Actualiza (o crea, si no existía — caso losetas, que no tiene seed inicial)
// el precio/descripción permanente de un ítem de catálogo para TODOS los
// presupuestos futuros de ese tipo. Llamado únicamente cuando el usuario
// confirma el popup "actualizar para todos" en el blur de un campo de
// catálogo — nunca automáticamente.
export async function actualizarCatalogoItem(
  tipo: TipoCalculadora,
  clave: string,
  precio: number | null,
  descripcion?: string
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("catalogo_items").upsert(
    {
      tipo,
      clave,
      precio,
      ...(descripcion !== undefined ? { descripcion } : {}),
      updated_by: user?.id,
    },
    { onConflict: "tipo,clave" }
  );

  return { error };
}

export type CatalogoRow = {
  clave: string;
  precio: number | null;
  descripcion: string | null;
};

// Lee el catálogo compartido de un tipo. Es la contraparte de lectura de
// actualizarCatalogoItem/guardarTextosCompartidos: al abrir una calculadora,
// cada -calc.js aplica estos valores sobre los defaults, para que los precios de
// opcionales y los textos fijos/pie que otro usuario dejó como predeterminados se
// vean en los presupuestos nuevos de TODOS (antes esta tabla solo se escribía).
export async function obtenerCatalogo(tipo: TipoCalculadora): Promise<CatalogoRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("catalogo_items")
    .select("clave, precio, descripcion")
    .eq("tipo", tipo);
  if (error) {
    console.error("No se pudo leer el catálogo compartido", error);
    return [];
  }
  return (data ?? []) as CatalogoRow[];
}

// Guarda de una sola vez varios textos compartidos (texto legal + campos del pie),
// vía el botón "Guardar como predeterminado para todos". Reusa catalogo_items con
// claves reservadas ('__legal', '__footer_<campo>') y precio null.
export async function guardarTextosCompartidos(
  tipo: TipoCalculadora,
  entradas: { clave: string; descripcion: string }[]
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rows = entradas.map((e) => ({
    tipo,
    clave: e.clave,
    descripcion: e.descripcion,
    precio: null,
    updated_by: user?.id,
  }));

  const { error } = await supabase
    .from("catalogo_items")
    .upsert(rows, { onConflict: "tipo,clave" });

  return { error };
}

/* ─────────────────────────────────────────────────────────────────────────
 * Pantalla de Catálogo (Fase 4)
 *
 * Todo lo de acá abajo es capa nueva, para la pantalla de administración del
 * catálogo. Lee/escribe las mismas filas que el bloque de arriba, pero con
 * las columnas de `migration_catalogo_categorias.sql` (categoria, unidad,
 * activo, orden) — que el puente legacy ni conoce ni necesita.
 * ───────────────────────────────────────────────────────────────────────── */

const COLUMNAS_ITEM_CATALOGO =
  "id, tipo, clave, descripcion, precio, categoria, unidad, activo, orden, updated_at";

/**
 * Postgres devuelve 42703 ("undefined_column") cuando se pide una columna que
 * no existe. Es exactamente lo que pasa acá si alguien abre esta pantalla en
 * un ambiente donde todavía no corrió `migration_catalogo_categorias.sql`: el
 * código de Fase 4 no la cubre con datos inventados, la detecta y lo dice.
 */
function esErrorMigracionPendiente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42703") return true;
  return /column .*(categoria|unidad|activo|orden)/i.test(error.message ?? "");
}

export const ERROR_MIGRACION_PENDIENTE =
  "El catálogo todavía no tiene las columnas de categoría/unidad/estado. " +
  "Falta correr supabase/migration_catalogo_categorias.sql (ver docs/decisiones-tecnicas.md).";

export type ResultadoListarCatalogo =
  | { items: ItemCatalogo[]; error: null }
  | { items: null; error: string };

const ERROR_DE_RED =
  "No se pudo conectar con el catálogo. Revisá tu conexión a internet e intentá de nuevo.";

/** Todos los productos del catálogo (las 5 calculadoras juntas), sin las
 *  claves reservadas de texto compartido (`__legal`, `__footer_*`). La UI
 *  filtra/agrupa/ordena sobre esto con las funciones puras de
 *  lib/domain/catalogo/item.ts — acá sólo se trae el dato.
 *
 * Nunca rechaza la promesa: a diferencia de `listarTodosLosPresupuestos` (que
 * tira si Supabase falla), acá el error viaja en el resultado. Es a propósito
 * — así la pantalla no depende de acordarse de poner un `.catch()`, y una fila
 * que no valida contra `ItemCatalogo` (dato cargado a mano en Supabase que no
 * respeta la forma esperada) no tira abajo el resto del listado: se descarta
 * esa fila sola y se avisa por consola, no en pantalla. */
export async function listarItemsCatalogo(): Promise<ResultadoListarCatalogo> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("catalogo_items")
      .select(COLUMNAS_ITEM_CATALOGO);

    if (error) {
      if (esErrorMigracionPendiente(error)) {
        return { items: null, error: ERROR_MIGRACION_PENDIENTE };
      }
      return { items: null, error: error.message };
    }

    const filas = (data ?? []).filter((f) => !esTextoCompartido(f.clave as string));
    const items: ItemCatalogo[] = [];
    for (const fila of filas) {
      const resultado = ItemCatalogo.safeParse(fila);
      if (resultado.success) items.push(resultado.data);
      else console.error("Fila de catalogo_items con forma inesperada, se omite", fila, resultado.error);
    }
    return { items, error: null };
  } catch (err) {
    console.error("No se pudo leer el catálogo", err);
    return { items: null, error: ERROR_DE_RED };
  }
}

/** Lo que se puede cambiar desde la pantalla de Catálogo. `clave`/`tipo`
 *  quedan afuera a propósito: son la identidad de la fila — el puente legacy
 *  y los presupuestos existentes la referencian por ese par, y renombrarla
 *  rompería esa referencia sin que nada avise. */
export interface CambiosItemCatalogo {
  descripcion: string | null;
  precio: number | null;
  categoria: ItemCatalogo["categoria"];
  unidad: string | null;
  activo: boolean;
}

const SIN_FILA_AFECTADA =
  "No se pudo guardar: el ítem ya no existe en el catálogo (puede haber sido eliminado por otra persona).";

/**
 * Actualiza una fila existente por id (no upsert: en esta pantalla el ítem ya
 * existe, se está editando, no creando uno nuevo).
 *
 * Pide `.select("id")` después del update por el mismo motivo que
 * `actualizarPresupuesto` en lib/presupuestos.ts: si el `.eq("id", id)` no
 * matchea ninguna fila (por ejemplo, la borraron desde otro lado mientras se
 * editaba), Postgres/PostgREST devuelve `error: null` y cero filas afectadas.
 * Sin este chequeo, eso llegaría a la pantalla como "guardado" sin haber
 * guardado nada.
 */
export async function actualizarItemCatalogo(
  id: string,
  cambios: CambiosItemCatalogo
): Promise<{ error: string | null }> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("catalogo_items")
      .update({ ...cambios, updated_by: user?.id })
      .eq("id", id)
      .select("id");

    if (error) {
      if (esErrorMigracionPendiente(error)) return { error: ERROR_MIGRACION_PENDIENTE };
      return { error: error.message };
    }
    if (!data || data.length === 0) return { error: SIN_FILA_AFECTADA };
    return { error: null };
  } catch (err) {
    console.error("No se pudo guardar el ítem de catálogo", err);
    return { error: ERROR_DE_RED };
  }
}
