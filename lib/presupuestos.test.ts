import { describe, expect, it } from "vitest";
import { resumenPresupuesto } from "./presupuestos";

/**
 * `resumenPresupuesto` convive con dos formatos de `datos` desde la Fase 5:
 * v0 (legacy, medidas sueltas en la raíz) y v1 (medidas anidadas en
 * `datos.medidas`, con los nombres de campo del motor nuevo). Ver el
 * comentario junto a la función para el mapeo completo de nombres.
 */
describe("resumenPresupuesto · v1 (anidado en `medidas`)", () => {
  it("cercos: lee medidas.metrosLineales", () => {
    expect(resumenPresupuesto("cercos", { medidas: { metrosLineales: 42 } })).toBe("42 m lineales");
  });

  it("cobertores/revestimientos/losetas: leen medidas.largo/medidas.ancho", () => {
    expect(resumenPresupuesto("cobertores", { medidas: { largo: 8, ancho: 4 } })).toBe("8 x 4 m");
    expect(resumenPresupuesto("revestimientos", { medidas: { largo: 6, ancho: 3 } })).toBe("6 x 3 m");
    expect(resumenPresupuesto("losetas", { medidas: { largo: 10, ancho: 5 } })).toBe("10 x 5 m");
  });

  it("piscinas: lee `detalle` (top-level, no dentro de `medidas`)", () => {
    expect(
      resumenPresupuesto("piscinas", { medidas: {}, detalle: "7.00 mts largo por 3.00 mts ancho\nsegunda línea" })
    ).toBe("7.00 mts largo por 3.00 mts ancho");
  });

  it("piscinas: recorta el texto largo a 55 caracteres con puntos suspensivos", () => {
    const largo = "a".repeat(80);
    const resumen = resumenPresupuesto("piscinas", { medidas: {}, detalle: largo });
    expect(resumen).toBe("a".repeat(55) + "…");
  });
});

describe("resumenPresupuesto · v0 (legacy, en la raíz)", () => {
  it("cercos: cae a `ml` cuando no hay `medidas`", () => {
    expect(resumenPresupuesto("cercos", { ml: 30 })).toBe("30 m lineales");
  });

  it("cobertores/revestimientos/losetas: caen a `largo`/`ancho` de la raíz", () => {
    expect(resumenPresupuesto("cobertores", { largo: 8, ancho: 4 })).toBe("8 x 4 m");
    expect(resumenPresupuesto("losetas", { largo: 8, ancho: 4 })).toBe("8 x 4 m");
  });

  it("piscinas: cae a `dimension`", () => {
    expect(resumenPresupuesto("piscinas", { dimension: "7.00 mts largo por 3.00 mts ancho" })).toBe(
      "7.00 mts largo por 3.00 mts ancho"
    );
  });
});

describe("resumenPresupuesto · si existen los dos formatos, gana v1", () => {
  it("cercos: `medidas.metrosLineales` le gana a `ml` de la raíz", () => {
    expect(resumenPresupuesto("cercos", { ml: 30, medidas: { metrosLineales: 42 } })).toBe("42 m lineales");
  });

  it("losetas: `medidas.largo/ancho` le gana a `largo`/`ancho` de la raíz", () => {
    expect(resumenPresupuesto("losetas", { largo: 1, ancho: 1, medidas: { largo: 10, ancho: 5 } })).toBe("10 x 5 m");
  });

  it("piscinas: `detalle` le gana a `dimension`", () => {
    expect(resumenPresupuesto("piscinas", { dimension: "texto viejo", detalle: "texto nuevo" })).toBe("texto nuevo");
  });
});

describe("resumenPresupuesto · ausencia y medidas parciales", () => {
  it("sin datos: string vacío para cualquier tipo", () => {
    for (const tipo of ["piscinas", "cercos", "cobertores", "revestimientos", "losetas"] as const) {
      expect(resumenPresupuesto(tipo, null)).toBe("");
      expect(resumenPresupuesto(tipo, {})).toBe("");
    }
  });

  it("cobertores/losetas: si falta uno de los dos lados (ni v1 ni v0), no arma el resumen", () => {
    expect(resumenPresupuesto("cobertores", { medidas: { largo: 8 } })).toBe("");
    expect(resumenPresupuesto("losetas", { largo: 8 } as unknown as Record<string, unknown>)).toBe("");
  });

  it("cobertores: completa desde la raíz el lado que falte en `medidas`", () => {
    // Caso sintético (no debería darse en datos reales, `medidas` siempre trae
    // los dos campos juntos si es v1) — pero la función no debería explotar
    // ni mezclar mal si un lado viene de cada lado.
    expect(resumenPresupuesto("cobertores", { medidas: { largo: 8 }, ancho: 4 })).toBe("8 x 4 m");
  });

  it("`medidas` con valor 0 no cuenta como presente: cae al valor de la raíz", () => {
    expect(resumenPresupuesto("cercos", { ml: 30, medidas: { metrosLineales: 0 } })).toBe("30 m lineales");
  });

  it("`medidas` que no es un objeto no rompe nada", () => {
    expect(resumenPresupuesto("cercos", { ml: 30, medidas: "no es un objeto" })).toBe("30 m lineales");
  });

  it("tipo sin resumen definido devuelve string vacío", () => {
    expect(resumenPresupuesto("piscinas", { medidas: { largo: 8, ancho: 4 } })).toBe("");
  });
});
