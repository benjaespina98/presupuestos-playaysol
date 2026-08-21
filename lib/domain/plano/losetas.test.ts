import { describe, expect, it } from "vitest";
import { ajustarLucesPos, aclararHex, calcularGeometriaPlano, posicionLuzPorDefecto } from "./losetas";

const BASE = {
  largo: 8,
  ancho: 4,
  solar: 1,
  opuesto: 1,
  lateral1: 1,
  lateral2: 1,
};

const EDITOR = { viewW: 680, viewHmax: 420, showDims: false, interactive: true } as const;
const CLIENTE = { viewW: 1000, viewHmax: 650, showDims: true, interactive: false } as const;

describe("posicionLuzPorDefecto / ajustarLucesPos", () => {
  it("una sola luz va centrada verticalmente, pegada a la pared del solar", () => {
    expect(posicionLuzPorDefecto(0, 1)).toEqual({ x: 0.06, y: 0.5 });
  });

  it("con varias luces se reparten parejas a lo largo del lado", () => {
    expect(posicionLuzPorDefecto(0, 2)).toEqual({ x: 0.06, y: 0.25 });
    expect(posicionLuzPorDefecto(1, 2)).toEqual({ x: 0.06, y: 0.75 });
  });

  it("conserva las posiciones ya elegidas al agregar más luces", () => {
    const previas = [{ x: 0.5, y: 0.5 }];
    const ajustadas = ajustarLucesPos(previas, true, 2);
    expect(ajustadas[0]).toEqual({ x: 0.5, y: 0.5 }); // no se pisa la que el usuario movió
    expect(ajustadas[1]).toEqual(posicionLuzPorDefecto(1, 2)); // la nueva sale con el default
  });

  it("descarta las posiciones sobrantes al reducir la cantidad", () => {
    const previas = [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }, { x: 0.3, y: 0.3 }];
    expect(ajustarLucesPos(previas, true, 1)).toEqual([{ x: 0.1, y: 0.1 }]);
  });

  it("sin luces activadas, el array queda vacío", () => {
    expect(ajustarLucesPos([{ x: 0.1, y: 0.1 }], false, 3)).toEqual([]);
  });
});

describe("aclararHex", () => {
  it("t=0 no cambia el color", () => {
    expect(aclararHex("#336699", 0)).toBe("#336699");
  });
  it("t=1 da blanco", () => {
    expect(aclararHex("#336699", 1)).toBe("#ffffff");
  });
});

describe("calcularGeometriaPlano — geometría de la pileta", () => {
  it("ubica el rectángulo de la pileta a `solar`/`lateral1` de distancia del origen", () => {
    const g = calcularGeometriaPlano(BASE, EDITOR);
    // ox = padSide (90, showDims=false) ; poolX = ox + solar*pxPerM
    const pxPerM = g.pool.w / BASE.largo;
    expect(g.pool.x).toBeCloseTo(90 + BASE.solar * pxPerM, 5);
    expect(g.pool.y).toBeCloseTo(46 + BASE.lateral1 * pxPerM, 5);
  });

  it("la pileta mantiene la proporción largo:ancho del terreno total", () => {
    const g = calcularGeometriaPlano(BASE, EDITOR);
    expect(g.pool.w / g.pool.h).toBeCloseTo(BASE.largo / BASE.ancho, 5);
  });

  it("el plano del editor no dibuja grilla ni leyenda; el del cliente sí", () => {
    const editor = calcularGeometriaPlano(BASE, EDITOR);
    const cliente = calcularGeometriaPlano(BASE, CLIENTE);
    expect(editor.grid).toHaveLength(0);
    expect(editor.legend).toHaveLength(0);
    expect(cliente.grid.length).toBeGreaterThan(0);
    expect(cliente.legend.length).toBeGreaterThanOrEqual(2); // "Borde de loseta" + "Pileta" siempre
  });
});

