import { describe, expect, it } from "vitest";
import { cortesProfundidad, normalizarTramos, problemasTramos, resumenProfundidad, zonasProfundidad } from "./profundidad";

describe("normalizarTramos", () => {
  it("recorta al largo, descarta vacíos y sin profundidad, y ordena", () => {
    const r = normalizarTramos(
      [
        { desde: 5, hasta: 12, prof: 1.3 }, // se pasa del largo
        { desde: 0, hasta: 3, prof: 1 },
        { desde: 4, hasta: 4, prof: 1 }, // vacío
        { desde: 6, hasta: 7, prof: 0 }, // sin profundidad
      ],
      8
    );
    expect(r).toEqual([
      { desde: 0, hasta: 3, prof: 1 },
      { desde: 5, hasta: 8, prof: 1.3 },
    ]);
  });

  it("si dos tramos se pisan, el segundo arranca donde termina el primero", () => {
    expect(
      normalizarTramos(
        [
          { desde: 0, hasta: 5, prof: 1 },
          { desde: 3, hasta: 8, prof: 1.2 },
        ],
        8
      )
    ).toEqual([
      { desde: 0, hasta: 5, prof: 1 },
      { desde: 5, hasta: 8, prof: 1.2 },
    ]);
  });

  it("un tramo totalmente tapado por el anterior desaparece", () => {
    expect(
      normalizarTramos(
        [
          { desde: 0, hasta: 6, prof: 1 },
          { desde: 2, hasta: 4, prof: 1.5 },
        ],
        8
      )
    ).toEqual([{ desde: 0, hasta: 6, prof: 1 }]);
  });

  it("una entrada a medio cargar no rompe nada", () => {
    expect(normalizarTramos([{ desde: 0, hasta: 0, prof: 0 }], 8)).toEqual([]);
  });
});

describe("zonasProfundidad", () => {
  it("toda la pileta con la misma profundidad: una sola zona", () => {
    expect(zonasProfundidad(1.15, [], 8)).toEqual([{ desde: 0, hasta: 8, prof: 1.15, esTramo: false }]);
  });

  it("'de 0 a 3 m, 1,00; el resto, 1,10' (el ejemplo del pedido)", () => {
    const z = zonasProfundidad(1.1, [{ desde: 0, hasta: 3, prof: 1 }], 8);
    expect(z).toEqual([
      { desde: 0, hasta: 3, prof: 1, esTramo: true },
      { desde: 3, hasta: 8, prof: 1.1, esTramo: false },
    ]);
    expect(cortesProfundidad(z)).toEqual([3]);
  });

  it("un tramo en el medio deja resto de los dos lados", () => {
    const z = zonasProfundidad(1.1, [{ desde: 3, hasta: 5, prof: 1.5 }], 8);
    expect(z.map((x) => [x.desde, x.hasta, x.prof])).toEqual([
      [0, 3, 1.1],
      [3, 5, 1.5],
      [5, 8, 1.1],
    ]);
    expect(cortesProfundidad(z)).toEqual([3, 5]);
  });

  it("sin profundidad general, sólo existen las zonas de los tramos (el resto queda sin dato)", () => {
    const z = zonasProfundidad(0, [{ desde: 0, hasta: 3, prof: 1 }], 8);
    expect(z).toEqual([{ desde: 0, hasta: 3, prof: 1, esTramo: true }]);
  });

  it("sin nada cargado no hay zonas", () => {
    expect(zonasProfundidad(0, [], 8)).toEqual([]);
    expect(zonasProfundidad(1, [], 0)).toEqual([]);
  });
});

describe("resumenProfundidad", () => {
  it("una profundidad: '1,15 m'; varias: rango", () => {
    expect(resumenProfundidad(zonasProfundidad(1.15, [], 8))).toBe("1,15 m");
    expect(resumenProfundidad(zonasProfundidad(1.1, [{ desde: 0, hasta: 3, prof: 1 }], 8))).toBe("1,00 a 1,10 m");
    expect(resumenProfundidad([])).toBe("");
  });
});

describe("problemasTramos", () => {
  it("avisa de 'hasta' menor que 'desde', tramos que se pasan del largo y tramos que se pisan", () => {
    expect(problemasTramos([{ desde: 3, hasta: 2, prof: 1 }], 8).join(" ")).toMatch(/mayor que/);
    expect(problemasTramos([{ desde: 0, hasta: 9, prof: 1 }], 8).join(" ")).toMatch(/se pasa del largo/);
    expect(
      problemasTramos(
        [
          { desde: 0, hasta: 5, prof: 1 },
          { desde: 3, hasta: 6, prof: 1 },
        ],
        8
      ).join(" ")
    ).toMatch(/se pisan/);
  });

  it("sin problemas devuelve vacío, y una fila totalmente vacía no molesta", () => {
    expect(problemasTramos([{ desde: 0, hasta: 3, prof: 1 }], 8)).toEqual([]);
    expect(problemasTramos([{ desde: 0, hasta: 0, prof: 0 }], 8)).toEqual([]);
  });
});
