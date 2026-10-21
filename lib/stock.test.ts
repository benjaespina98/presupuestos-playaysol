import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ createClient }));

const OK = { movimiento_id: "m1", tipo: "venta", cantidad: -1, stock_resultante: 4, stock_negativo: false, repetido: false };

describe("lib/stock.ts · el navegador no escribe el stock", () => {
  beforeEach(() => createClient.mockReset());

  it("registrarMovimiento llama a la función con los parámetros y devuelve el resultado", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: OK, error: null });
    createClient.mockReturnValue({ rpc });
    const { registrarMovimiento } = await import("./stock");

    const r = await registrarMovimiento({ itemId: "i1", tipo: "venta", cantidad: 1, idempotencyKey: "clave-0001", referencia: "Pérez" });

    expect(rpc).toHaveBeenCalledWith("registrar_movimiento_stock", {
      p_item: "i1", p_tipo: "venta", p_cantidad: 1, p_idempotency_key: "clave-0001", p_referencia: "Pérez", p_motivo: null,
    });
    expect(r).toEqual({ resultado: OK, error: null });
  });

  it("ajustarConteo manda el conteo, no una diferencia", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ...OK, tipo: "ajuste" }, error: null });
    createClient.mockReturnValue({ rpc });
    const { ajustarConteo } = await import("./stock");

    await ajustarConteo({ itemId: "i1", stockContado: 25, motivo: "Conteo", idempotencyKey: "clave-0002" });

    expect(rpc).toHaveBeenCalledWith("ajustar_stock", { p_item: "i1", p_stock_contado: 25, p_motivo: "Conteo", p_idempotency_key: "clave-0002" });
  });

  it("anularMovimiento llama a la función de contra-asiento", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ...OK, tipo: "anulacion" }, error: null });
    createClient.mockReturnValue({ rpc });
    const { anularMovimiento } = await import("./stock");

    await anularMovimiento({ movimientoId: "m9", motivo: "Error", idempotencyKey: "clave-0003" });

    expect(rpc).toHaveBeenCalledWith("anular_movimiento_stock", { p_movimiento: "m9", p_motivo: "Error", p_idempotency_key: "clave-0003" });
  });

  it("traduce los errores de la base a castellano, sin texto interno", async () => {
    createClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "ST003", message: "Este ítem no lleva stock." } }),
    });
    const { registrarMovimiento } = await import("./stock");
    const r = await registrarMovimiento({ itemId: "i1", tipo: "ingreso", cantidad: 1, idempotencyKey: "clave-0004" });
    expect(r).toEqual({ resultado: null, error: "Este ítem no lleva stock." });
  });

  it("una respuesta con forma rara no se da por buena", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    createClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: { cualquier: "cosa" }, error: null }) });
    const { registrarMovimiento } = await import("./stock");
    const r = await registrarMovimiento({ itemId: "i1", tipo: "ingreso", cantidad: 1, idempotencyKey: "clave-0005" });
    expect(r.resultado).toBeNull();
    expect(r.error).toMatch(/Actualizá la pantalla/);
  });

  it("un corte de red no rechaza la promesa: vuelve como error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    createClient.mockReturnValue({ rpc: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")) });
    const { registrarMovimiento } = await import("./stock");
    const r = await registrarMovimiento({ itemId: "i1", tipo: "ingreso", cantidad: 1, idempotencyKey: "clave-0006" });
    expect(r.error).toMatch(/conectar/);
  });

  it("listarMovimientos marca anulados y resuelve quién los hizo", async () => {
    const filas = [
      { id: "b", item_id: "i1", tipo: "anulacion", cantidad: 1, stock_resultante: 3, motivo: "Error", referencia: null, anula_a: "a", creado_por: "u1", creado_at: "2026-10-22T11:00:00Z" },
      { id: "a", item_id: "i1", tipo: "venta", cantidad: -1, stock_resultante: 2, motivo: null, referencia: null, anula_a: null, creado_por: "u1", creado_at: "2026-10-22T10:00:00Z" },
      { id: "rota" },
    ];
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    createClient.mockReturnValue({
      from: (tabla: string) =>
        tabla === "movimientos_stock"
          ? { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: filas, error: null }) }) }) }
          : { select: () => ({ in: () => Promise.resolve({ data: [{ id: "u1", nombre: "Benja", email: "b@x.com" }], error: null }) }) },
    });
    const { listarMovimientos } = await import("./stock");

    const r = await listarMovimientos("i1");

    expect(r.error).toBeNull();
    expect(r.movimientos?.map((m) => [m.id, m.anulado, m.creadorNombre])).toEqual([
      ["b", false, "Benja"],
      ["a", true, "Benja"],
    ]);
  });

  it("el archivo no escribe nunca en catalogo_items ni en movimientos_stock: sólo lee y llama funciones", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "lib", "stock.ts"), "utf8");
    expect(src).not.toMatch(/\.(insert|update|upsert|delete)\(/);
  });
});

describe("el navegador no escribe stock en ningún lado", () => {
  it("ningún archivo de la app hace un update/insert con la columna stock fuera de 'llevar stock' (null/0)", () => {
    const carpetas = ["app", "components", "lib"];
    const ofensores: string[] = [];
    const recorrer = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const ruta = path.join(dir, e.name);
        if (e.isDirectory()) recorrer(ruta);
        else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
          const s = fs.readFileSync(ruta, "utf8");
          if (/\.(update|upsert)\(\s*\{[^}]*\bstock\b\s*[:,}]/.test(s)) ofensores.push(ruta);
        }
      }
    };
    for (const c of carpetas) recorrer(path.join(process.cwd(), c));
    expect(ofensores).toEqual([]);
  });
});
