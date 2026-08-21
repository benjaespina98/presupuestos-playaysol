import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import { crearLinea } from "@/lib/domain/precios/tipos";
import { generarDocxCercos, TEXTOS_POR_DEFECTO_CERCOS } from "./docx";

/**
 * `generarDocxCercos` no toca el DOM salvo para el header (fetch de
 * /header-teal.png) — sin fotos, no hace falta canvas/Image, así que corre
 * bajo Node sin mockear un browser entero. Se mockea sólo `fetch`.
 */
function snapshotBase(overrides: Partial<PresupuestoV1> = {}): PresupuestoV1 {
  return {
    v: 1,
    tipo: "cercos",
    fecha: "20/08/2026",
    validezDias: "7",
    cliente: {
      nombre: "Pérez, Juan",
      domicilio: "Av. Siempreviva 742",
      localidad: "Villa María",
      telefono: "353 400-0000",
      email: "juan@ejemplo.com",
    },
    medidas: { metrosLineales: 24 },
    lineas: [],
    preciosBase: { precioPorMlSinInstalacion: 63500, precioPorMlConInstalacion: 79500 },
    totales: [1524000, 1908000],
    detalle: "Perímetro completo de la piscina.",
    variacionEncabezado: "teal",
    modoPrecio: "ambos",
    fotos: [],
    ...overrides,
  };
}

describe("generarDocxCercos", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3, 4]).buffer),
      })
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("genera un .docx válido (firma ZIP 'PK') sin fotos", async () => {
    const blob = await generarDocxCercos(snapshotBase(), [], TEXTOS_POR_DEFECTO_CERCOS);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(1000);
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]);
  });

  it("pide el header correcto según variacionEncabezado", async () => {
    await generarDocxCercos(snapshotBase({ variacionEncabezado: "navy" }), [], TEXTOS_POR_DEFECTO_CERCOS);
    expect(fetch).toHaveBeenCalledWith("/header-navy.png");
  });

  it("usa el header teal por default si variacionEncabezado es desconocida", async () => {
    await generarDocxCercos(
      snapshotBase({ variacionEncabezado: "algo-raro" }),
      [],
      TEXTOS_POR_DEFECTO_CERCOS
    );
    expect(fetch).toHaveBeenCalledWith("/header-teal.png");
  });

  it("no explota con adicionales y opcionales cargados", async () => {
    const snapshot = snapshotBase({
      lineas: [
        crearLinea({
          clave: null,
          descripcion: "Traslado",
          unidad: null,
          cantidad: 1,
          precioUnitario: 350000,
          naturaleza: "cotiza",
          incluida: true,
          origen: "manual",
        }),
        crearLinea({
          clave: "porton_reforzado",
          descripcion: "Portón de acceso reforzado",
          unidad: null,
          cantidad: 1,
          precioUnitario: null,
          naturaleza: "informativa",
          incluida: true,
          origen: "catalogo",
        }),
      ],
    });
    const blob = await generarDocxCercos(snapshot, [], TEXTOS_POR_DEFECTO_CERCOS);
    expect(blob.size).toBeGreaterThan(1000);
  });

  it("respeta un texto legal / footer distinto del default (catálogo compartido)", async () => {
    const blob = await generarDocxCercos(snapshotBase(), [], {
      legal: "Texto legal reemplazado por el equipo.",
      footer: { ...TEXTOS_POR_DEFECTO_CERCOS.footer, whatsapp: "3530000000" },
    });
    expect(blob.size).toBeGreaterThan(1000);
  });
});
