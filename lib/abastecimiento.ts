import type { z } from "zod";
import { createClient } from "@/lib/supabase";
import { Proveedor, type DatosProveedor } from "@/lib/domain/abastecimiento/proveedor";
import { Material, type DatosMaterial } from "@/lib/domain/abastecimiento/material";

/**
 * Acceso a Supabase de las pestañas Proveedores y Materiales del catálogo.
 *
 * Mismo criterio que `listarItemsCatalogo` / `actualizarItemCatalogo`: nunca
 * rechazan la promesa (el error viaja en el resultado, así la pantalla no
 * depende de acordarse de un `.catch()`), una fila que no valida se descarta
 * sola y se avisa por consola, y un update/delete pide `.select("id")` para
 * distinguir "afectó una fila" de "no matcheó ninguna".
 */

const ERROR_DE_RED =
  "No se pudo conectar con el catálogo. Revisá tu conexión a internet e intentá de nuevo.";

export const ERROR_TABLAS_PENDIENTES =
  "Todavía no existen las tablas de proveedores y materiales. " +
  "Falta correr supabase/migration_proveedores_materiales.sql en Supabase.";

/** 42P01 = undefined_table (Postgres); PGRST205 = tabla fuera del schema cache (PostgREST). */
function esTablaFaltante(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /could not find the table/i.test(error.message ?? "");
}

function mensaje(error: { code?: string; message?: string }, duplicado: string): string {
  if (esTablaFaltante(error)) return ERROR_TABLAS_PENDIENTES;
  if (error.code === "23505") return duplicado; // unique_violation
  return error.message ?? "Error desconocido.";
}

type Resultado<T> = { items: T[]; error: null } | { items: null; error: string };

async function listar<S extends z.ZodType>(tabla: string, schema: S): Promise<Resultado<z.infer<S>>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from(tabla).select("*");
    if (error) return { items: null, error: mensaje(error, "") };

    const items: z.infer<S>[] = [];
    for (const fila of data ?? []) {
      const r = schema.safeParse(fila);
      if (r.success) items.push(r.data);
      else console.error(`Fila de ${tabla} con forma inesperada, se omite`, fila, r.error);
    }
    return { items, error: null };
  } catch (err) {
    console.error(`No se pudo leer ${tabla}`, err);
    return { items: null, error: ERROR_DE_RED };
  }
}

async function eliminar(tabla: string, id: string, qué: string): Promise<{ error: string | null }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from(tabla).delete().eq("id", id).select("id");
    if (error) return { error: mensaje(error, "") };
    if (!data || data.length === 0) {
      return { error: `No se pudo eliminar: ${qué} ya no existe o no tenés permiso para borrarlo.` };
    }
    return { error: null };
  } catch (err) {
    console.error(`No se pudo eliminar de ${tabla}`, err);
    return { error: ERROR_DE_RED };
  }
}

// ── Proveedores ──────────────────────────────────────────────────────────────

export const listarProveedores = () => listar("proveedores", Proveedor);

/** `id` null = alta; con id = edición. */
export async function guardarProveedor(
  id: string | null,
  datos: DatosProveedor
): Promise<{ item: Proveedor | null; error: string | null }> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const fila = { ...datos, updated_by: user?.id };
    const consulta = id
      ? supabase.from("proveedores").update(fila).eq("id", id)
      : supabase.from("proveedores").insert(fila);
    const { data, error } = await consulta.select("*");

    if (error) return { item: null, error: mensaje(error, "Ya existe un proveedor con ese nombre.") };
    const r = Proveedor.safeParse(data?.[0]);
    if (!r.success) {
      return {
        item: null,
        error: id
          ? "No se pudo guardar: el proveedor ya no existe (puede haberlo eliminado otra persona)."
          : "Se guardó, pero no se pudo leer de vuelta — recargá la página.",
      };
    }
    return { item: r.data, error: null };
  } catch (err) {
    console.error("No se pudo guardar el proveedor", err);
    return { item: null, error: ERROR_DE_RED };
  }
}

export const eliminarProveedor = (id: string) => eliminar("proveedores", id, "el proveedor");

// ── Materiales ───────────────────────────────────────────────────────────────

export const listarMateriales = () => listar("materiales", Material);

/** Hoy en formato ISO (YYYY-MM-DD), hora local. */
function hoyISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * `id` null = alta; con id = edición. `precioAnterior` es el precio que tenía
 * antes de editar (`undefined` en un alta): `precio_actualizado` sólo se
 * refresca cuando el precio cambió de verdad, no por corregir una nota.
 */
export async function guardarMaterial(
  id: string | null,
  datos: DatosMaterial,
  precioAnterior?: number | null
): Promise<{ item: Material | null; error: string | null }> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const cambioPrecio = id === null || datos.precio !== precioAnterior;
    const fila = {
      ...datos,
      ...(cambioPrecio ? { precio_actualizado: hoyISO() } : {}),
      updated_by: user?.id,
    };
    const consulta = id
      ? supabase.from("materiales").update(fila).eq("id", id)
      : supabase.from("materiales").insert(fila);
    const { data, error } = await consulta.select("*");

    if (error) return { item: null, error: mensaje(error, "Ya existe un material con ese nombre.") };
    const r = Material.safeParse(data?.[0]);
    if (!r.success) {
      return {
        item: null,
        error: id
          ? "No se pudo guardar: el material ya no existe (puede haberlo eliminado otra persona)."
          : "Se guardó, pero no se pudo leer de vuelta — recargá la página.",
      };
    }
    return { item: r.data, error: null };
  } catch (err) {
    console.error("No se pudo guardar el material", err);
    return { item: null, error: ERROR_DE_RED };
  }
}

export const eliminarMaterial = (id: string) => eliminar("materiales", id, "el material");
