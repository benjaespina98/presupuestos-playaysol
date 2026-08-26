import { describe, expect, it } from "vitest";
import type { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import { TEXTOS_POR_DEFECTO_COBERTORES } from "@/lib/documentos/cobertores/docx";
import type { BloqueDocumento } from "@/lib/documentos/modelo";
import { armarBloquesCobertor } from "./bloques";

function snapshotBase(overrides: Partial<PresupuestoV1> = {}): PresupuestoV1 {
  return {
    v: 1,
    tipo: "cobertores",
    fecha: "20/08/2026",
    validezDias: "7",
    cliente: { nombre: "Ruiz", domicilio: "", localidad: "", telefono: "", email: "" },
    medidas: { largo: 5, ancho: 3, adicionalM2: 0 },
    lineas: [],
    preciosBase: {},
    totales: [163545],
    detalle: "",
    variacionEncabezado: "teal",
    modoPrecio: "sin",
    fotos: [],
    ...overrides,
  };
}

function armar(overrides: Partial<PresupuestoV1> = {}): BloqueDocumento[] {
  return armarBloquesCobertor(snapshotBase(overrides), TEXTOS_POR_DEFECTO_COBERTORES, []);
}

describe("armarBloquesCobertor", () => {
  it("la meta muestra la superficie derivada de largo × ancho", () => {
    const bloques = armar();
    const meta = bloques.find((b) => b.tipo === "meta");
    if (meta?.tipo !== "meta") throw new Error("unreachable");
    expect(meta.pares).toContainEqual({
      label: "Medidas:",
      value: "5 m largo × 3 m ancho = 15 m² = 15 m² a cubrir",
    });
  });

  it("con adicional de m² lo suma y lo detalla aparte", () => {
    const bloques = armar({ medidas: { largo: 5, ancho: 3, adicionalM2: 2 } });
    const meta = bloques.find((b) => b.tipo === "meta");
    if (meta?.tipo !== "meta") throw new Error("unreachable");
    expect(meta.pares).toContainEqual({
      label: "Medidas:",
      value: "5 m largo × 3 m ancho = 15 m² + Adicional: 2 m² = 17 m² a cubrir",
    });
  });

  it("las fotos de referencia de cobertores van cerca del encabezado", () => {
    const bloques = armar();
    const idx = bloques.findIndex((b) => b.tipo === "galeriaSeeds");
    expect(idx).toBeGreaterThan(0);
    expect(idx).toBeLessThanOrEqual(3);
  });
});
