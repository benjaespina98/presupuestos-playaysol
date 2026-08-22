import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import { crearLinea } from "@/lib/domain/precios/tipos";
import { generarDocxRevestimientos, TEXTOS_POR_DEFECTO_REVESTIMIENTOS } from "./docx";

function snapshotBase(overrides: Partial<PresupuestoV1> = {}): PresupuestoV1 {
  return {
    v: 1,
    tipo: "revestimientos",
    fecha: "20/08/2026",
    validezDias: "7",
    cliente: { nombre: "Gómez", domicilio: "", localidad: "", telefono: "", email: "" },
    medidas: { largo: 8, ancho: 4, profMin: 1.5, profMax: 0, escalera: 0, desperdicio: 0, adicionalesM2: [] },
    lineas: [],
    preciosBase: {},
    totales: [7616000],
    detalle: "",
    variacionEncabezado: "teal",
    modoPrecio: "ambos",
    fotos: [],
    ...overrides,
  };
}

describe("generarDocxRevestimientos", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3, 4]).buffer) })
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("genera un .docx válido (firma ZIP 'PK') con una alternativa", async () => {
    const snapshot = snapshotBase({
      lineas: [
        crearLinea({
          clave: "revestimiento_ceramico_bali",
          descripcion: "Cerámico Bali Brasil (por m² instalado)",
          unidad: "m²",
          cantidad: 1,
          precioUnitario: 112000,
          total: 7616000,
          naturaleza: "alternativa",
          incluida: true,
          origen: "catalogo",
        }),
      ],
    });
    const blob = await generarDocxRevestimientos(snapshot, [], TEXTOS_POR_DEFECTO_REVESTIMIENTOS);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]);
  });

  it("no explota con dos alternativas (dos líneas de total)", async () => {
    const snapshot = snapshotBase({
      totales: [7616000, 9520000],
      lineas: [
        crearLinea({
          clave: "revestimiento_ceramico_bali",
          descripcion: "Cerámico Bali Brasil (por m² instalado)",
          unidad: "m²",
          cantidad: 1,
          precioUnitario: 112000,
          total: 7616000,
          naturaleza: "alternativa",
          incluida: true,
          origen: "catalogo",
        }),
        crearLinea({
          clave: "venecitas_premium_espana",
          descripcion: "Venecitas Premium España (por m² instalado)",
          unidad: "m²",
          cantidad: 1,
          precioUnitario: 140000,
          total: 9520000,
          naturaleza: "alternativa",
          incluida: true,
          origen: "catalogo",
        }),
      ],
    });
    const blob = await generarDocxRevestimientos(snapshot, [], TEXTOS_POR_DEFECTO_REVESTIMIENTOS);
    expect(blob.size).toBeGreaterThan(1000);
  });

  it("un material con clave conocida (cerámico Bali) pide sus fotos de referencia", async () => {
    const snapshot = snapshotBase({
      lineas: [
        crearLinea({
          clave: "revestimiento_ceramico_bali",
          descripcion: "Cerámico Bali Brasil (por m² instalado)",
          unidad: "m²",
          cantidad: 1,
          precioUnitario: 112000,
          total: 7616000,
          naturaleza: "alternativa",
          incluida: true,
          origen: "catalogo",
        }),
      ],
    });
    await generarDocxRevestimientos(snapshot, [], TEXTOS_POR_DEFECTO_REVESTIMIENTOS);
    const urlsPedidas = vi.mocked(fetch).mock.calls.map((c) => String(c[0]));
    expect(urlsPedidas).toEqual(
      expect.arrayContaining(["/seeds/revestimiento_ceramico_bali-1-c19833a5.jpg"])
    );
  });

  it("un material sin fotos asociadas (venecitas) no pide ninguna foto de referencia", async () => {
    const snapshot = snapshotBase({
      lineas: [
        crearLinea({
          clave: "venecitas_premium_espana",
          descripcion: "Venecitas Premium España (por m² instalado)",
          unidad: "m²",
          cantidad: 1,
          precioUnitario: 140000,
          total: 9520000,
          naturaleza: "alternativa",
          incluida: true,
          origen: "catalogo",
        }),
      ],
    });
    await generarDocxRevestimientos(snapshot, [], TEXTOS_POR_DEFECTO_REVESTIMIENTOS);
    const urlsPedidas = vi.mocked(fetch).mock.calls.map((c) => String(c[0]));
    expect(urlsPedidas.some((u) => u.includes("/seeds/"))).toBe(false);
  });
});
