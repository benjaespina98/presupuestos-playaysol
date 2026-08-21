import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import { crearLinea } from "@/lib/domain/precios/tipos";
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

  it("pide las fotos de referencia del opcional (cerco perimetral) además del logo y las generales", async () => {
    const snapshot = snapshotBase({
      lineas: [
        crearLinea({
          clave: "cerco_perimetral",
          descripcion: "Cerco perimetral",
          unidad: "ml",
          cantidad: 1,
          precioUnitario: 79500,
          naturaleza: "informativa",
          incluida: false,
          origen: "catalogo",
        }),
      ],
    });
    const blob = await generarDocxPiscinas(snapshot, [], TEXTOS_POR_DEFECTO_PISCINAS);
    expect(new Uint8Array(await blob.arrayBuffer()).length).toBeGreaterThan(0);

    const urlsPedidas = vi.mocked(fetch).mock.calls.map((c) => String(c[0]));
    expect(urlsPedidas).toEqual(
      expect.arrayContaining([
        "/seeds/cerco_perimetral-1-6dde6bea.jpg",
        "/seeds/cerco_perimetral-2-23004a23.jpg",
        "/seeds/general-1-454abd16.jpg",
      ])
    );
  });

  it("sin ningún opcional con fotos, igual pide las 3 fotos generales", async () => {
    await generarDocxPiscinas(snapshotBase(), [], TEXTOS_POR_DEFECTO_PISCINAS);
    const urlsPedidas = vi.mocked(fetch).mock.calls.map((c) => String(c[0]));
    const generales = urlsPedidas.filter((u) => u.includes("/seeds/general-"));
    expect(generales).toHaveLength(3);
  });
});
