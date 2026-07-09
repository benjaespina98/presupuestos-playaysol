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
