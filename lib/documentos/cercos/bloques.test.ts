import { describe, expect, it } from "vitest";
import type { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import { crearLinea } from "@/lib/domain/precios/tipos";
import { TEXTOS_POR_DEFECTO_CERCOS } from "@/lib/documentos/cercos/docx";
import type { BloqueDocumento } from "@/lib/documentos/modelo";
import { armarBloquesCerco } from "./bloques";

function snapshotBase(overrides: Partial<PresupuestoV1> = {}): PresupuestoV1 {
  return {
    v: 1,
    tipo: "cercos",
    fecha: "20/08/2026",
    validezDias: "7",
    cliente: { nombre: "Díaz", domicilio: "", localidad: "", telefono: "", email: "" },
    medidas: { metrosLineales: 24 },
    lineas: [],
    preciosBase: {},
    totales: [1908000],
    detalle: "",
    variacionEncabezado: "teal",
    modoPrecio: "ambos",
    fotos: [],
    ...overrides,
  };
}

function armar(overrides: Partial<PresupuestoV1> = {}): BloqueDocumento[] {
  return armarBloquesCerco(snapshotBase(overrides), TEXTOS_POR_DEFECTO_CERCOS, []);
}

function opcional(overrides: Record<string, unknown> = {}) {
  return crearLinea({
    clave: "cerco_perimetral",
    descripcion: "Portón corredizo",
    unidad: null,
    cantidad: 1,
    precioUnitario: null,
    naturaleza: "informativa",
    incluida: false,
    origen: "catalogo",
    ...overrides,
  });
}

describe("armarBloquesCerco", () => {
  it("un opcional NO tildado no aparece en absoluto (a diferencia de piscinas)", () => {
    const bloques = armar({ lineas: [opcional({ incluida: false })] });
    expect(bloques.some((b) => b.tipo === "tituloSeccion" && b.texto === "Opcionales")).toBe(false);
    expect(bloques.some((b) => b.tipo === "tarjetaOpcional")).toBe(false);
  });

  it("un opcional tildado sí aparece, con su precio", () => {
    const bloques = armar({ lineas: [opcional({ incluida: true, precioUnitario: 500000 })] });
    const tarjeta = bloques.find((b) => b.tipo === "tarjetaOpcional");
    expect(tarjeta).toMatchObject({ descripcion: "Portón corredizo", monto: "$ 500.000" });
  });

  it("modoPrecio 'sin' da un solo renglón TOTAL", () => {
    const bloques = armar({ modoPrecio: "sin", totales: [1908000] });
    const totales = bloques.find((b) => b.tipo === "seccionPrecios" && b.variante === "totales");
    if (totales?.tipo !== "seccionPrecios") throw new Error("unreachable");
    expect(totales.renglones.map((r) => r.descripcion)).toEqual(["TOTAL"]);
  });

  it("modoPrecio 'ambos' da dos renglones (sin/con instalación)", () => {
    const bloques = armar({ modoPrecio: "ambos", totales: [1512000, 1908000] });
    const totales = bloques.find((b) => b.tipo === "seccionPrecios" && b.variante === "totales");
    if (totales?.tipo !== "seccionPrecios") throw new Error("unreachable");
    expect(totales.renglones.map((r) => r.descripcion)).toEqual(["TOTAL SIN INSTALACIÓN", "TOTAL CON INSTALACIÓN"]);
  });

  it("la meta incluye los metros lineales a cercar", () => {
    const bloques = armar();
    const meta = bloques.find((b) => b.tipo === "meta");
    if (meta?.tipo !== "meta") throw new Error("unreachable");
    expect(meta.pares).toContainEqual({ label: "Metros lineales a cercar:", value: "24 ml" });
  });
});
