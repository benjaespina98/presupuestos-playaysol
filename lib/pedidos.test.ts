import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PARAMETROS_POR_DEFECTO } from "@/lib/domain/abastecimiento/pedido";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ createClient }));

const AUTH = { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) };

const FILA = {
  id: "p1",
  numero: 7,
  obra: "Familia Pérez",
  solicitante: "Benja",
  parametros: PARAMETROS_POR_DEFECTO,
  lineas: [],
  costo: 1000,
  estado: "borrador",
  notas: null,
  created_at: "2026-10-05T00:00:00Z",
  updated_at: "2026-10-05T00:00:00Z",
};

const DATOS = {
  obra: "  Familia Pérez ",
  solicitante: " Benja ",
  parametros: PARAMETROS_POR_DEFECTO,
  lineas: [],
  costo: 1000,
  notas: "  ",
};

describe("listarPedidos", () => {
  it("los trae ordenados del más nuevo al más viejo y descarta una fila que no valida", async () => {
    createClient.mockReturnValue({
      from: () => ({
        select: () =>
          Promise.resolve({
            data: [{ ...FILA, id: "a", numero: 1 }, { ...FILA, id: "c", numero: 3 }, { id: "rota" }, { ...FILA, id: "b", numero: 2 }],
            error: null,
          }),
      }),
    });
    const { listarPedidos } = await import("./pedidos");

    const r = await listarPedidos();

    expect(r.error).toBeNull();
    expect(r.items?.map((p) => p.numero)).toEqual([3, 2, 1]);
  });

  it("si la tabla no existe (migración pendiente) lo dice con claridad", async () => {
    createClient.mockReturnValue({
      from: () => ({ select: () => Promise.resolve({ data: null, error: { code: "PGRST205", message: "Could not find the table 'public.pedidos'" } }) }),
    });
    const { listarPedidos, ERROR_TABLA_PEDIDOS } = await import("./pedidos");

    const r = await listarPedidos();

    expect(r.items).toBeNull();
    expect(r.error).toBe(ERROR_TABLA_PEDIDOS);
    expect(r.error).toMatch(/migration_pedidos\.sql/);
  });

  it("nunca rechaza la promesa: un fallo de red viaja en el resultado", async () => {
    createClient.mockReturnValue({ from: () => ({ select: () => Promise.reject(new TypeError("Failed to fetch")) }) });
    const { listarPedidos } = await import("./pedidos");
    expect((await listarPedidos()).error).toMatch(/no se pudo conectar/i);
  });
});

describe("guardarPedido", () => {
  function clienteInsert(resultado: { data: unknown; error: unknown }) {
    const single = vi.fn(() => Promise.resolve(resultado));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn<(fila: Record<string, unknown>) => { select: typeof select }>(() => ({ select }));
    return { cliente: { auth: AUTH, from: () => ({ insert }) }, insert };
  }

  it("guarda el pedido sin número (lo asigna la base), con el texto recortado y quién lo creó", async () => {
    const { cliente, insert } = clienteInsert({ data: FILA, error: null });
    createClient.mockReturnValue(cliente);
    const { guardarPedido } = await import("./pedidos");

    const r = await guardarPedido(DATOS);

    expect(r.error).toBeNull();
    expect(r.pedido?.numero).toBe(7);
    const fila = insert.mock.calls[0][0];
    expect(fila).not.toHaveProperty("numero");
    expect(fila).toMatchObject({ obra: "Familia Pérez", solicitante: "Benja", notas: null, costo: 1000, created_by: "u1" });
  });

  it("si falla da el mensaje; si la tabla no existe, el aviso de la migración", async () => {
    createClient.mockReturnValue(clienteInsert({ data: null, error: { code: "42P01", message: "undefined_table" } }).cliente);
    const { guardarPedido, ERROR_TABLA_PEDIDOS } = await import("./pedidos");
    expect((await guardarPedido(DATOS)).error).toBe(ERROR_TABLA_PEDIDOS);

    createClient.mockReturnValue(clienteInsert({ data: null, error: { message: "boom" } }).cliente);
    const r = await guardarPedido(DATOS);
    expect(r.pedido).toBeNull();
    expect(r.error).toBe("boom");
  });

  it("una respuesta que no valida no se hace pasar por guardada", async () => {
    createClient.mockReturnValue(clienteInsert({ data: { id: "x" }, error: null }).cliente);
    const { guardarPedido } = await import("./pedidos");
    const r = await guardarPedido(DATOS);
    expect(r.pedido).toBeNull();
    expect(r.error).toMatch(/recargá/);
  });
});

describe("cambiarEstadoPedido / eliminarPedido", () => {
  function clienteEscritura(resultado: { data: unknown; error: unknown }) {
    const select = vi.fn(() => Promise.resolve(resultado));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn<(fila: Record<string, unknown>) => { eq: typeof eq }>(() => ({ eq }));
    const del = vi.fn(() => ({ eq }));
    return { cliente: { auth: AUTH, from: () => ({ update, delete: del }) }, update, eq };
  }

  it("cambia el estado por id y deja constancia de quién", async () => {
    const { cliente, update, eq } = clienteEscritura({ data: [{ id: "p1" }], error: null });
    createClient.mockReturnValue(cliente);
    const { cambiarEstadoPedido } = await import("./pedidos");

    expect((await cambiarEstadoPedido("p1", "enviado")).error).toBeNull();
    expect(update.mock.calls[0][0]).toEqual({ estado: "enviado", updated_by: "u1" });
    expect(eq).toHaveBeenCalledWith("id", "p1");
  });

  it("0 filas afectadas es un error, no un éxito silencioso", async () => {
    createClient.mockReturnValue(clienteEscritura({ data: [], error: null }).cliente);
    const { cambiarEstadoPedido, eliminarPedido } = await import("./pedidos");
    expect((await cambiarEstadoPedido("p1", "recibido")).error).toMatch(/ya no existe/);
    expect((await eliminarPedido("p1")).error).toMatch(/ya no existe o no tenés permiso/);
  });

  it("elimina de a uno, por id", async () => {
    const { cliente, eq } = clienteEscritura({ data: [{ id: "p1" }], error: null });
    createClient.mockReturnValue(cliente);
    const { eliminarPedido } = await import("./pedidos");
    expect((await eliminarPedido("p1")).error).toBeNull();
    expect(eq).toHaveBeenCalledWith("id", "p1");
  });
});

describe("migration_pedidos.sql", () => {
  const sql = fs.readFileSync(path.join(process.cwd(), "supabase", "migration_pedidos.sql"), "utf8");

  it("el número lo asigna la base (identity) y los estados son los del sistema", () => {
    expect(sql).toMatch(/numero bigint generated always as identity/);
    expect(sql).toMatch(/'borrador', 'enviado', 'recibido', 'cancelado'/);
  });

  it("no trae datos y habilita lectura y escritura al equipo", () => {
    expect(sql).not.toMatch(/insert into public\.pedidos/i);
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/array\['select', 'insert', 'update', 'delete'\]/);
  });
});
