import { createClient } from "@/lib/supabase";
import type { TipoCalculadora } from "@/lib/presupuestos";

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
