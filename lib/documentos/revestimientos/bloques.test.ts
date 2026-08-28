import { describe, expect, it } from "vitest";
import type { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import { crearLinea } from "@/lib/domain/precios/tipos";
import { TEXTOS_POR_DEFECTO_REVESTIMIENTOS } from "@/lib/documentos/revestimientos/docx";
import type { BloqueDocumento } from "@/lib/documentos/modelo";
import { armarBloquesRevestimiento } from "./bloques";

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
    totales: [0],
    detalle: "",
    variacionEncabezado: "teal",
    modoPrecio: "ambos",
    fotos: [],
    ...overrides,
  };
}

function material(overrides: Record<string, unknown> = {}) {
  return crearLinea({
    clave: "revestimiento_ceramico_bali",
    descripcion: "Cerámico Bali Brasil (por m² instalado)",
    unidad: "m²",
    cantidad: 1,
    precioUnitario: 112000,
    total: 7616000,
    naturaleza: "alternativa",
    incluida: true,
    origen: "catalogo",
    ...overrides,
  });
}

function armar(overrides: Partial<PresupuestoV1> = {}): BloqueDocumento[] {
  return armarBloquesRevestimiento(snapshotBase(overrides), TEXTOS_POR_DEFECTO_REVESTIMIENTOS, []);
}

function totalesDe(bloques: BloqueDocumento[]) {
  const b = bloques.find((x) => x.tipo === "seccionPrecios" && x.variante === "totales");
  if (b?.tipo !== "seccionPrecios") throw new Error("no seccionPrecios/totales");
  return b.renglones;
}

describe("armarBloquesRevestimiento · la regla alternativa", () => {
  it("con dos materiales incluidos, dos renglones de total, no una suma", () => {
    const renglones = totalesDe(
      armar({
        totales: [7616000, 9520000],
        lineas: [
          material(),
          material({
            clave: "venecitas_premium_espana",
            descripcion: "Venecitas Premium España (por m² instalado)",
            precioUnitario: 140000,
            total: 9520000,
          }),
        ],
      })
    );
    expect(renglones.map((r) => r.descripcion)).toEqual([
      "TOTAL revestimiento con Cerámico Bali Brasil",
      "TOTAL revestimiento con Venecitas Premium España",
    ]);
    expect(renglones.map((r) => r.monto)).toEqual(["$ 7.616.000", "$ 9.520.000"]);
  });

  it("con un solo material, un solo renglón TOTAL REVESTIMIENTO", () => {
    const renglones = totalesDe(armar({ totales: [7616000], lineas: [material()] }));
    expect(renglones).toEqual([{ descripcion: "TOTAL REVESTIMIENTO", monto: "$ 7.616.000", grande: true, destacado: true }]);
  });

  it("un material NO incluido no aparece como tarjeta", () => {
    const bloques = armar({ lineas: [material({ incluida: false })] });
    expect(bloques.some((b) => b.tipo === "tarjetaOpcional")).toBe(false);
  });

  it("un material incluido pero sin precio da monto null y no cuenta para el umbral de 2", () => {
    const bloques = armar({
      totales: [0],
      lineas: [
        material({ precioUnitario: null, total: null }),
        material({ clave: "otro", descripcion: "Otro material", incluida: false }),
      ],
    });
    const tarjeta = bloques.find((b) => b.tipo === "tarjetaOpcional");
    expect(tarjeta).toMatchObject({ monto: null, subcaption: undefined });
    const renglones = totalesDe(bloques);
    expect(renglones[0].descripcion).toBe("TOTAL REVESTIMIENTO");
  });

  it("la leyenda 'por m² × total' sólo aparece cuando el material está cotizado", () => {
    const bloques = armar({ totales: [7616000], lineas: [material()] });
    const tarjeta = bloques.find((b) => b.tipo === "tarjetaOpcional");
    expect(tarjeta).toMatchObject({ subcaption: "$ 112.000 por m² × 68 m²" });
  });
});
