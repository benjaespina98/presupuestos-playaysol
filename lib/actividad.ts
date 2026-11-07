import { createClient } from "@/lib/supabase";
import { listarMovimientosGeneral } from "@/lib/stock";
import {
  FilaAuditoria,
  SISTEMA,
  describirAuditoria,
  describirMovimiento,
  ordenarEventos,
  type EventoActividad,
} from "@/lib/domain/actividad/evento";

/** Cuántos cambios de la auditoría trae la pantalla Actividad (los más nuevos). */
export const LIMITE_AUDITORIA = 500;

export type ResultadoActividad = { eventos: EventoActividad[]; truncado: boolean; error: null } | { eventos: null; truncado: false; error: string };

/** Consultas con `in (...)` en tandas: con cientos de ids la dirección de la consulta quedaría demasiado larga. */
async function porTandas<T>(ids: string[], leer: (tanda: string[]) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const salida: T[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const { data } = await leer(ids.slice(i, i + 50));
    if (data) salida.push(...data);
  }
  return salida;
}

/**
 * Todo lo que pasó en el portal, del más nuevo al más viejo: los cambios de precios, materiales, proveedores, pedidos
 * y presupuestos (la auditoría) más los movimientos de stock. Lo que no hizo una persona figura como "Sistema".
 * Nunca rechaza la promesa: el error viaja en el resultado.
 */
export async function listarActividad(): Promise<ResultadoActividad> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("auditoria")
      .select("id, tabla, registro_id, accion, usuario_id, fecha, columnas_cambiadas, valores")
      .order("fecha", { ascending: false })
      .limit(LIMITE_AUDITORIA);
    if (error) return { eventos: null, truncado: false, error: "No se pudo leer la actividad. Probá de nuevo." };

    const filas: FilaAuditoria[] = [];
    for (const fila of data ?? []) {
      const r = FilaAuditoria.safeParse(fila);
      if (r.success) filas.push(r.data);
      else console.error("Fila de auditoria con forma inesperada, se omite");
    }

    const personas = new Map<string, string>();
    const idsPersonas = [...new Set(filas.map((f) => f.usuario_id).filter((id): id is string => !!id))];
    for (const p of await porTandas<{ id: string; email: string | null; nombre: string | null }>(idsPersonas, (t) => supabase.from("perfiles").select("id, email, nombre").in("id", t))) {
      personas.set(p.id, p.nombre || p.email || "Usuario sin nombre");
    }

    // El nombre actual de cada registro, para los cambios que sólo dicen QUÉ columna cambió.
    const nombres = new Map<string, string>();
    const idsDe = (tabla: string) => [...new Set(filas.filter((f) => f.tabla === tabla).map((f) => f.registro_id))];
    for (const r of await porTandas<{ id: string; descripcion: string | null; clave: string }>(idsDe("catalogo_items"), (t) => supabase.from("catalogo_items").select("id, descripcion, clave").in("id", t))) {
      nombres.set(`catalogo_items:${r.id}`, r.descripcion || r.clave);
    }
    for (const tabla of ["materiales", "proveedores"] as const) {
      for (const r of await porTandas<{ id: string; nombre: string }>(idsDe(tabla), (t) => supabase.from(tabla).select("id, nombre").in("id", t))) nombres.set(`${tabla}:${r.id}`, r.nombre);
    }
    for (const r of await porTandas<{ id: string; tipo: string }>(idsDe("presupuestos"), (t) => supabase.from("presupuestos").select("id, tipo").in("id", t))) {
      nombres.set(`presupuestos:${r.id}`, r.tipo);
    }
    const buscar = (tabla: string, id: string) => nombres.get(`${tabla}:${id}`) ?? null;

    const eventos: EventoActividad[] = [];
    for (const f of filas) {
      const quien = f.usuario_id ? (personas.get(f.usuario_id) ?? "Usuario sin nombre") : SISTEMA;
      const e = describirAuditoria(f, quien, buscar);
      if (e) eventos.push(e);
    }

    const mov = await listarMovimientosGeneral();
    if (mov.error === null) eventos.push(...mov.movimientos.map(describirMovimiento));

    return { eventos: ordenarEventos(eventos), truncado: filas.length >= LIMITE_AUDITORIA || (mov.error === null && mov.truncado), error: null };
  } catch (err) {
    console.error("No se pudo leer la actividad", err instanceof Error ? err.message : "error");
    return { eventos: null, truncado: false, error: "No se pudo leer la actividad. Probá de nuevo." };
  }
}
