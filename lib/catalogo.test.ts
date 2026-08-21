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
  select?: () => Promise<{ data: unknown; error: unknown }>;
  update?: () => { eq: () => { select: () => Promise<{ data: unknown; error: unknown }> } };
}) {
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    from: () => ({
      select: overrides.select ?? (() => Promise.resolve({ data: [], error: null })),
      update: overrides.update,
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
