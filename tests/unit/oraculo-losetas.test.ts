import { describe, expect, it } from "vitest";
import { abrirLosetas } from "../oracle/harness";

/**
 * Oráculo del Plano de Piscina.
 *
 * Va aparte del de las otras cuatro porque losetas no comparte nada con ellas:
 * su salida no es un documento con líneas de precio sino dos números —m²
 * incluidos y m² a cotizar— y un costo por material.
 *
 * Es el módulo con la reescritura más grande por delante (Fase 7), así que
 * congelar su aritmética ahora es lo que permite comparar después.
 *
 * Fórmulas, tal como están hoy:
 *   incluidos = (largo + 2·borde) × (ancho + 2·borde)
 *   finales   = (largo + solar + opuesto) × (ancho + lateral1 + lateral2)
 *   a cotizar = máximo(0, finales − incluidos)
 */

interface Caso {
  nombre: string;
  preparar: (c: Awaited<ReturnType<typeof abrirLosetas>>) => void;
  incluidos: number;
  extra: number;
}

const CASOS: Caso[] = [
  {
    // 8×4 con borde 0,5 de fábrica: incluidos = 9 × 5 = 45.
    // Sin anchos por lado cargados, los "finales" son 8 × 4 = 32, menor que 45,
    // así que a cotizar queda en 0 por el máximo(0, …).
    nombre: "medidas cargadas, sin ampliar ningún lado",
    preparar: (c) => {
      c.set("largo", "8");
      c.set("ancho", "4");
      c.set("incluido", "0.5");
    },
    incluidos: 45,
    extra: 0,
  },
  {
    // finales = (8+1+1) × (4+1+1) = 10 × 6 = 60 · incluidos 45 → extra 15
    nombre: "un metro de más en los cuatro lados",
    preparar: (c) => {
      c.set("largo", "8");
      c.set("ancho", "4");
      c.set("incluido", "0.5");
      c.set("solar", "1");
      c.set("opuesto", "1");
      c.set("lateral1", "1");
      c.set("lateral2", "1");
    },
    incluidos: 45,
    extra: 15,
  },
  {
    // finales = (8+3+0,5) × (4+0,5+0,5) = 11,5 × 5 = 57,5 · incluidos 45 → 12,5
    nombre: "solar ancho, lados asimétricos",
    preparar: (c) => {
      c.set("largo", "8");
      c.set("ancho", "4");
      c.set("incluido", "0.5");
      c.set("solar", "3");
      c.set("opuesto", "0.5");
      c.set("lateral1", "0.5");
      c.set("lateral2", "0.5");
    },
    incluidos: 45,
    extra: 12.5,
  },
  {
    // El borde incluido a 0 deja incluidos = 8 × 4 = 32.
    nombre: "sin borde incluido de fábrica",
    preparar: (c) => {
      c.set("largo", "8");
      c.set("ancho", "4");
      c.set("incluido", "0");
      c.set("solar", "1");
      c.set("opuesto", "1");
      c.set("lateral1", "1");
      c.set("lateral2", "1");
    },
    incluidos: 32,
    extra: 28,
  },
  {
    nombre: "sin medidas",
    preparar: (c) => {
      c.set("largo", "0");
      c.set("ancho", "0");
      c.set("incluido", "0.5");
    },
    incluidos: 1,
    extra: 0,
  },
];

describe("oráculo · losetas (Plano de Piscina)", () => {
  for (const caso of CASOS) {
    it(caso.nombre, async () => {
      const calc = await abrirLosetas();
      try {
        caso.preparar(calc);
        await calc.asentar();
        expect(calc.errores, "la calculadora tiró errores").toEqual([]);

        const m2 = calc.m2();
        expect(m2.incluidos, "m² incluidos").toBeCloseTo(caso.incluidos, 4);
        expect(m2.extra, "m² a cotizar").toBeCloseTo(caso.extra, 4);
      } finally {
        calc.cerrar();
      }
    }, 30_000);
  }

  it("el costo por material es m² a cotizar × precio del material", async () => {
    const calc = await abrirLosetas();
    try {
      calc.set("largo", "8");
      calc.set("ancho", "4");
      calc.set("incluido", "0.5");
      calc.set("solar", "1");
      calc.set("opuesto", "1");
      calc.set("lateral1", "1");
      calc.set("lateral2", "1");
      await calc.asentar();

      expect(calc.m2().extra, "m² a cotizar del escenario").toBeCloseTo(15, 4);

      calc.precioMaterial(0, 10000);
      await calc.asentar();

      const costos = calc.costos();
      expect(costos.length, "arranca con dos materiales: Loseta común y Decks").toBe(2);
      // 15 m² × $10.000 = $150.000
      expect(costos[0].monto, costos[0].material).toBe(150000);
      // El segundo material sigue en 0, así que su costo también.
      expect(costos[1].monto).toBe(0);
    } finally {
      calc.cerrar();
    }
  }, 30_000);
});
