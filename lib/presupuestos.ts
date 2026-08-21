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

// Trae los presupuestos para el historial centralizado, con el perfil
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
// además del nombre de cliente.
//
// Convive con DOS formatos de `datos` (ver lib/domain/presupuesto/v1.ts):
//   v0 (legacy, histórico) → las medidas quedan sueltas en la raíz de `datos`.
//   v1 (desde la Fase 5)   → cada calculadora las anida en `datos.medidas`,
//                            con nombres de campo propios del motor nuevo
//                            (ver medidasDesdeV0 en adaptadores.ts para la
//                            traducción completa nombre viejo → nombre nuevo).
//
// Esta función NO usa `leerPresupuesto`/`PresupuestoV1.parse` a propósito: es
// una lectura best-effort para una lista, no la reconstrucción completa de un
// presupuesto, y no vale la pena pagar el costo (ni el acoplamiento al motor
// de dominio) de una validación completa sólo para una línea de subtítulo.
//
// Regla de prioridad: si el campo nuevo (v1, anidado) está presente y es
// válido, gana; si no, se cae al campo viejo (v0, en la raíz) — así un
// presupuesto que por lo que sea tuviera las dos formas (no debería pasar,
// pero la función no confía en `datos.v` para decidir) igual muestra lo
// correcto, y uno viejo puro sigue funcionando exactamente como antes.
//
// Forma confirmada contra filas reales de la tabla `presupuestos` (no
// inferida) para v0, y contra el snapshot que arma cada Calculadora.tsx para
// v1:
// - piscinas: nunca tuvo largo/ancho estructurados. v0 guardaba el texto
//   libre en `dimension`; v1 lo guarda en `detalle` (top-level, no dentro de
//   `medidas` — PiscinaCalculadora.tsx deja `medidas: {}` siempre, el
//   subtotal no es un dato para resumir acá). Se toma el comienzo de ese texto.
// - cercos: v0 `ml` (metros lineales) → v1 `medidas.metrosLineales`.
// - cobertores / revestimientos: v0 y v1 usan el mismo nombre, `largo`/`ancho`
//   — v1 sólo los anida un nivel adentro, en `medidas`.
// - losetas: igual que cobertores/revestimientos (`largo`/`ancho`, sólo
//   anidados en v1).
export function resumenPresupuesto(tipo: TipoCalculadora, datos: unknown): string {
  const d = (datos ?? {}) as Record<string, unknown>;
  const medidas = (d.medidas && typeof d.medidas === "object" ? d.medidas : {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && v > 0 ? v : null);

  switch (tipo) {
    case "piscinas": {
      const fuente = typeof d.detalle === "string" && d.detalle.trim() ? d.detalle : d.dimension;
      const dimension = typeof fuente === "string" ? fuente.trim() : "";
      if (!dimension) return "";
      const primeraLinea = dimension.split("\n")[0].trim();
      return primeraLinea.length > 55
        ? primeraLinea.slice(0, 55).trim() + "…"
        : primeraLinea;
    }
    case "cercos": {
      const ml = num(medidas.metrosLineales) ?? num(d.ml);
      return ml ? `${ml} m lineales` : "";
    }
    case "cobertores":
    case "revestimientos":
    case "losetas": {
      const largo = num(medidas.largo) ?? num(d.largo);
      const ancho = num(medidas.ancho) ?? num(d.ancho);
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

/**
 * El presupuesto más reciente de un tipo (cualquiera lo haya creado, no sólo
 * el usuario actual — el equipo trabaja compartido, igual que el catálogo).
 * Alimenta el atajo "duplicar el último parecido" de cada calculadora
 * (Mejoras de formularios, punto 5).
 *
 * `null` en cualquier caso de "no hay nada que ofrecer" — sin presupuestos
 * de ese tipo, o si Supabase falla: es un atajo de conveniencia, nunca debe
 * bloquear ni ensuciar de errores la pantalla de una calculadora nueva.
 */
export async function obtenerUltimoPresupuesto(tipo: TipoCalculadora): Promise<Presupuesto | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("presupuestos")
      .select("*")
      .eq("tipo", tipo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("No se pudo buscar el último presupuesto para duplicar", error);
      return null;
    }
    return (data as Presupuesto | null) ?? null;
  } catch (err) {
    console.error("No se pudo buscar el último presupuesto para duplicar", err);
    return null;
  }
}

// Solo el dueño puede modificar o borrar su presupuesto (política RLS
// "Users can update/delete their own presupuestos", ver migration_perfiles_ownership.sql).
//
// Postgres no considera un error que un UPDATE/DELETE no toque ninguna fila: si RLS
// filtra la fila, Supabase devuelve `error: null` y cero filas afectadas. Sin el
// `.select()` de abajo eso llegaba a la calculadora como éxito y mostraba
// "Guardado en la nube ✓" sin haber guardado nada — el peor final posible para un
// presupuesto que alguien acaba de armar. Pidiendo las filas afectadas podemos
// distinguir "salió bien" de "no te dejó" y avisar de verdad.
const SIN_PERMISO =
  "No se pudo guardar: este presupuesto lo creó otra persona y solo su autor puede modificarlo. Usá «Duplicar» desde el historial para hacer una copia tuya.";

export async function actualizarPresupuesto(
  id: string,
  datos: unknown,
  clienteNombre: string
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("presupuestos")
    .update({
      cliente_nombre: clienteNombre || "Sin nombre",
      datos,
    })
    .eq("id", id)
    .select("id");

  if (error) return { error };
  if (!data || data.length === 0) return { error: new Error(SIN_PERMISO) };
  return { error: null };
}

export async function eliminarPresupuesto(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("presupuestos")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) return { error };
  if (!data || data.length === 0) {
    return {
      error: new Error(
        "No se pudo eliminar: este presupuesto lo creó otra persona y solo su autor puede borrarlo."
      ),
    };
  }
  return { error: null };
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
