import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Proveedor } from "@/lib/domain/abastecimiento/proveedor";
import { Material } from "@/lib/domain/abastecimiento/material";
import { tokenDeEncabezado, tokenValido } from "@/lib/sheets/autorizacion";
import { armarExportacion, ItemPrecio } from "@/lib/sheets/exportar";
import { mensajeFilaInvalida } from "@/lib/logs";

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
 *
 * Sólo lee. No hay POST/PUT/PATCH/DELETE (Next responde 405 a lo que no se
 * exporta acá) y nada en este archivo escribe en la base: la planilla recibe
 * datos del portal, nunca al revés. Esto incluye el stock, que la planilla ve
 * como un número de sólo lectura.
 *
 * Al que llama sin token válido no se le dice nada más que 401. Nunca se
 * loguea el token ni el contenido de las filas (sólo su id y el motivo).
 */
export const dynamic = "force-dynamic";

const SIN_CACHE = { "Cache-Control": "no-store" };

/** Un GET no trae cuerpo: cualquier cosa más grande que esto se rechaza sin leerla. */
export const MAX_BYTES_SOLICITUD = 1024;

function error(mensaje: string, status: number, extra: Record<string, string> = {}) {
  return Response.json({ error: mensaje }, { status, headers: { ...SIN_CACHE, ...extra } });
}

/** Los ítems con su stock; si la columna todavía no existe (falta migration_stock_piscinas.sql) se leen sin él. */
async function leerItems(supabase: SupabaseClient) {
  const base = "id, tipo, clave, precio, activo, descripcion, categoria, unidad, updated_at";
  const conStock = await supabase.from("catalogo_items").select(`${base}, stock`);
  if (!conStock.error) return conStock;
  if (!/stock/i.test(conStock.error.message ?? "")) return conStock;
  return supabase.from("catalogo_items").select(base);
}

export async function GET(request: Request) {
  const tokenEsperado = process.env.SHEETS_SYNC_TOKEN;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const claveServicio = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES_SOLICITUD) {
    return error("Solicitud demasiado grande.", 413);
  }
  if (!tokenEsperado || !url || !claveServicio) {
    // Sin detalle de qué falta: eso es asunto del operador, y se ve en los logs del servidor.
    console.error("Sincronización con la planilla: faltan variables de entorno en el servidor.");
    return error("Servicio no disponible.", 503);
  }
  if (!tokenValido(tokenDeEncabezado(request.headers.get("authorization")), tokenEsperado)) {
    return error("No autorizado.", 401, { "WWW-Authenticate": "Bearer" });
  }

  const supabase = createClient(url, claveServicio, { auth: { persistSession: false, autoRefreshToken: false } });
  const [proveedores, materiales, items] = await Promise.all([
    supabase.from("proveedores").select("*"),
    supabase.from("materiales").select("*"),
    leerItems(supabase),
  ]);

  const fallo = proveedores.error ?? materiales.error ?? items.error;
  if (fallo) {
    // Sólo el código y el mensaje de la base: nunca el objeto entero ni datos de filas.
    console.error("No se pudo leer el catálogo para la planilla", fallo.code ?? "sin código", fallo.message);
    return error("No se pudo leer el catálogo.", 502);
  }

  const validos = <S extends typeof Proveedor | typeof Material | typeof ItemPrecio>(schema: S, filas: unknown[] | null) =>
    (filas ?? []).flatMap((f) => {
      const r = schema.safeParse(f);
      if (!r.success) console.error(mensajeFilaInvalida("Fila omitida en la exportación a la planilla", f, r.error));
      return r.success ? [r.data] : [];
    });

  return Response.json(
    armarExportacion({
      proveedores: validos(Proveedor, proveedores.data) as Proveedor[],
      materiales: validos(Material, materiales.data) as Material[],
      items: validos(ItemPrecio, items.data) as ItemPrecio[],
    }),
    { headers: SIN_CACHE }
  );
}
