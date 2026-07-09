import { createClient } from "@/lib/supabase";

export async function guardarPresupuesto(datos: unknown, clienteNombre: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("presupuestos").insert({
    tipo: "revestimientos",
    cliente_nombre: clienteNombre || "Sin nombre",
    datos,
    created_by: user?.id,
  });

  return { error };
}

export async function listarPresupuestos() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("presupuestos")
    .select("*")
    .eq("tipo", "revestimientos")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}
