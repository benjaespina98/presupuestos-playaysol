import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ createClient }));

const AUTH = { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) };

const FILA_MATERIAL = {
  id: "m1",
  nombre: "Cemento",
  proveedor_id: null,
  unidad: "bolsa",
  precio: 100,
  precio_actualizado: "2026-06-18",
  rubro: "Materiales",
  aplica: "Siempre",
  usd_ref: null,
  notas: null,
  cantidades: {},
  activo: true,
  orden: null,
  updated_at: "2026-01-01T00:00:00.000Z",
};

const DATOS = {
  nombre: "Cemento",
  proveedor_id: null,
  unidad: "bolsa",
  precio: 100,
  rubro: "Materiales",
  aplica: "Siempre",
  usd_ref: null,
  notas: null,
  cantidades: {},
  activo: true,
};

function clienteEscritura(resultado: { data: unknown; error: unknown }) {
  const select = vi.fn(() => Promise.resolve(resultado));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn<(fila: Record<string, unknown>) => { eq: typeof eq }>(() => ({ eq }));
  const insert = vi.fn<(fila: Record<string, unknown>) => { select: typeof select }>(() => ({ select }));
  return { cliente: { auth: AUTH, from: () => ({ update, insert }) }, update, insert, eq };
}

describe("listar", () => {
  it("descarta una fila que no valida sin tirar abajo el resto", async () => {
    createClient.mockReturnValue({
      from: () => ({
        select: () => Promise.resolve({ data: [FILA_MATERIAL, { id: "rota" }], error: null }),
      }),
    });
    const { listarMateriales } = await import("./abastecimiento");

    const r = await listarMateriales();

    expect(r.error).toBeNull();
    expect(r.items?.map((m) => m.id)).toEqual(["m1"]);
  });

  it("si la tabla no existe (migración pendiente) lo dice con claridad", async () => {
    createClient.mockReturnValue({
      from: () => ({
        select: () =>
          Promise.resolve({ data: null, error: { code: "PGRST205", message: "Could not find the table 'public.materiales'" } }),
      }),
    });
    const { listarProveedores, ERROR_TABLAS_PENDIENTES } = await import("./abastecimiento");

    const r = await listarProveedores();

    expect(r.items).toBeNull();
    expect(r.error).toBe(ERROR_TABLAS_PENDIENTES);
    expect(r.error).toMatch(/migration_proveedores_materiales\.sql/);
  });

  it("nunca rechaza la promesa: un fallo de red viaja en el resultado", async () => {
    createClient.mockReturnValue({
      from: () => ({ select: () => Promise.reject(new TypeError("Failed to fetch")) }),
    });
    const { listarMateriales } = await import("./abastecimiento");

    const r = await listarMateriales();

    expect(r.items).toBeNull();
    expect(r.error).toMatch(/no se pudo conectar/i);
  });
});

describe("guardarMaterial", () => {
  it("en un alta guarda la fecha del precio de hoy", async () => {
    const { cliente, insert } = clienteEscritura({ data: [FILA_MATERIAL], error: null });
    createClient.mockReturnValue(cliente);
    const { guardarMaterial } = await import("./abastecimiento");

    const r = await guardarMaterial(null, DATOS);

    expect(r.error).toBeNull();
    const fila = insert.mock.calls[0][0];
    expect(fila.precio_actualizado).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fila.updated_by).toBe("u1");
  });

  it("al editar SIN cambiar el precio no toca la fecha del precio", async () => {
    const { cliente, update, eq } = clienteEscritura({ data: [FILA_MATERIAL], error: null });
    createClient.mockReturnValue(cliente);
    const { guardarMaterial } = await import("./abastecimiento");

    await guardarMaterial("m1", { ...DATOS, notas: "una nota" }, 100);

    expect(eq).toHaveBeenCalledWith("id", "m1");
    expect(update.mock.calls[0][0]).not.toHaveProperty("precio_actualizado");
  });

  it("al editar CAMBIANDO el precio refresca la fecha", async () => {
    const { cliente, update } = clienteEscritura({ data: [FILA_MATERIAL], error: null });
    createClient.mockReturnValue(cliente);
    const { guardarMaterial } = await import("./abastecimiento");

    await guardarMaterial("m1", { ...DATOS, precio: 150 }, 100);

    expect(update.mock.calls[0][0]).toHaveProperty("precio_actualizado");
  });

  it("pasar de a cotizar (null) a un precio también cuenta como cambio", async () => {
    const { cliente, update } = clienteEscritura({ data: [FILA_MATERIAL], error: null });
    createClient.mockReturnValue(cliente);
    const { guardarMaterial } = await import("./abastecimiento");

    await guardarMaterial("m1", { ...DATOS, precio: 150 }, null);

    expect(update.mock.calls[0][0]).toHaveProperty("precio_actualizado");
  });

  it("un nombre repetido da un mensaje claro", async () => {
    const { cliente } = clienteEscritura({ data: null, error: { code: "23505", message: "duplicate key" } });
    createClient.mockReturnValue(cliente);
    const { guardarMaterial } = await import("./abastecimiento");

    const r = await guardarMaterial(null, DATOS);

    expect(r.item).toBeNull();
    expect(r.error).toMatch(/ya existe un material/i);
  });

  it("editar algo que ya no existe (0 filas) no dice 'guardado'", async () => {
    const { cliente } = clienteEscritura({ data: [], error: null });
    createClient.mockReturnValue(cliente);
    const { guardarMaterial } = await import("./abastecimiento");

    const r = await guardarMaterial("m1", DATOS, 100);

    expect(r.item).toBeNull();
    expect(r.error).toMatch(/ya no existe/i);
  });
});

describe("proveedores y materiales no se borran", () => {
  it("lib/abastecimiento.ts no tiene ningún .delete(): se desactivan (activo = false)", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "lib", "abastecimiento.ts"), "utf8");
    expect(src).not.toMatch(/\.delete\(/);
    expect(src).not.toMatch(/eliminarProveedor|eliminarMaterial/);
  });

  it("desactivar es un update de activo por id, como cualquier otra edición", async () => {
    const select = vi.fn(() => Promise.resolve({ data: [{ ...FILA_MATERIAL, activo: false }], error: null }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn<(fila: Record<string, unknown>) => { eq: typeof eq }>(() => ({ eq }));
    createClient.mockReturnValue({ auth: AUTH, from: () => ({ update }) });
    const { guardarMaterial } = await import("./abastecimiento");

    const r = await guardarMaterial("p1", { ...DATOS, activo: false });

    expect(r.error).toBeNull();
    expect(update.mock.calls[0][0]).toMatchObject({ activo: false });
    // Quién y cuándo lo desactivó los fija la base (trigger), el cliente no los manda.
    expect(update.mock.calls[0][0]).not.toHaveProperty("desactivado_at");
    expect(update.mock.calls[0][0]).not.toHaveProperty("desactivado_por");
    expect(eq).toHaveBeenCalledWith("id", "p1");
  });
});
