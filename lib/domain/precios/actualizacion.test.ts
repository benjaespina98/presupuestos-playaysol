import { describe, expect, it } from "vitest";
import {
  emparejarLista,
  leerListaPegada,
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

describe("leerListaPegada", () => {
  it("toma el precio del final de cada línea, con distintos separadores", () => {
    const r = leerListaPegada(
      ["Racionalista 400 — 6.230.000", "Cal hidratada\t4620", "Bomba BAP 0.50HP | US$ 166,36", "Losetas borde: $ 8900", "", "sin precio acá", "Mango telescópico 3,60M 26990"].join("\n")
    );
    expect(r).toEqual([
      { nombre: "Racionalista 400", texto: "6.230.000" },
      { nombre: "Cal hidratada", texto: "4620" },
      { nombre: "Bomba BAP 0.50HP", texto: "166,36" },
      { nombre: "Losetas borde", texto: "8900" },
      { nombre: "Mango telescópico 3,60M", texto: "26990" },
    ]);
  });
});

describe("emparejarLista", () => {
  const filas = [
    { id: "a", nombre: "Racionalista 400" },
    { id: "b", nombre: "Racionalista 450" },
    { id: "c", nombre: "Bomba BAP 0.50HP" },
    { id: "d", nombre: "Pastina blanca 18kg (losetas)" },
    { id: "e", nombre: "Pastina blanca 18kg (deck)" },
  ];
  it("empareja por nombre igual (sin tildes ni signos) y por nombre contenido si hay una sola candidata", () => {
    const r = emparejarLista(
      [
        { nombre: "RACIONALISTA 400", texto: "6230000" },
        { nombre: "bomba bap 0,50 hp", texto: "166,36" },
        { nombre: "Pastina blanca 18kg (deck)", texto: "58900" },
      ],
      filas
    );
    expect(r.asignados).toEqual({ a: "6230000", c: "166,36", e: "58900" });
    expect(r.sinPareja).toEqual([]);
  });
  it("no adivina: varias candidatas o ninguna quedan sin pareja", () => {
    const r = emparejarLista(
      [
        { nombre: "Pastina", texto: "1" },
        { nombre: "Racionalista", texto: "2" },
        { nombre: "Zuipy 200", texto: "3" },
      ],
      filas
    );
    expect(r.asignados).toEqual({});
    expect(r.sinPareja.map((s) => s.motivo)).toEqual(["varias coinciden", "varias coinciden", "no existe"]);
  });
});
