import { describe, expect, it } from "vitest";
import { calcularLosetas, entradaPorDefecto, TABLA_PLANILLA_LOSETAS, type EntradaCalculoLosetas } from "./calculoLosetas";

const hormigon = (largo: number, ancho: number, extra: Partial<EntradaCalculoLosetas> = {}): EntradaCalculoLosetas => ({
  ...entradaPorDefecto("hormigon"),
  largo,
  ancho,
  ...extra,
});

describe("calcularLosetas", () => {
  it("5×3 con loseta de 0,50 y vereda de 0,50: 36 de borde, 6 planas, 42 en total", () => {
    const r = calcularLosetas(hormigon(5, 3));
    expect(r.error).toBeNull();
    expect(r.areaBorde).toBeCloseTo(9);
    expect(r.areaLoseta).toBeCloseTo(0.25);
    expect(r.borde).toBe(36);
    expect(r.planas).toBe(6);
    expect(r.total).toBe(42);
  });

  it("coincide exactamente con la hoja 'Artículos' en 7×3 (44), 7×3,50 (46) y 10×4 (60)", () => {
    for (const [largo, ancho, borde] of [
      [7, 3, 44],
      [7, 3.5, 46],
      [10, 4, 60],
    ] as const) {
      expect(calcularLosetas(hormigon(largo, ancho)).borde).toBe(borde);
    }
  });

  it("no sube de más por coma flotante: 11 ÷ 0,25 es 44 justo, no 45", () => {
    expect(calcularLosetas(hormigon(7, 3)).borde).toBe(44);
  });

  it("las diferencias contra la hoja son de 0 a 2 losetas en todos los tamaños de la tabla", () => {
    for (const fila of TABLA_PLANILLA_LOSETAS) {
      const r = calcularLosetas(hormigon(fila.largo, fila.ancho));
      expect(Math.abs(r.borde - fila.borde)).toBeLessThanOrEqual(2);
      expect(r.planas).toBe(fila.planas);
    }
  });

  it("el desperdicio sube las losetas de borde, redondeando hacia arriba", () => {
    const r = calcularLosetas(hormigon(5, 3, { desperdicioPct: 10 }));
    expect(r.borde).toBe(40); // 36 × 1,10 = 39,6 → 40
    expect(r.total).toBe(46);
  });

  it("la medida de la loseta es editable: 0,60 × 0,30 (0,18 m²)", () => {
    const r = calcularLosetas(hormigon(5, 3, { losetaLargo: 0.6, losetaAncho: 0.3 }));
    expect(r.areaLoseta).toBeCloseTo(0.18);
    expect(r.borde).toBe(50); // 9 ÷ 0,18 = 50
  });

  it("una vereda más ancha lleva más losetas; sin vereda no lleva ninguna de borde", () => {
    expect(calcularLosetas(hormigon(5, 3, { vereda: 1 })).borde).toBe(Math.ceil((7 * 5 - 15) / 0.25));
    expect(calcularLosetas(hormigon(5, 3, { vereda: 0 })).borde).toBe(0);
  });

  it("fibra: se calcula con las medidas reales del modelo cargadas a mano", () => {
    const r = calcularLosetas({ ...entradaPorDefecto("fibra"), largo: 7.5, ancho: 3.5, planas: 4 });
    expect(r.borde).toBe(Math.ceil((8.5 * 4.5 - 7.5 * 3.5) / 0.25));
    expect(r.total).toBe(r.borde + 4);
  });

  it("la profundidad se acepta pero no cambia las cantidades", () => {
    expect(calcularLosetas(hormigon(5, 3, { profundidad: 1.5 })).total).toBe(calcularLosetas(hormigon(5, 3)).total);
  });

  it("muestra el detalle del cálculo paso a paso", () => {
    const r = calcularLosetas(hormigon(5, 3));
    expect(r.detalle.length).toBeGreaterThanOrEqual(5);
    expect(r.detalle[0]).toContain("Área del borde");
    expect(r.detalle.at(-1)).toContain("Total = 36 + 6 = 42");
  });

  it.each([
    [{ largo: 0 }, /largo y el ancho/],
    [{ ancho: -1 }, /largo y el ancho/],
    [{ losetaLargo: 0 }, /loseta/],
    [{ vereda: -0.1 }, /vereda/],
    [{ desperdicioPct: 120 }, /desperdicio/],
    [{ planas: 1.5 }, /planas/],
    [{ largo: Number.NaN }, /número/],
  ])("valores inválidos %o: no calcula y explica por qué", (cambio, mensaje) => {
    const r = calcularLosetas(hormigon(5, 3, cambio));
    expect(r.error).toMatch(mensaje);
    expect(r.total).toBe(0);
  });
});
