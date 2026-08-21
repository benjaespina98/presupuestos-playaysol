import { describe, expect, it } from "vitest";
import { formatARS, formatNumero, paraEditar, parseARS, parseARSOCero } from "./ars";

/**
 * El contraste con tests/unit/formato-numerico.test.ts es el punto: ahí están
 * congelados los mismos casos con el resultado ROTO que da el sistema hoy. Acá
 * están con el resultado correcto.
 *
 * Cuando se migre la primera calculadora, esos casos se mueven de un archivo al
 * otro de a uno, y ese movimiento es la evidencia de que el bug se arregló.
 */

describe("parseARS · los 7 casos que hoy están rotos", () => {
  const CASOS: [string, number][] = [
    ["1500", 1500],
    ["1.500", 1500],
    ["15.000", 15000],
    ["1500,50", 1500.5],
    ["1.500,50", 1500.5],
    ["$ 1.500", 1500],
    ["$ 2.650.000", 2650000],
  ];

  for (const [tipeado, esperado] of CASOS) {
    it(`"${tipeado}" → ${esperado}`, () => {
      expect(parseARS(tipeado)).toBe(esperado);
    });
  }
});

describe("parseARS · la ambigüedad del punto", () => {
  it("grupos de 3 dígitos son separadores de miles", () => {
    expect(parseARS("1.500")).toBe(1500);
    expect(parseARS("12.500")).toBe(12500);
    expect(parseARS("123.500")).toBe(123500);
    expect(parseARS("2.650.000")).toBe(2650000);
  });

  it("un punto que no agrupa de a 3 es un decimal tipeado con el teclado", () => {
    expect(parseARS("1.5")).toBe(1.5);
    expect(parseARS("1.50")).toBe(1.5);
    expect(parseARS("0.75")).toBe(0.75);
    expect(parseARS("1.5000")).toBe(1.5);
  });

  it("si hay coma, la coma manda y los puntos son miles", () => {
    expect(parseARS("1.500,50")).toBe(1500.5);
    expect(parseARS("2.650.000,99")).toBe(2650000.99);
    expect(parseARS("0,5")).toBe(0.5);
  });
});

describe("parseARS · entradas sucias", () => {
  it("ignora el símbolo, los espacios y el espacio duro de Intl", () => {
    expect(parseARS("$ 1.500")).toBe(1500);
    expect(parseARS("  1.500  ")).toBe(1500);
    expect(parseARS("$ 1.500")).toBe(1500);
    expect(parseARS("1.500 ARS")).toBe(1500);
  });

  it("acepta negativos", () => {
    expect(parseARS("-1.500")).toBe(-1500);
    expect(parseARS("-1.500,50")).toBe(-1500.5);
  });

  it("acepta un número tal cual", () => {
    expect(parseARS(2650000)).toBe(2650000);
    expect(parseARS(1.5)).toBe(1.5);
  });
});

describe("parseARS · vacío no es cero", () => {
  // Distinguirlos importa: en el catálogo, precio null significa "a cotizar" y
  // se imprime distinto que $ 0.
  it("vacío, nulo y basura dan null", () => {
    expect(parseARS("")).toBeNull();
    expect(parseARS("   ")).toBeNull();
    expect(parseARS(null)).toBeNull();
    expect(parseARS(undefined)).toBeNull();
    expect(parseARS("abc")).toBeNull();
    expect(parseARS("$")).toBeNull();
    expect(parseARS("-")).toBeNull();
  });

  it("cero es cero, no null", () => {
    expect(parseARS("0")).toBe(0);
    expect(parseARS(0)).toBe(0);
  });

  it("parseARSOCero colapsa el vacío a 0, para medidas", () => {
    expect(parseARSOCero("")).toBe(0);
    expect(parseARSOCero(null)).toBe(0);
    expect(parseARSOCero("1.500")).toBe(1500);
  });
});

describe("formatARS", () => {
  it("imprime como el documento actual", () => {
    expect(formatARS(2650000)).toBe("$ 2.650.000");
    expect(formatARS(1500)).toBe("$ 1.500");
    expect(formatARS(0)).toBe("$ 0");
  });

  it("muestra hasta dos decimales", () => {
    expect(formatARS(1500.5)).toBe("$ 1.500,5");
    expect(formatARS(160274.1)).toBe("$ 160.274,1");
  });

  it("null y undefined no imprimen nada", () => {
    expect(formatARS(null)).toBe("");
    expect(formatARS(undefined)).toBe("");
  });
});

describe("ida y vuelta", () => {
  // Esto es lo que hoy NO se cumple y es la razón de existir del módulo.
  const MONTOS = [0, 1500, 1500.5, 15000, 160274.1, 2650000, 18500000];

  for (const monto of MONTOS) {
    it(`formatARS(${monto}) se puede volver a leer`, () => {
      expect(parseARS(formatARS(monto))).toBe(monto);
    });
  }

  it("lo que se muestra en un campo editable también vuelve igual", () => {
    for (const monto of MONTOS) {
      expect(parseARS(paraEditar(monto))).toBe(monto);
    }
  });
});

describe("formatNumero", () => {
  it("no lleva símbolo: es para medidas", () => {
    expect(formatNumero(68)).toBe("68");
    expect(formatNumero(15.5)).toBe("15,5");
    expect(formatNumero(1500)).toBe("1.500");
  });
});
