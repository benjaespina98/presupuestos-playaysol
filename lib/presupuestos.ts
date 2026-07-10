import { createClient } from "@/lib/supabase";

export type TipoCalculadora =
  | "piscinas"
  | "cercos"
  | "cobertores"
  | "losetas"
  | "revestimientos";

export interface Perfil {
  id: string;
  email: string | null;
  nombre: string | null;
}

export interface Presupuesto {
  id: string;
  tipo: TipoCalculadora;
  cliente_nombre: string;
  datos: unknown;
  created_by: string | null;
  created_at: string;
  creador?: Perfil | null;
}

export function nombreCreador(creador: Perfil | null | undefined): string {
  return creador?.nombre || creador?.email || "—";
}

export async function guardarPresupuesto(
  tipo: TipoCalculadora,
  datos: unknown,
  clienteNombre: string
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("presupuestos").insert({
    tipo,
    cliente_nombre: clienteNombre || "Sin nombre",
    datos,
    created_by: user?.id,
  });

  return { error };
}

export async function listarPresupuestos(tipo: TipoCalculadora) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("presupuestos")
    .select("*")
    .eq("tipo", tipo)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as Presupuesto[];
}

// Sin filtro de tipo, para el historial centralizado. Trae además el perfil
// de quien creó cada presupuesto (nombre para mostrar + filtrar por usuario).
// Se pide por separado en vez de con un embed de PostgREST porque
// `presupuestos.created_by` referencia auth.users, no perfiles directamente
// — no hay una relación declarada entre las tablas que el embed pueda usar.
export async function listarTodosLosPresupuestos() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("presupuestos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  const presupuestos = data as Presupuesto[];

  const ids = Array.from(
    new Set(presupuestos.map((p) => p.created_by).filter((id): id is string => !!id))
  );
  if (ids.length === 0) return presupuestos;

  const { data: perfiles, error: perfilesError } = await supabase
    .from("perfiles")
    .select("id, email, nombre")
    .in("id", ids);

  if (perfilesError) throw perfilesError;

  const porId = new Map((perfiles as Perfil[]).map((p) => [p.id, p]));
  return presupuestos.map((p) => ({
    ...p,
    creador: p.created_by ? porId.get(p.created_by) ?? null : null,
  }));
}

// Dato identificador clave para reconocer un presupuesto en el historial sin abrirlo,
// además del nombre de cliente. Forma de `datos` confirmada contra filas reales de la
// tabla `presupuestos` (no inferida):
// - piscinas: no tiene largo/ancho estructurados, solo `dimension` (texto libre que el
//   usuario escribe a mano, ej. "7.00 mts largo por 3.00 mts ancho y de..."). Se toma el
//   comienzo de ese texto.
// - cercos: `ml` (metros lineales).
// - cobertores / revestimientos: `largo` y `ancho` numéricos.
// - losetas: `largo` y `ancho` numéricos.
export function resumenPresupuesto(tipo: TipoCalculadora, datos: unknown): string {
  const d = (datos ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && v > 0 ? v : null);

  switch (tipo) {
    case "piscinas": {
      const dimension = typeof d.dimension === "string" ? d.dimension.trim() : "";
      if (!dimension) return "";
      const primeraLinea = dimension.split("\n")[0].trim();
      return primeraLinea.length > 55
        ? primeraLinea.slice(0, 55).trim() + "…"
        : primeraLinea;
    }
    case "cercos": {
      const ml = num(d.ml);
      return ml ? `${ml} m lineales` : "";
    }
    case "cobertores":
    case "revestimientos":
    case "losetas": {
      const largo = num(d.largo);
      const ancho = num(d.ancho);
      if (largo && ancho) return `${largo} x ${ancho} m`;
      return "";
    }
    default:
      return "";
  }
}

export async function obtenerPresupuesto(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("presupuestos")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as Presupuesto;
}

export async function actualizarPresupuesto(
  id: string,
  datos: unknown,
  clienteNombre: string
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("presupuestos")
    .update({
      cliente_nombre: clienteNombre || "Sin nombre",
      datos,
    })
    .eq("id", id);

  return { error };
}

export async function eliminarPresupuesto(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("presupuestos").delete().eq("id", id);
  return { error };
}

const FOTOS_BUCKET = "presupuestos";

export async function subirFotoPresupuesto(tipo: TipoCalculadora, blob: Blob) {
  const supabase = createClient();
  const path = `${tipo}/${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage.from(FOTOS_BUCKET).upload(path, blob, {
    contentType: blob.type || "image/jpeg",
  });

  if (error) return { error };

  const {
    data: { publicUrl },
  } = supabase.storage.from(FOTOS_BUCKET).getPublicUrl(path);

  return { url: publicUrl, error: null };
}