describe("calcularGeometriaPlano — luces", () => {
  it("sin luces activadas no agrega ningún círculo", () => {
    const g = calcularGeometriaPlano(BASE, EDITOR);
    expect(g.extras.filter((p) => p.t === "circle")).toHaveLength(0);
  });

  it("cada luz agrega 3 círculos (glow, foco, brillo) + 1 de agarre si es interactivo", () => {
    const g = calcularGeometriaPlano({ ...BASE, luces: true, cantLuces: 2 }, EDITOR);
    const circulos = g.extras.filter((p) => p.t === "circle");
    expect(circulos).toHaveLength(2 * 4); // 2 luces × (glow+foco+brillo+agarre)
  });

  it("el plano del cliente (no interactivo) no agrega círculo de agarre", () => {
    const g = calcularGeometriaPlano({ ...BASE, luces: true, cantLuces: 2 }, CLIENTE);
    const circulos = g.extras.filter((p) => p.t === "circle");
    expect(circulos).toHaveLength(2 * 3);
    expect(circulos.some((c) => c.t === "circle" && c.luzIndex !== undefined)).toBe(false);
  });

  it("la luz cae dentro del rectángulo de la pileta según su posición normalizada", () => {
    const g = calcularGeometriaPlano(
      { ...BASE, luces: true, cantLuces: 1, lucesPos: [{ x: 0, y: 0 }] },
      EDITOR
    );
    const agarre = g.extras.find((p) => p.t === "circle" && p.luzIndex === 0);
    expect(agarre).toBeTruthy();
    if (agarre && agarre.t === "circle") {
      expect(agarre.cx).toBeCloseTo(g.pool.x, 5);
      expect(agarre.cy).toBeCloseTo(g.pool.y, 5);
    }
  });
});

describe("calcularGeometriaPlano — espejo de agua (pileta de fibra)", () => {
  it("sin fibra o sin labios, no dibuja el rectángulo de espejo", () => {
    const g1 = calcularGeometriaPlano({ ...BASE, tipoPileta: "hormigon", labios: 0.2 }, CLIENTE);
    const g2 = calcularGeometriaPlano({ ...BASE, tipoPileta: "fibra", labios: 0 }, CLIENTE);
    expect(g1.extras.some((p) => p.t === "rect" && p.dash === "4 3")).toBe(false);
    expect(g2.extras.some((p) => p.t === "rect" && p.dash === "4 3")).toBe(false);
  });

  it("con fibra y labios, el espejo queda adentro del rectángulo exterior", () => {
    const g = calcularGeometriaPlano({ ...BASE, tipoPileta: "fibra", labios: 0.3 }, CLIENTE);
    const espejo = g.extras.find((p) => p.t === "rect" && p.dash === "4 3");
    expect(espejo).toBeTruthy();
    if (espejo && espejo.t === "rect") {
      expect(espejo.x).toBeGreaterThan(g.pool.x);
      expect(espejo.y).toBeGreaterThan(g.pool.y);
      expect(espejo.w).toBeLessThan(g.pool.w);
    }
  });
});

describe("calcularGeometriaPlano — colores", () => {
  it("con el color de agua por defecto, el degradé usa el celeste claro original", () => {
    const g = calcularGeometriaPlano(BASE, EDITOR);
    expect(g.colores.aguaBottom).toBe("#A6D1EC");
    expect(g.colores.aguaTop).toBe("#E7F3FC");
  });

  it("con un color de agua custom, el tono superior sale de aclararlo", () => {
    const g = calcularGeometriaPlano({ ...BASE, colorAgua: "#000000" }, EDITOR);
    expect(g.colores.aguaBottom).toBe("#000000");
    expect(g.colores.aguaTop).toBe(aclararHex("#000000", 0.6));
  });

  it("el color de loseta elegido pinta el fondo", () => {
    const g = calcularGeometriaPlano({ ...BASE, colorLoseta: "#123456" }, EDITOR);
    expect(g.fondo.t).toBe("rect");
    if (g.fondo.t === "rect") expect(g.fondo.fill).toBe("#123456");
  });
});
