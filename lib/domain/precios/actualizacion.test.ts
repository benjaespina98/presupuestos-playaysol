import { describe, expect, it } from "vitest";
import {
  aplicarPorcentaje,
  cambiosPendientes,
  interpretarPorcentaje,
  interpretarPrecio,
  textoVariacion,
  variacionPorcentual,
} from "./actualizacion";

describe("interpretarPrecio", () => {
  it("vacío = sin tocar; un número en formato argentino o de teclado se entiende", () => {
    expect(interpretarPrecio("")).toEqual({ tipo: "vacio" });
    expect(interpretarPrecio("   ")).toEqual({ tipo: "vacio" });
    expect(interpretarPrecio(undefined)).toEqual({ tipo: "vacio" });
    expect(interpretarPrecio("28500")).toEqual({ tipo: "valido", valor: 28500 });
    expect(interpretarPrecio("$ 28.500")).toEqual({ tipo: "valido", valor: 28500 });
    expect(interpretarPrecio("1.234,56")).toEqual({ tipo: "valido", valor: 1234.56 });
  });
  it("lo que no es un número, un negativo o un monto imposible es inválido", () => {
    expect(interpretarPrecio("abc")).toEqual({ tipo: "invalido" });
    expect(interpretarPrecio("-5")).toEqual({ tipo: "invalido" });
    expect(interpretarPrecio("99999999999999")).toEqual({ tipo: "invalido" });
  });
});

describe("aplicarPorcentaje", () => {
  it("sube y baja redondeando al peso y nunca baja de 0", () => {
    expect(aplicarPorcentaje(1000, 10)).toBe(1100);
    expect(aplicarPorcentaje(28500, 7.5)).toBe(30638);
    expect(aplicarPorcentaje(1000, -15)).toBe(850);
    expect(aplicarPorcentaje(0, 20)).toBe(0);
  });
});

describe("variación", () => {
  it("calcula y escribe el porcentaje; sin precio anterior no hay variación", () => {
    expect(variacionPorcentual(1000, 1100)).toBeCloseTo(10);
    expect(variacionPorcentual(null, 1100)).toBeNull();
    expect(variacionPorcentual(0, 1100)).toBeNull();
    expect(textoVariacion(10)).toBe("+10 %");
    expect(textoVariacion(-3.04)).toBe("−3 %");
    expect(textoVariacion(12.5)).toBe("+12,5 %");
    expect(textoVariacion(0.01)).toBe("0 %");
    expect(textoVariacion(null)).toBe("");
  });
});

describe("interpretarPorcentaje", () => {
  it("acepta signo, coma y el símbolo; rechaza 0, vacío y excesos", () => {
    expect(interpretarPorcentaje("10")).toBe(10);
    expect(interpretarPorcentaje("-5 %")).toBe(-5);
    expect(interpretarPorcentaje("7,5")).toBe(7.5);
    expect(interpretarPorcentaje("")).toBeNull();
    expect(interpretarPorcentaje("0")).toBeNull();
    expect(interpretarPorcentaje("-95")).toBeNull();
    expect(interpretarPorcentaje("5000")).toBeNull();
    expect(interpretarPorcentaje("x")).toBeNull();
  });
});

describe("cambiosPendientes", () => {
  const filas = [
    { id: "a", actual: 100 },
    { id: "b", actual: null },
    { id: "c", actual: 50 },
    { id: "d", actual: 10 },
  ];
  it("sólo cuentan las filas con un precio válido y distinto; las ilegibles se marcan", () => {
    const r = cambiosPendientes(filas, { a: "120", b: "300", c: "50", d: "diez" });
    expect(r.cambios).toEqual([
      { id: "a", anterior: 100, nuevo: 120 },
      { id: "b", anterior: null, nuevo: 300 },
    ]);
    expect(r.invalidas).toEqual(["d"]);
  });
  it("sin nada tipeado no hay cambios", () => {
    expect(cambiosPendientes(filas, {})).toEqual({ cambios: [], invalidas: [] });
  });
});
