import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * A diferencia del resto de lib/catalogo.ts (el puente legacy, sin tests: son
 * wrappers finitos de Supabase que no vale la pena mockear), esto sí se
 * prueba: listarItemsCatalogo/actualizarItemCatalogo tienen lógica real
 * (clasificar el error de migración pendiente, no tirar nunca, descartar
 * filas que no validan) que puede romperse en silencio.
 */

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ createClient }));

function clienteFalso(overrides: {
  select?: (...args: string[]) => unknown;
  update?: () => { eq: () => { select: () => Promise<{ data: unknown; error: unknown }> } };
  insert?: () => { select: () => { single: () => Promise<{ data: unknown; error: unknown }> } };
}) {
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    from: () => ({
      select: overrides.select ?? (() => Promise.resolve({ data: [], error: null })),
      update: overrides.update,
      insert: overrides.insert,
    }),
  };
}

describe("listarItemsCatalogo", () => {
  it("nunca rechaza la promesa: un fallo de red se convierte en {items:null, error}", async () => {
    createClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
      from: () => ({
        select: () => Promise.reject(new TypeError("Failed to fetch")),
      }),
    });
    const { listarItemsCatalogo } = await import("./catalogo");

    const resultado = await listarItemsCatalogo();

    expect(resultado.items).toBeNull();
    expect(resultado.error).toMatch(/no se pudo conectar/i);
  });

  it("detecta la columna faltante (migración pendiente) y no la confunde con un error genérico", async () => {
    createClient.mockReturnValue(
      clienteFalso({
        select: () =>
          Promise.resolve({
            data: null,
            error: { code: "42703", message: "column catalogo_items.categoria does not exist" },
          }),
      })
    );
    const { listarItemsCatalogo, ERROR_MIGRACION_PENDIENTE } = await import("./catalogo");

    const resultado = await listarItemsCatalogo();

    expect(resultado.error).toBe(ERROR_MIGRACION_PENDIENTE);
  });

  it("descarta una fila que no valida (dato cargado a mano) sin tirar abajo el resto", async () => {
    createClient.mockReturnValue(
      clienteFalso({
        select: () =>
          Promise.resolve({
            data: [
              {
                id: "buena",
                tipo: "piscinas",
                clave: "luces",
                descripcion: "Luces",
                precio: 1000,
                categoria: null,
                unidad: null,
                activo: true,
                orden: null,
                updated_at: "2026-01-01T00:00:00.000Z",
              },
              {
                id: "mala",
                tipo: "un-tipo-que-no-existe",
                clave: "rota",
                descripcion: null,
                precio: 1,
                categoria: null,
                unidad: null,
                activo: true,
                orden: null,
                updated_at: "2026-01-01T00:00:00.000Z",
              },
            ],
            error: null,
          }),
      })
    );
    const { listarItemsCatalogo } = await import("./catalogo");

    const resultado = await listarItemsCatalogo();

    expect(resultado.error).toBeNull();
    expect(resultado.items?.map((i) => i.id)).toEqual(["buena"]);
  });

  it("excluye las claves reservadas de texto compartido (__legal, __footer_*)", async () => {
    createClient.mockReturnValue(
      clienteFalso({
        select: () =>
          Promise.resolve({
            data: [
              {
                id: "a",
                tipo: "piscinas",
                clave: "__legal",
                descripcion: "texto legal",
                precio: null,
                categoria: null,
                unidad: null,
                activo: true,
                orden: null,
                updated_at: "2026-01-01T00:00:00.000Z",
              },
            ],
            error: null,
          }),
      })
    );
    const { listarItemsCatalogo } = await import("./catalogo");

    const resultado = await listarItemsCatalogo();

    expect(resultado.items).toEqual([]);
  });
});

describe("actualizarItemCatalogo", () => {
  const cambios = {
    descripcion: "x",
    precio: 100,
    categoria: null,
    unidad: null,
    activo: true,
    stock: null,
  };

  it("un fallo de red no rechaza la promesa", async () => {
    createClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
      from: () => ({
        update: () => ({
          eq: () => ({ select: () => Promise.reject(new TypeError("Failed to fetch")) }),
        }),
      }),
    });
    const { actualizarItemCatalogo } = await import("./catalogo");

    const resultado = await actualizarItemCatalogo("id-1", cambios);

    expect(resultado.error).toMatch(/no se pudo conectar/i);
  });

  it("cero filas afectadas (RLS o fila borrada) se reporta, no se confunde con éxito", async () => {
    createClient.mockReturnValue(
      clienteFalso({
        update: () => ({ eq: () => ({ select: () => Promise.resolve({ data: [], error: null }) }) }),
      })
    );
    const { actualizarItemCatalogo } = await import("./catalogo");

    const resultado = await actualizarItemCatalogo("id-inexistente", cambios);

    expect(resultado.error).toMatch(/ya no existe/i);
  });

  it("una fila afectada es éxito", async () => {
    createClient.mockReturnValue(
      clienteFalso({
        update: () => ({
          eq: () => ({ select: () => Promise.resolve({ data: [{ id: "id-1" }], error: null }) }),
        }),
      })
    );
    const { actualizarItemCatalogo } = await import("./catalogo");

    const resultado = await actualizarItemCatalogo("id-1", cambios);

    expect(resultado.error).toBeNull();
  });
});

