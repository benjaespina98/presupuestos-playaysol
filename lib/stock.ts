import { createClient } from "@/lib/supabase";
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
