import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Proveedor } from "@/lib/domain/abastecimiento/proveedor";
import { Material } from "@/lib/domain/abastecimiento/material";
import { tokenDeEncabezado, tokenValido } from "@/lib/sheets/autorizacion";
import { armarExportacion, type ItemPrecio } from "@/lib/sheets/exportar";

/**
 * GET /api/sheets/catalogo — lo que lee el script de la planilla de costos.
 *
 * Devuelve proveedores, materiales y precios de venta del catálogo. Está
 * protegido con un token compartido (`SHEETS_SYNC_TOKEN`) en el encabezado
 * `Authorization: Bearer ...`, porque la planilla no tiene sesión de usuario.
 * Lee con la clave de servicio de Supabase (`SUPABASE_SERVICE_ROLE_KEY`), que
 * sólo existe en el servidor: nunca viaja al navegador ni a la planilla.
 *
 * Sin la variable de entorno del token, responde 503: una ruta que expone
 * costos nunca queda abierta por olvido.
 */
export const dynamic = "force-dynamic";

const SIN_CACHE = { "Cache-Control": "no-store" };

function error(mensaje: string, status: number) {
  return Response.json({ error: mensaje }, { status, headers: SIN_CACHE });
}

/** Los ítems con su stock; si la columna todavía no existe (falta migration_stock_piscinas.sql) se leen sin él. */
async function leerItems(supabase: SupabaseClient) {
  const base = "tipo, clave, precio, activo, descripcion, categoria, unidad, updated_at";
  const conStock = await supabase.from("catalogo_items").select(`${base}, stock`);
  if (!conStock.error) return conStock;
  if (!/stock/i.test(conStock.error.message ?? "")) return conStock;
  return supabase.from("catalogo_items").select(base);
}

export async function GET(request: Request) {
  const tokenEsperado = process.env.SHEETS_SYNC_TOKEN;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const claveServicio = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!tokenEsperado || !url || !claveServicio) {
    return error("La sincronización con la planilla no está configurada en el servidor.", 503);
  }
  if (!tokenValido(tokenDeEncabezado(request.headers.get("authorization")), tokenEsperado)) {
    return error("No autorizado.", 401);
  }

  const supabase = createClient(url, claveServicio, { auth: { persistSession: false, autoRefreshToken: false } });
  const [proveedores, materiales, items] = await Promise.all([
    supabase.from("proveedores").select("*"),
    supabase.from("materiales").select("*"),
    leerItems(supabase),
  ]);

  const fallo = proveedores.error ?? materiales.error ?? items.error;
  if (fallo) {
    console.error("No se pudo leer el catálogo para la planilla", fallo);
    return error("No se pudo leer el catálogo.", 502);
  }

  const validos = <S extends typeof Proveedor | typeof Material>(schema: S, filas: unknown[] | null) =>
    (filas ?? []).flatMap((f) => {
      const r = schema.safeParse(f);
      if (!r.success) console.error("Fila omitida en la exportación a la planilla", f);
      return r.success ? [r.data] : [];
    });

  return Response.json(
    armarExportacion({
      proveedores: validos(Proveedor, proveedores.data) as Proveedor[],
      materiales: validos(Material, materiales.data) as Material[],
      items: (items.data ?? []) as ItemPrecio[],
    }),
    { headers: SIN_CACHE }
  );
}