describe("crearItemCatalogo", () => {
  const nuevo = {
    tipo: "cercos" as const,
    clave: "cerco_reforzado",
    descripcion: "Cerco reforzado",
    precio: 90000,
    categoria: null,
    unidad: null,
    activo: true,
    stock: null,
  };
  const filaCreada = {
    id: "nuevo-1",
    tipo: "cercos",
    clave: "cerco_reforzado",
    descripcion: "Cerco reforzado",
    precio: 90000,
    categoria: null,
    unidad: null,
    activo: true,
    orden: null,
    stock: null,
    updated_at: "2026-01-01T00:00:00.000Z",
  };

  it("un fallo de red no rechaza la promesa", async () => {
    createClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
      from: () => ({
        insert: () => ({ select: () => ({ single: () => Promise.reject(new TypeError("Failed to fetch")) }) }),
      }),
    });
    const { crearItemCatalogo } = await import("./catalogo");

    const resultado = await crearItemCatalogo(nuevo);

    expect(resultado.item).toBeNull();
    expect(resultado.error).toMatch(/no se pudo conectar/i);
  });

  it("clave duplicada (tipo, clave) da un mensaje claro, no el error crudo de Postgres", async () => {
    createClient.mockReturnValue(
      clienteFalso({
        insert: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: null,
                error: { code: "23505", message: 'duplicate key value violates unique constraint "catalogo_items_tipo_clave_key"' },
              }),
          }),
        }),
      })
    );
    const { crearItemCatalogo } = await import("./catalogo");

    const resultado = await crearItemCatalogo(nuevo);

    expect(resultado.item).toBeNull();
    expect(resultado.error).toMatch(/ya existe/i);
  });

  it("detecta la migración pendiente igual que el resto de las operaciones", async () => {
    createClient.mockReturnValue(
      clienteFalso({
        insert: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({ data: null, error: { code: "42703", message: "column catalogo_items.categoria does not exist" } }),
          }),
        }),
      })
    );
    const { crearItemCatalogo, ERROR_MIGRACION_PENDIENTE } = await import("./catalogo");

    const resultado = await crearItemCatalogo(nuevo);

    expect(resultado.error).toBe(ERROR_MIGRACION_PENDIENTE);
  });

  it("una fila creada válida se devuelve ya parseada", async () => {
    createClient.mockReturnValue(
      clienteFalso({
        insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: filaCreada, error: null }) }) }),
      })
    );
    const { crearItemCatalogo } = await import("./catalogo");

    const resultado = await crearItemCatalogo(nuevo);

    expect(resultado.error).toBeNull();
    expect(resultado.item).toEqual(filaCreada);
  });
});

