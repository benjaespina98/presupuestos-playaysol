import { describe, expect, it } from "vitest";
import { calcularLoseta } from "./losetas";

/**
 * Los mismos escenarios que tests/unit/oraculo-losetas.test.ts corre contra la
 * calculadora legacy. Acá se verifica que la función pura da lo mismo.
 *
 * Losetas no tiene fixture JSON porque su salida no son líneas de precio sino
 * dos números en pantalla; el oráculo los compara directo. Los valores
 * esperados de acá son los mismos que allá, y ambos coincidieron con el cálculo
 * a mano.
 */

describe("calcularLoseta reproduce el legacy", () => {
  const CASOS: {
    nombre: string;
    entrada: Parameters<typeof calcularLoseta>[0];
    incluidos: number;
    extra: number;
  }[] = [
    {
      // incluidos = 9 × 5 = 45 · finales = 8 × 4 = 32 · el máximo(0,…) lo deja en 0
      nombre: "medidas cargadas, sin ampliar ningún lado",
      entrada: { largo: 8, ancho: 4, bordeIncluido: 0.5 },
      incluidos: 45,
      extra: 0,
    },
    {
      // finales = 10 × 6 = 60 · incluidos 45 → 15
      nombre: "un metro de más en los cuatro lados",
      entrada: {
        largo: 8,
        ancho: 4,
        bordeIncluido: 0.5,
        solar: 1,
        opuesto: 1,
        lateral1: 1,
        lateral2: 1,
      },
      incluidos: 45,
      extra: 15,
    },
    {
      // finales = 11,5 × 5 = 57,5 · incluidos 45 → 12,5
      nombre: "solar ancho, lados asimétricos",
      entrada: {
        largo: 8,
        ancho: 4,
        bordeIncluido: 0.5,
        solar: 3,
        opuesto: 0.5,
        lateral1: 0.5,
        lateral2: 0.5,
      },
      incluidos: 45,
      extra: 12.5,
    },
    {
      nombre: "sin borde incluido de fábrica",
      entrada: {
        largo: 8,
        ancho: 4,
        bordeIncluido: 0,
        solar: 1,
        opuesto: 1,
        lateral1: 1,
        lateral2: 1,
      },
      incluidos: 32,
      extra: 28,
    },
    {
      // Sin medidas, el borde de fábrica igual dibuja 1 × 1 de superficie.
      nombre: "sin medidas",
      entrada: { largo: 0, ancho: 0, bordeIncluido: 0.5 },
      incluidos: 1,
      extra: 0,
    },
  ];

  for (const caso of CASOS) {
    it(caso.nombre, () => {
      const r = calcularLoseta(caso.entrada);
      expect(r.m2Incluidos, "m² incluidos").toBeCloseTo(caso.incluidos, 6);
      expect(r.m2ACotizar, "m² a cotizar").toBeCloseTo(caso.extra, 6);
    });
  }
});

describe("reglas propias de losetas", () => {
  it("nunca cotiza superficie negativa", () => {
    // Lados terminados MENORES que el borde de fábrica: el legacy usa
    // Math.max(0, …) y devuelve cero, no un número negativo.
    const r = calcularLoseta({
      largo: 8,
      ancho: 4,
      bordeIncluido: 2,
      solar: 0,
      opuesto: 0,
      lateral1: 0,
      lateral2: 0,
    });
    expect(r.m2Finales).toBeLessThan(r.m2Incluidos);
    expect(r.m2ACotizar).toBe(0);
  });

  it("el costo por material es m² a cotizar × precio", () => {
    const r = calcularLoseta({
      largo: 8,
      ancho: 4,
      bordeIncluido: 0.5,
      solar: 1,
      opuesto: 1,
      lateral1: 1,
      lateral2: 1,
      materiales: [
        { nombre: "Loseta común", precioPorM2: 10000 },
        { nombre: "Decks", precioPorM2: 0 },
      ],
    });
    expect(r.m2ACotizar).toBeCloseTo(15, 6);
    expect(r.costos[0]).toEqual({ nombre: "Loseta común", total: 150000 });
    expect(r.costos[1]).toEqual({ nombre: "Decks", total: 0 });
  });

  it("el borde incluido se descuenta como perímetro completo, no por lado", () => {
    // 0,5 de borde agranda el rectángulo en 1 m en cada dimensión (0,5 de cada
    // lado), no en 0,5. Es la fuente de confusión más probable al reescribir.
    const r = calcularLoseta({ largo: 10, ancho: 5, bordeIncluido: 0.5 });
    expect(r.m2Incluidos).toBe(11 * 6);
  });
});
