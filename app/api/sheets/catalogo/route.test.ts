import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

import { GET } from "./route";

const ENV = ["SHEETS_SYNC_TOKEN", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const guardadas: Record<string, string | undefined> = {};

function pedido(token?: string) {
  return new Request("https://ejemplo.test/api/sheets/catalogo", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

function supabaseConTablas(tablas: Record<string, { data: unknown[] | null; error: { message: string } | null }>) {
  return { from: (t: string) => ({ select: () => Promise.resolve(tablas[t]) }) };
}

describe("GET /api/sheets/catalogo", () => {
  beforeEach(() => {
    for (const k of ENV) guardadas[k] = process.env[k];
    process.env.SHEETS_SYNC_TOKEN = "token-de-prueba";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "clave-de-servicio";
    createClient.mockReset();
  });

  afterEach(() => {
    for (const k of ENV) {
      if (guardadas[k] === undefined) delete process.env[k];
      else process.env[k] = guardadas[k];
    }
  });

  it("sin token en el servidor responde 503: nunca queda abierta por olvido", async () => {
    delete process.env.SHEETS_SYNC_TOKEN;
    const r = await GET(pedido("token-de-prueba"));
    expect(r.status).toBe(503);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("sin la clave de servicio de Supabase también responde 503", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect((await GET(pedido("token-de-prueba"))).status).toBe(503);
  });

  it("sin token o con uno equivocado responde 401 y no toca la base", async () => {
    expect((await GET(pedido())).status).toBe(401);
    expect((await GET(pedido("otro"))).status).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("con el token correcto devuelve la exportación, sin cache", async () => {
    createClient.mockReturnValue(
      supabaseConTablas({
        proveedores: {
          data: [
            { id: "p1", nombre: "Ranco", rubro: null, contacto: null, telefono: "1", forma_pago: null, plazo: null, notas: null, activo: true, orden: 1, updated_at: "2026-01-01T00:00:00Z" },
            { id: "rota" },
          ],
          error: null,
        },
        materiales: { data: [], error: null },
        catalogo_items: { data: [{ tipo: "piscinas", clave: "luces", precio: 240000, activo: true }], error: null },
      })
    );

    const r = await GET(pedido("token-de-prueba"));
    const cuerpo = await r.json();

    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(cuerpo.proveedores).toEqual([["Ranco", "", "", "1", "", "", ""]]); // la fila rota se omite
    expect(cuerpo.precios).toEqual({ "piscinas:luces": 240000 });
    expect(cuerpo.version).toMatch(/^[0-9a-f]{16}$/);
    // La clave de servicio se usa del lado del servidor, sin sesión.
    expect(createClient).toHaveBeenCalledWith("https://x.supabase.co", "clave-de-servicio", expect.objectContaining({ auth: expect.objectContaining({ persistSession: false }) }));
  });

  it("si la base falla responde 502 sin filtrar el detalle", async () => {
    createClient.mockReturnValue(
      supabaseConTablas({
        proveedores: { data: null, error: { message: "relation public.proveedores does not exist" } },
        materiales: { data: [], error: null },
        catalogo_items: { data: [], error: null },
      })
    );
    const r = await GET(pedido("token-de-prueba"));
    expect(r.status).toBe(502);
    expect(JSON.stringify(await r.json())).not.toMatch(/relation/);
  });
});
