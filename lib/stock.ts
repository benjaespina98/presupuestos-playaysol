import { createClient } from "@/lib/supabase";
import { nombreCortoLista } from "@/lib/domain/catalogo/listas";
import type { MovimientoConItem } from "@/lib/domain/stock/resumen";
import {
  MovimientoStock,
  ResultadoStock,
  marcarAnulados,
  mensajeErrorStock,
  type MovimientoVista,
} from "@/lib/domain/stock/movimientos";

/**
 * Acceso a Supabase del stock con movimientos.
 *
 * El navegador NO escribe el stock: llama a tres funciones de la base
 * (registrar_movimiento_stock, ajustar_stock, anular_movimiento_stock) que
 * bloquean el ítem, calculan el saldo y son idempotentes por clave. Mismo
 * criterio que `lib/catalogo.ts`: nunca rechazan la promesa (el error viaja en el
 * resultado, ya traducido a castellano) y una respuesta con forma rara se trata
 * como error en vez de dar por buena una operación que no se sabe cómo salió.
 */

export type ResultadoOperacion = { resultado: ResultadoStock; error: null } | { resultado: null; error: string };

async function llamar(funcion: string, parametros: Record<string, unknown>): Promise<ResultadoOperacion> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc(funcion, parametros);
    if (error) return { resultado: null, error: mensajeErrorStock(error) };
    const r = ResultadoStock.safeParse(data);
    if (!r.success) {
      console.error(`La función ${funcion} respondió con una forma inesperada`);
      return { resultado: null, error: "El movimiento se registró, pero no se pudo leer la respuesta. Actualizá la pantalla." };
    }
    return { resultado: r.data, error: null };
  } catch (err) {
    console.error(`No se pudo llamar a ${funcion}`, err instanceof Error ? err.message : "error");
    return { resultado: null, error: mensajeErrorStock({ message: err instanceof Error ? err.message : "" }) };
  }
}

/** Ingreso o venta. `cantidad` es positiva: la base aplica el signo según el tipo. */
export function registrarMovimiento(p: {
  itemId: string;
  tipo: "ingreso" | "venta";
  cantidad: number;
  idempotencyKey: string;
  referencia?: string | null;
}): Promise<ResultadoOperacion> {
  return llamar("registrar_movimiento_stock", {
    p_item: p.itemId,
    p_tipo: p.tipo,
    p_cantidad: p.cantidad,
    p_idempotency_key: p.idempotencyKey,
    p_referencia: p.referencia ?? null,
    p_motivo: null,
  });
}

/** Ajuste por conteo: se manda lo CONTADO; la diferencia la calcula la base con el ítem bloqueado. */
export function ajustarConteo(p: { itemId: string; stockContado: number; motivo: string; idempotencyKey: string }): Promise<ResultadoOperacion> {
  return llamar("ajustar_stock", {
    p_item: p.itemId,
    p_stock_contado: p.stockContado,
    p_motivo: p.motivo,
    p_idempotency_key: p.idempotencyKey,
  });
}

/** Anula un movimiento con un contra-asiento. */
export function anularMovimiento(p: { movimientoId: string; motivo: string; idempotencyKey: string }): Promise<ResultadoOperacion> {
  return llamar("anular_movimiento_stock", {
    p_movimiento: p.movimientoId,
    p_motivo: p.motivo,
    p_idempotency_key: p.idempotencyKey,
  });
}

export type ResultadoHistorial = { movimientos: MovimientoVista[]; error: null } | { movimientos: null; error: string };

const COLUMNAS = "id, item_id, tipo, cantidad, stock_resultante, motivo, referencia, anula_a, creado_por, creado_at";

/** El historial de un ítem, del más nuevo al más viejo, con quién hizo cada movimiento. */
export async function listarMovimientos(itemId: string): Promise<ResultadoHistorial> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("movimientos_stock")
      .select(COLUMNAS)
      .eq("item_id", itemId)
      .order("creado_at", { ascending: false });
    if (error) return { movimientos: null, error: "No se pudo leer el historial. Probá de nuevo." };

    const movimientos: MovimientoStock[] = [];
    for (const fila of data ?? []) {
      const r = MovimientoStock.safeParse(fila);
      if (r.success) movimientos.push(r.data);
      else console.error("Fila de movimientos_stock con forma inesperada, se omite");
    }

    const ids = [...new Set(movimientos.map((m) => m.creado_por).filter((id): id is string => !!id))];
    const nombres = new Map<string, string>();
    if (ids.length > 0) {
      const { data: perfiles } = await supabase.from("perfiles").select("id, email, nombre").in("id", ids);
      for (const p of perfiles ?? []) nombres.set(p.id as string, ((p.nombre as string | null) || (p.email as string | null)) ?? "—");
    }
    return { movimientos: marcarAnulados(movimientos, nombres), error: null };
  } catch (err) {
    console.error("No se pudo leer el historial de stock", err instanceof Error ? err.message : "error");
    return { movimientos: null, error: mensajeErrorStock({ message: err instanceof Error ? err.message : "" }) };
  }
}

export type ResultadoMovimientosGeneral =
  | { movimientos: MovimientoConItem[]; truncado: boolean; error: null }
  | { movimientos: null; truncado: false; error: string };

/** Cuántos movimientos trae la pestaña Movimientos (los más nuevos). */
export const LIMITE_MOVIMIENTOS = 1000;

/** Todos los movimientos del local, del más nuevo al más viejo, con el modelo y quién los hizo. */
export async function listarMovimientosGeneral(): Promise<ResultadoMovimientosGeneral> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("movimientos_stock")
      .select(`${COLUMNAS}, catalogo_items(clave, descripcion)`)
      .order("creado_at", { ascending: false })
      .limit(LIMITE_MOVIMIENTOS);
    if (error) return { movimientos: null, truncado: false, error: "No se pudieron leer los movimientos. Probá de nuevo." };

    const filas = (data ?? []) as unknown as (Record<string, unknown> & { catalogo_items: { clave: string; descripcion: string | null } | { clave: string; descripcion: string | null }[] | null })[];
    const base: MovimientoStock[] = [];
    const nombres = new Map<string, string>();
    for (const fila of filas) {
      const r = MovimientoStock.safeParse(fila);
      if (!r.success) {
        console.error("Fila de movimientos_stock con forma inesperada, se omite");
        continue;
      }
      base.push(r.data);
      const it = Array.isArray(fila.catalogo_items) ? fila.catalogo_items[0] : fila.catalogo_items;
      if (it && !nombres.has(r.data.item_id)) nombres.set(r.data.item_id, nombreCortoLista(it.clave) ?? (it.descripcion || it.clave));
    }

    const ids = [...new Set(base.map((m) => m.creado_por).filter((id): id is string => !!id))];
    const personas = new Map<string, string>();
    if (ids.length > 0) {
      const { data: perfiles } = await supabase.from("perfiles").select("id, email, nombre").in("id", ids);
      for (const p of perfiles ?? []) personas.set(p.id as string, ((p.nombre as string | null) || (p.email as string | null)) ?? "—");
    }
    const movimientos = marcarAnulados(base, personas).map((m) => ({ ...m, itemNombre: nombres.get(m.item_id) ?? "Modelo sin nombre" }));
    return { movimientos, truncado: filas.length >= LIMITE_MOVIMIENTOS, error: null };
  } catch (err) {
    console.error("No se pudieron leer los movimientos de stock", err instanceof Error ? err.message : "error");
    return { movimientos: null, truncado: false, error: mensajeErrorStock({ message: err instanceof Error ? err.message : "" }) };
  }
}