describe("Lote 6 · guardas de seguridad de la pantalla de Catálogo", () => {
  const src = fs.readFileSync(path.join(__dirname, "catalogo.ts"), "utf8");

  it("el listado nunca pide updated_by (el id de otro usuario no tiene por qué llegar al navegador)", () => {
    expect(src).not.toMatch(/COLUMNAS_ITEM_CATALOGO\s*=[^;]*updated_by/);
  });

  // Los ítems del catálogo ya no se borran desde la app: se desactivan (activo = false).
  // La base tampoco lo permite (supabase/migrations/20261021000300_desactivacion.sql).
  it("catalogo.ts no tiene ningún .delete(): los ítems se desactivan, no se borran", () => {
    expect(src).not.toMatch(/\.delete\(/);
    expect(src).not.toMatch(/eliminarItemCatalogo/);
  });

  it("la migración de desactivación quita la policy y el privilegio de delete del catálogo", () => {
    const sql = fs.readFileSync(
      path.join(process.cwd(), "supabase", "migrations", "20261021000300_desactivacion.sql"),
      "utf8"
    );
    expect(sql).toMatch(/drop policy if exists "Authenticated users can delete catalogo_items"/);
    expect(sql).toMatch(/revoke delete/i);
  });

  // clave/tipo son la identidad de la fila (ver CambiosItemCatalogo): esto ya
  // lo hace cumplir el tipo en tiempo de compilación (pasar `tipo` o `clave`
  // dentro de `cambios` es un error de TypeScript), este test es la
  // constancia de que la regla existe y por qué.
  it("CambiosItemCatalogo no declara tipo/clave como editables", () => {
    const bloque = src.slice(src.indexOf("interface CambiosItemCatalogo"), src.indexOf("actualizarItemCatalogo"));
    expect(bloque).not.toMatch(/\btipo\s*:/);
    expect(bloque).not.toMatch(/\bclave\s*:/);
  });
});

describe("obtenerCatalogo", () => {
  it("si la lectura falla tira, en vez de devolver un catálogo vacío (que abriría la calculadora en $0)", async () => {
    createClient.mockReturnValue(
      clienteFalso({
        select: () => ({
          eq: () => Promise.resolve({ data: null, error: { code: "500", message: "boom" } }),
        }),
      })
    );
    const { obtenerCatalogo } = await import("./catalogo");

    await expect(obtenerCatalogo("piscinas")).rejects.toThrow(/boom/);
  });

  it("trae el flag activo para que las calculadoras puedan respetar la baja", async () => {
    const select = vi.fn(() => ({ eq: () => Promise.resolve({ data: [], error: null }) }));
    createClient.mockReturnValue(clienteFalso({ select }));
    const { obtenerCatalogo } = await import("./catalogo");

    await obtenerCatalogo("piscinas");

    expect(select).toHaveBeenCalledWith(expect.stringContaining("activo"));
  });
});

describe("stock", () => {
  const fila = {
    id: "1", tipo: "piscinas", clave: "indusplast_caribe_550", descripcion: "Caribe 550", precio: 1,
    categoria: "Piscinas", unidad: "obra", activo: true, orden: null, updated_at: "2026-01-01T00:00:00.000Z",
  };

  it("si todavía no corrió la migración del stock, el catálogo se lee igual (sin stock)", async () => {
    const select = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { code: "42703", message: "column catalogo_items.stock does not exist" } })
      .mockResolvedValueOnce({ data: [fila], error: null });
    createClient.mockReturnValue(clienteFalso({ select }));
    const { listarItemsCatalogo } = await import("./catalogo");

    const r = await listarItemsCatalogo();

    expect(r.error).toBeNull();
    expect(r.items?.[0]).toMatchObject({ clave: "indusplast_caribe_550", stock: null });
    expect(select.mock.calls[1][0]).not.toContain("stock");
  });

  it("catalogo.ts ya no escribe el stock: no existe guardarStockItem ni hay un update de stock", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "lib", "catalogo.ts"), "utf8");
    expect(src).not.toMatch(/guardarStockItem/);
    expect(src).not.toMatch(/update\(\{\s*stock/);
  });

  it("actualizarItemCatalogo no manda stock salvo al tildar/destildar 'Llevar stock'", async () => {
    const eq = vi.fn(() => ({ select: () => Promise.resolve({ data: [{ id: "1" }], error: null }) }));
    const update = vi.fn(() => ({ eq }));
    createClient.mockReturnValue(clienteFalso({ update: update as never }));
    const { actualizarItemCatalogo } = await import("./catalogo");

    await actualizarItemCatalogo("1", { descripcion: "x", precio: 1, categoria: null, unidad: null, activo: true });
    expect((update.mock.calls as unknown[][])[0][0]).not.toHaveProperty("stock");

    await actualizarItemCatalogo("1", { descripcion: "x", precio: 1, categoria: null, unidad: null, activo: true, stock: 0 });
    expect((update.mock.calls as unknown[][])[1][0]).toMatchObject({ stock: 0 });
  });

  it("si la base rechaza dejar de llevar stock con unidades, lo explica en castellano", async () => {
    createClient.mockReturnValue(
      clienteFalso({
        update: (() => ({
          eq: () => ({ select: () => Promise.resolve({ data: null, error: { code: "ST010", message: "El stock no se modifica directamente" } }) }),
        })) as never,
      })
    );
    const { actualizarItemCatalogo } = await import("./catalogo");
    const r = await actualizarItemCatalogo("1", { descripcion: "x", precio: 1, categoria: null, unidad: null, activo: true, stock: null });
    expect(r.error).toMatch(/Ajustar conteo/);
  });
});
