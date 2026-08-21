import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import { generarDocxPiscinas, TEXTOS_POR_DEFECTO_PISCINAS } from "./docx";

function snapshotBase(overrides: Partial<PresupuestoV1> = {}): PresupuestoV1 {
  return {
    v: 1,
    tipo: "piscinas",
    fecha: "20/08/2026",
    validezDias: "7",
    cliente: { nombre: "Pérez, Juan", domicilio: "", localidad: "", telefono: "", email: "" },
    medidas: {},
    lineas: [],
    preciosBase: {},
    totales: [18500000],
    detalle: "",
    variacionEncabezado: "teal",
    modoPrecio: "ambos",
    fotos: [],
    ...overrides,
  };
}

describe("generarDocxPiscinas", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3, 4]).buffer) })
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("genera un .docx válido (firma ZIP 'PK')", async () => {
    const blob = await generarDocxPiscinas(snapshotBase(), [], TEXTOS_POR_DEFECTO_PISCINAS);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]);
  });
});
