import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import { generarDocxCobertores, TEXTOS_POR_DEFECTO_COBERTORES } from "./docx";

function snapshotBase(overrides: Partial<PresupuestoV1> = {}): PresupuestoV1 {
  return {
    v: 1,
    tipo: "cobertores",
    fecha: "20/08/2026",
    validezDias: "7",
    cliente: {
      nombre: "Gómez, Ana",
      domicilio: "Belgrano 100",
      localidad: "Villa María",
      telefono: "353 111-2222",
      email: "ana@ejemplo.com",
    },
    medidas: { largo: 8, ancho: 4, adicionalM2: 0 },
    lineas: [],
    preciosBase: { precioPorM2HastaUmbral: 10903, precioPorM2SobreUmbral: 9902, precioInstalacion: 100000 },
    totales: [316864, 416864],
    detalle: "",
    variacionEncabezado: "teal",
    modoPrecio: "ambos",
    fotos: [],
    ...overrides,
  };
}

describe("generarDocxCobertores", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3, 4]).buffer) })
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("genera un .docx válido (firma ZIP 'PK')", async () => {
    const blob = await generarDocxCobertores(snapshotBase(), [], TEXTOS_POR_DEFECTO_COBERTORES);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]);
  });

  it("pide las 2 fotos de referencia del cobertor, siempre", async () => {
    await generarDocxCobertores(snapshotBase(), [], TEXTOS_POR_DEFECTO_COBERTORES);
    const urlsPedidas = vi.mocked(fetch).mock.calls.map((c) => String(c[0]));
    expect(urlsPedidas).toEqual(
      expect.arrayContaining(["/seeds/general-1-adad76e0.jpg", "/seeds/general-2-a55d37fe.jpg"])
    );
  });
});
