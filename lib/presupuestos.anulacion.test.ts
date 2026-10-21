import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ createClient }));

function clienteEscritura(resultado: { data: unknown; error: unknown }) {
  const select = vi.fn(() => Promise.resolve(resultado));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn<(fila: Record<string, unknown>) => { eq: typeof eq }>(() => ({ eq }));
  return { cliente: { from: () => ({ update }) }, update, eq };
}

describe("anularPresupuesto", () => {
  it("anula por id mandando sólo el motivo recortado (quién y cuándo los pone la base)", async () => {
    const { cliente, update, eq } = clienteEscritura({ data: [{ id: "p1" }], error: null });
    createClient.mockReturnValue(cliente);
    const { anularPresupuesto } = await import("./presupuestos");

    expect((await anularPresupuesto("p1", "  Se cargó dos veces ")).error).toBeNull();
    expect(update.mock.calls[0][0]).toEqual({ anulado_motivo: "Se cargó dos veces" });
    expect(eq).toHaveBeenCalledWith("id", "p1");
  });

  it("sin motivo válido no llama a la base", async () => {
    const { cliente, update } = clienteEscritura({ data: [{ id: "p1" }], error: null });
    createClient.mockReturnValue(cliente);
    const { anularPresupuesto } = await import("./presupuestos");

    expect((await anularPresupuesto("p1", "")).error?.message).toMatch(/motivo/i);
    expect(update).not.toHaveBeenCalled();
  });

  it("0 filas afectadas (RLS: lo creó otra persona) es un error, no un éxito silencioso", async () => {
    createClient.mockReturnValue(clienteEscritura({ data: [], error: null }).cliente);
    const { anularPresupuesto } = await import("./presupuestos");
    expect((await anularPresupuesto("p1", "Duplicado")).error?.message).toMatch(/solo su autor/);
  });

  it("traduce el rechazo de la base a un registro ya anulado", async () => {
    createClient.mockReturnValue(
      clienteEscritura({ data: null, error: { message: "El registro está anulado y no se puede modificar." } }).cliente
    );
    const { anularPresupuesto } = await import("./presupuestos");
    expect((await anularPresupuesto("p1", "Otra vez")).error?.message).toMatch(/ya está anulado/);
  });
});

describe("actualizarPresupuesto sobre un presupuesto anulado", () => {
  it("avisa en castellano que no se puede modificar", async () => {
    createClient.mockReturnValue(
      clienteEscritura({ data: null, error: { message: "El registro está anulado y no se puede modificar." } }).cliente
    );
    const { actualizarPresupuesto } = await import("./presupuestos");
    expect((await actualizarPresupuesto("p1", {}, "Pérez")).error?.message).toMatch(/ya está anulado/);
  });
});

describe("obtenerUltimoPresupuesto", () => {
  it("no ofrece para duplicar un presupuesto anulado", async () => {
    const is = vi.fn(() => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }));
    createClient.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ is }) }) }) });
    const { obtenerUltimoPresupuesto } = await import("./presupuestos");
    await obtenerUltimoPresupuesto("piscinas");
    expect(is).toHaveBeenCalledWith("anulado_at", null);
  });
});

describe("presupuestos no se borran", () => {
  it("lib/presupuestos.ts no tiene ningún .delete() sobre la tabla", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "lib", "presupuestos.ts"), "utf8");
    expect(src).not.toMatch(/\.delete\(/);
  });
});
