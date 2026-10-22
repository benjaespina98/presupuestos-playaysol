import { createClient } from "@supabase/supabase-js";

/**
 * Datos de prueba que necesitan las pruebas de pantallas (todo inventado, sólo en la base LOCAL). Se crean con la
 * clave de servicio de la base local (que `scripts/e2e-local.mjs` pasa por el entorno; nunca se imprime) y son
 * idempotentes: si ya existen, no se repiten.
 */
const API = process.env.E2E_LOCAL_API ?? "";
const SERVICE = process.env.E2E_LOCAL_SERVICE_KEY ?? "";
const EMAIL = process.env.E2E_LOCAL_EMAIL ?? "";

export const OBRA_PANTALLAS = "Obra Pantallas E2E 3534 55 66 77";
export const NOTA_INTERNA = "NOTA-INTERNA-no-mostrar-margen-30";
export const TELEFONO_PROVEEDOR = "+54 9 3534 11-2233";

function clienteAdmin() {
  // Salvaguarda: esta prueba nunca toca otra cosa que la base local.
  if (!/^http:\/\/(127\.0\.0\.1|localhost):5432\d$/.test(API)) throw new Error("La API de la prueba no es la base local.");
  if (!SERVICE) throw new Error("Falta la clave de servicio local.");
  return createClient(API, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function idDelUsuario(admin: ReturnType<typeof clienteAdmin>): Promise<string> {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  const u = data.users.find((x) => x.email === EMAIL);
  if (!u) throw new Error("No encuentro al usuario de la prueba.");
  return u.id;
}

/** Un pedido guardado con precios, teléfonos y una nota interna cargados (para probar que NADA de eso sale), y presupuestos para el historial. */
export async function asegurarDatosDePantallas(): Promise<{ pedidoId: string }> {
  const admin = clienteAdmin();
  const userId = await idDelUsuario(admin);

  const existente = await admin.from("pedidos").select("id").eq("obra", OBRA_PANTALLAS).limit(1);
  let pedidoId = existente.data?.[0]?.id as string | undefined;
  if (!pedidoId) {
    const prov = async (nombre: string, tel: string) => {
      const ya = await admin.from("proveedores").select("id").ilike("nombre", nombre).limit(1);
      if (ya.data?.[0]) return ya.data[0].id as string;
      const r = await admin.from("proveedores").insert({ nombre, contacto: "Juan Contacto", telefono: tel }).select("id").single();
      if (r.error) throw r.error;
      return r.data.id as string;
    };
    const p1 = await prov("Corralón Pantallas E2E", TELEFONO_PROVEEDOR);
    const p2 = await prov("Filtros Pantallas E2E", "011 4444-5555");
    const lin = (nombre: string, proveedor: string, pid: string, cantidad: number, precio: number, tel: string) => ({
      material_id: crypto.randomUUID(), nombre, unidad: "unidad", cantidad, precio, subtotal: precio * cantidad,
      proveedor_id: pid, proveedor, contacto: "Juan Contacto", telefono: tel,
    });
    const ins = await admin
      .from("pedidos")
      .insert({
        obra: OBRA_PANTALLAS,
        solicitante: "Benja",
        parametros: { tamano: "8x4", obras: 1, borde: "Losetas", luces: 2, luzCamaAgua: false, banoQuimico: false },
        lineas: [
          lin("Hierro del 6", "Corralón Pantallas E2E", p1, 10, 12345.67, TELEFONO_PROVEEDOR),
          lin("Cemento 25 kg", "Corralón Pantallas E2E", p1, 20, 9876.5, TELEFONO_PROVEEDOR),
          lin("Filtro de arena", "Filtros Pantallas E2E", p2, 1, 250000, "011 4444-5555"),
        ],
        costo: 123456,
        notas: NOTA_INTERNA,
        created_by: userId,
        updated_by: userId,
      })
      .select("id")
      .single();
    if (ins.error) throw ins.error;
    pedidoId = ins.data.id as string;
  }

  const yaPresupuesto = await admin.from("presupuestos").select("id").eq("cliente_nombre", "Cliente E2E Pantallas").limit(1);
  if (!yaPresupuesto.data?.[0]) {
    for (const cliente of ["Cliente E2E Pantallas", "Pérez, Juan - con un nombre larguísimo para ver cómo se corta en la lista del historial de presupuestos"]) {
      const r = await admin.from("presupuestos").insert({
        tipo: "cercos",
        cliente_nombre: cliente,
        created_by: userId,
        datos: { v: 1, tipo: "cercos", fecha: "01/10/2026", cliente: { nombre: cliente }, medidas: { metrosLineales: 10 }, lineas: [], preciosBase: {}, totales: [] },
      });
      if (r.error) throw r.error;
    }
  }
  return { pedidoId };
}

/** Un material propio de la prueba de edición, con una cantidad para la pileta 8x4 (aparece en un pedido nuevo de ese tamaño). */
export async function asegurarMaterialDeEdicion(nombre: string): Promise<void> {
  const admin = clienteAdmin();
  const ya = await admin.from("materiales").select("id").eq("nombre", nombre).limit(1);
  if (ya.data?.[0]) {
    const u = await admin.from("materiales").update({ cantidades: { "8x4": 3 }, aplica: "Siempre", activo: true }).eq("id", ya.data[0].id);
    if (u.error) throw u.error;
    return;
  }
  const r = await admin.from("materiales").insert({ nombre, unidad: "m³", precio: 1500, aplica: "Siempre", rubro: "Áridos", cantidades: { "8x4": 3 } });
  if (r.error) throw r.error;
}

export async function cantidadGuardada(nombre: string, tamano: string): Promise<number | null> {
  const admin = clienteAdmin();
  const r = await admin.from("materiales").select("cantidades").eq("nombre", nombre).single();
  if (r.error) throw r.error;
  const v = (r.data.cantidades as Record<string, number>)[tamano];
  return typeof v === "number" ? v : null;
}
