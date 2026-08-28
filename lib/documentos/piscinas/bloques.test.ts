import { describe, expect, it } from "vitest";
import type { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import { crearLinea } from "@/lib/domain/precios/tipos";
import { TEXTOS_POR_DEFECTO_PISCINAS } from "@/lib/documentos/piscinas/docx";
import type { BloqueDocumento } from "@/lib/documentos/modelo";
import { armarBloquesPiscina } from "./bloques";

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

function armar(overrides: Partial<PresupuestoV1> = {}): BloqueDocumento[] {
  return armarBloquesPiscina(snapshotBase(overrides), TEXTOS_POR_DEFECTO_PISCINAS, []);
}

describe("armarBloquesPiscina · reglas propias", () => {
  it("el heading 'Dimensión piscina' aparece incluso sin contenido", () => {
    const bloques = armar({ detalle: "" });
    const bloque = bloques.find((b) => b.tipo === "listaDetalle");
    expect(bloque).toMatchObject({ titulo: "Dimensión piscina", lineas: [], siempreVisible: true });
  });

  it("sin adicionales, no hay renglón TOTAL", () => {
    const bloques = armar();
    const totales = bloques.find((b) => b.tipo === "seccionPrecios" && b.variante === "totales");
    expect(totales?.tipo).toBe("seccionPrecios");
    if (totales?.tipo !== "seccionPrecios") throw new Error("unreachable");
    expect(totales.renglones.map((r) => r.descripcion)).toEqual(["SUBTOTAL"]);
  });

  it("con un adicional, aparece TOTAL con regla superior", () => {
    const bloques = armar({
      lineas: [
        crearLinea({
          clave: null,
          descripcion: "Extra",
          unidad: null,
          cantidad: 1,
          precioUnitario: 100000,
          naturaleza: "cotiza",
          incluida: true,
          origen: "manual",
        }),
      ],
      totales: [18500000, 18600000],
    });
    const totales = bloques.find((b) => b.tipo === "seccionPrecios" && b.variante === "totales");
    if (totales?.tipo !== "seccionPrecios") throw new Error("unreachable");
    expect(totales.renglones.map((r) => r.descripcion)).toEqual(["SUBTOTAL", "Extra", "TOTAL"]);
    expect(totales.renglones[2]).toMatchObject({ reglaSuperior: true, grande: true, destacado: true });
  });

  it("un opcional NO tildado igual aparece, con monto null ('No incluye')", () => {
    const bloques = armar({
      lineas: [
        crearLinea({
          clave: "bano_quimico",
          descripcion: "Baño químico",
          unidad: null,
          cantidad: 1,
          precioUnitario: null,
          naturaleza: "informativa",
          incluida: false,
          origen: "catalogo",
        }),
      ],
    });
    const tarjeta = bloques.find((b) => b.tipo === "tarjetaOpcional");
    expect(tarjeta).toMatchObject({ descripcion: "Baño químico", monto: null });
  });

  it("un opcional tildado con precio muestra el importe formateado", () => {
    const bloques = armar({
      lineas: [
        crearLinea({
          clave: "luces",
          descripcion: "Luces de acero inoxidable",
          unidad: null,
          cantidad: 1,
          precioUnitario: 240000,
          naturaleza: "informativa",
          incluida: true,
          origen: "catalogo",
        }),
      ],
    });
    const tarjeta = bloques.find((b) => b.tipo === "tarjetaOpcional");
    expect(tarjeta).toMatchObject({ monto: "$ 240.000" });
  });

  it("'Modelos de referencia' va al final, después del pie", () => {
    const bloques = armar();
    const tipos = bloques.map((b) => b.tipo);
    expect(tipos.indexOf("pie")).toBeLessThan(tipos.lastIndexOf("galeriaSeeds"));
  });
});
