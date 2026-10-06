import { createClient } from "@/lib/supabase";
import {
  PedidoGuardado,
  type EstadoPedido,
  type LineaGuardada,
} from "@/lib/domain/abastecimiento/pedidoDocumento";
import type { ParametrosPedido } from "@/lib/domain/abastecimiento/pedido";

/**
 * Acceso a Supabase de los pedidos guardados. Mismo criterio que
 * `lib/abastecimiento.ts`: nunca rechazan la promesa (el error viaja en el
 * resultado), una fila que no valida se descarta y se avisa por consola, y un
 * update/delete pide `.select("id")` para distinguir "afectó una fila" de "no
 * matcheó ninguna".
 */

const ERROR_DE_RED =
  "No se pudo conectar con el catálogo. Revisá tu conexión a internet e intentá de nuevo.";

export const ERROR_TABLA_PEDIDOS =
  "Todavía no existe la tabla de pedidos. Falta correr supabase/migration_pedidos.sql en Supabase.";

/** 42P01 = undefined_table (Postgres); PGRST205 = tabla fuera del schema cache (PostgREST). */
function esTablaFaltante(error: { code?: string; message?: string }): boolean {
  return error.code === "42P01" || error.code === "PGRST205" || /could not find the table/i.test(error.message ?? "");
}

function mensaje(error: { code?: string; message?: string }): string {
  return esTablaFaltante(error) ? ERROR_TABLA_PEDIDOS : error.message ?? "Error desconocido.";
}

export type ResultadoListarPedidos =
  | { items: PedidoGuardado[]; error: null }
  | { items: null; error: string };

export async function listarPedidos(): Promise<ResultadoListarPedidos> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("pedidos").select("*");
    if (error) return { items: null, error: mensaje(error) };

    const items: PedidoGuardado[] = [];
    for (const fila of data ?? []) {
      const r = PedidoGuardado.safeParse(fila);
      if (r.success) items.push(r.data);
      else console.error("Fila de pedidos con forma inesperada, se omite", fila, r.error);
    }
    // Los más nuevos primero.
    items.sort((a, b) => b.numero - a.numero);
    return { items, error: null };
  } catch (err) {
    console.error("No se pudieron leer los pedidos", err);
    return { items: null, error: ERROR_DE_RED };
  }
}

export interface DatosPedido {
  obra: string;
  solicitante: string;
  parametros: ParametrosPedido;
  lineas: LineaGuardada[];
  costo: number;
  notas?: string | null;
}

/** Guarda un pedido nuevo (borrador). La base le asigna el número correlativo. */
export async function guardarPedido(
  datos: DatosPedido
): Promise<{ pedido: PedidoGuardado | null; error: string | null }> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("pedidos")
      .insert({
        obra: datos.obra.trim(),
        solicitante: datos.solicitante.trim(),
        parametros: datos.parametros,
        lineas: datos.lineas,
        costo: datos.costo,
        notas: datos.notas?.trim() || null,
        created_by: user?.id,
        updated_by: user?.id,
      })
      .select("*")
      .single();

    if (error) return { pedido: null, error: mensaje(error) };
    const r = PedidoGuardado.safeParse(data);
    if (!r.success) {
      console.error("El pedido se guardó pero no valida", data, r.error);
      return { pedido: null, error: "El pedido se guardó, pero no se pudo leer de vuelta — recargá la página." };
    }
    return { pedido: r.data, error: null };
  } catch (err) {
    console.error("No se pudo guardar el pedido", err);
    return { pedido: null, error: ERROR_DE_RED };
  }
}

export async function cambiarEstadoPedido(id: string, estado: EstadoPedido): Promise<{ error: string | null }> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("pedidos")
      .update({ estado, updated_by: user?.id })
      .eq("id", id)
      .select("id");
    if (error) return { error: mensaje(error) };
    if (!data || data.length === 0) {
      return { error: "No se pudo cambiar el estado: el pedido ya no existe (puede haberlo eliminado otra persona)." };
    }
    return { error: null };
  } catch (err) {
    console.error("No se pudo cambiar el estado del pedido", err);
    return { error: ERROR_DE_RED };
  }
}

export async function eliminarPedido(id: string): Promise<{ error: string | null }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("pedidos").delete().eq("id", id).select("id");
    if (error) return { error: mensaje(error) };
    if (!data || data.length === 0) {
      return { error: "No se pudo eliminar: el pedido ya no existe o no tenés permiso para borrarlo." };
    }
    return { error: null };
  } catch (err) {
    console.error("No se pudo eliminar el pedido", err);
    return { error: ERROR_DE_RED };
  }
}
