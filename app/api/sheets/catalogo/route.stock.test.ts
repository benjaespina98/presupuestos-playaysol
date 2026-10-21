import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

import { GET } from "./route";

const ENV = ["SHEETS_SYNC_TOKEN", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const guardadas: Record<string, string | undefined> = {};
const TOKEN = "token-de-prueba-0123456789";

/**
 * Con el libro de movimientos, `catalogo_items.stock` es un CACHÉ de la suma de
 * movimientos. La planilla sigue leyendo ese caché (una sola lectura, sin sumar el
 * libro) y es de sólo lectura.
 */
describe("/api/sheets/catalogo · stock (caché del libro)", () => {
  beforeEach(() => {
    for (const k of ENV) guardadas[k] = process.env[k];
    process.env.SHEETS_SYNC_TOKEN = TOKEN;
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

  function conItems(items: unknown[]) {
    const tablasLeidas: string[] = [];
    const columnasItems: string[] = [];
    createClient.mockReturnValue({
      from: (tabla: string) => {
        tablasLeidas.push(tabla);
        return {
          select: (columnas: string) => {
            if (tabla === "catalogo_items") columnasItems.push(columnas);
            return Promise.resolve({ data: tabla === "catalogo_items" ? items : [], error: null });
          },
        };
      },
    });
    return { tablasLeidas, columnasItems };
  }

  const pedido = () => new Request("https://ejemplo.test/api/sheets/catalogo", { headers: { Authorization: `Bearer ${TOKEN}` } });

  it("la columna Stock sale del caché de catalogo_items, y no se lee el libro de movimientos", async () => {
    const { tablasLeidas, columnasItems } = conItems([
      { id: "a", tipo: "piscinas", clave: "indusplast_caribe_550", precio: 8810000, activo: true, stock: 3, descripcion: "Caribe 550", categoria: "Piscinas", unidad: "obra", updated_at: "2026-10-22T10:00:00Z" },
      { id: "b", tipo: "piscinas", clave: "indusplast_caribe_650", precio: 9965000, activo: true, stock: 0 },
      { id: "c", tipo: "cercos", clave: "precioCon", precio: 79500, activo: true, stock: null },
    ]);

    const cuerpo = await (await GET(pedido())).json();

    expect(columnasItems[0]).toContain("stock");
    expect(tablasLeidas).not.toContain("movimientos_stock");
    expect(cuerpo.stock).toEqual({ "piscinas:indusplast_caribe_550": 3, "piscinas:indusplast_caribe_650": 0 });
    const columnaStock = Object.fromEntries(cuerpo.catalogo.map((f: unknown[]) => [f[1], f[6]]));
    expect(columnaStock).toEqual({ indusplast_caribe_550: 3, indusplast_caribe_650: 0, precioCon: "" });
  });

  it("un stock negativo viaja tal cual a la planilla (el caché refleja el libro)", async () => {
    conItems([{ id: "a", tipo: "piscinas", clave: "indusplast_spa_240", precio: 1, activo: true, stock: -2 }]);
    const cuerpo = await (await GET(pedido())).json();
    expect(cuerpo.stock).toEqual({ "piscinas:indusplast_spa_240": -2 });
  });

  it("si la columna stock todavía no existe, se lee el catálogo igual, sin stock", async () => {
    const selects: string[] = [];
    createClient.mockReturnValue({
      from: (tabla: string) => ({
        select: (columnas: string) => {
          if (tabla !== "catalogo_items") return Promise.resolve({ data: [], error: null });
          selects.push(columnas);
          return Promise.resolve(
            columnas.includes("stock")
              ? { data: null, error: { message: "column catalogo_items.stock does not exist" } }
              : { data: [{ id: "a", tipo: "cercos", clave: "precioCon", precio: 1, activo: true }], error: null }
          );
        },
      }),
    });
    const r = await GET(pedido());
    expect(r.status).toBe(200);
    expect(selects).toHaveLength(2);
  });
});
