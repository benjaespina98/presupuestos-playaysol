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

describe("calcularGeometriaPlano — desborde infinito", () => {
  it("sin ningún lado en desborde, las 4 aristas son finas y hay resalte blanco en las 4", () => {
    const g = calcularGeometriaPlano(BASE, CLIENTE);
    const aristas = g.borde.filter((p): p is Extract<typeof p, { t: "line" }> => p.t === "line");
    // 4 aristas + 4 resaltes blancos = 8 líneas.
    expect(aristas).toHaveLength(8);
    expect(aristas.filter((l) => l.strokeWidth === 3)).toHaveLength(0);
    expect(aristas.filter((l) => l.stroke === "#ffffff")).toHaveLength(4);
  });

  it("un lado en desborde: arista gruesa, sin resalte blanco en ESE lado, y con la etiqueta", () => {
    const g = calcularGeometriaPlano({ ...BASE, desbordeOpuesto: true }, CLIENTE);
    const aristas = g.borde.filter((p): p is Extract<typeof p, { t: "line" }> => p.t === "line");
    expect(aristas.filter((l) => l.strokeWidth === 3)).toHaveLength(1);
    // Sigue habiendo resalte blanco en los otros 3 lados, no en éste.
    expect(aristas.filter((l) => l.stroke === "#ffffff")).toHaveLength(3);
    const etiqueta = g.borde.find((p) => p.t === "text" && p.text === "Desborde infinito");
    expect(etiqueta).toBeTruthy();
  });

  it("el lado en desborde no lleva loseta: la medida de ese lado se ignora, aunque venga cargada", () => {
    const sinDesborde = calcularGeometriaPlano(BASE, CLIENTE); // opuesto: 1
    const conDesborde = calcularGeometriaPlano({ ...BASE, desbordeOpuesto: true }, CLIENTE); // opuesto: 1, pero ignorado
    // La pileta llega hasta el borde del terreno total del lado opuesto —
    // no queda ningún margen de loseta ahí.
    expect(conDesborde.pool.x + conDesborde.pool.w).toBeCloseTo(conDesborde.fondo.t === "rect" ? conDesborde.fondo.x + conDesborde.fondo.w : NaN, 5);
    // En cambio sin desborde sí queda el margen de "opuesto" (1m) de loseta.
    expect(sinDesborde.pool.x + sinDesborde.pool.w).toBeLessThan(sinDesborde.fondo.t === "rect" ? sinDesborde.fondo.x + sinDesborde.fondo.w : Infinity);
  });

  it("sin espacio suficiente, la etiqueta de desborde no se dibuja (no queda superpuesta)", () => {
    // Lateral1 corre a lo ancho de poolW (el largo) — con un largo chico,
    // el texto "Desborde infinito" no entra.
    const g = calcularGeometriaPlano({ largo: 0.5, ancho: 4, solar: 1, opuesto: 1, lateral1: 1, lateral2: 1, desbordeLateral1: true }, CLIENTE);
    const etiqueta = g.borde.find((p) => p.t === "text" && p.text === "Desborde infinito");
    expect(etiqueta).toBeUndefined();
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
    expect(circulos.some((c) => c.t === "circle" && c.drag !== undefined)).toBe(false);
  });

  it("la luz cae dentro del rectángulo de la pileta según su posición normalizada", () => {
    const g = calcularGeometriaPlano(
      { ...BASE, luces: true, cantLuces: 1, lucesPos: [{ x: 0, y: 0 }] },
      EDITOR
    );
    const agarre = g.extras.find((p) => p.t === "circle" && p.drag?.tipo === "luz" && p.drag.indice === 0);
    expect(agarre).toBeTruthy();
    if (agarre && agarre.t === "circle") {
      expect(agarre.cx).toBeCloseTo(g.pool.x, 5);
      expect(agarre.cy).toBeCloseTo(g.pool.y, 5);
    }
  });
});

describe("calcularGeometriaPlano — skimmer e hidromasaje", () => {
  it("sin activar ninguno, no agrega nada", () => {
    const g = calcularGeometriaPlano(BASE, EDITOR);
    expect(g.extras).toHaveLength(0);
  });

  it("cada skimmer agrega la caja + la ranura + 1 círculo de agarre si es interactivo", () => {
    const g = calcularGeometriaPlano({ ...BASE, skimmer: true, cantSkimmers: 2 }, EDITOR);
    const rects = g.extras.filter((p) => p.t === "rect");
    const agarres = g.extras.filter((p) => p.t === "circle" && p.drag?.tipo === "skimmer");
    expect(rects).toHaveLength(2 * 2); // 2 skimmers × (caja + ranura)
    expect(agarres).toHaveLength(2);
  });

  it("cada hidromasaje agrega 2 círculos concéntricos + 1 de agarre si es interactivo", () => {
    const g = calcularGeometriaPlano({ ...BASE, hidromasaje: true, cantHidromasajes: 2 }, EDITOR);
    const circulos = g.extras.filter((p) => p.t === "circle");
    expect(circulos).toHaveLength(2 * 3); // 2 hidromasajes × (externo+interno+agarre)
  });

  it("en el plano del cliente (no interactivo) ninguno de los dos agrega círculo de agarre", () => {
    const g = calcularGeometriaPlano({ ...BASE, skimmer: true, cantSkimmers: 1, hidromasaje: true, cantHidromasajes: 1 }, CLIENTE);
    expect(g.extras.some((p) => p.t === "circle" && p.drag !== undefined)).toBe(false);
    // Los dos entran a la leyenda.
    expect(g.legend.some((it) => it.kind === "skimmer")).toBe(true);
    expect(g.legend.some((it) => it.kind === "hidromasaje")).toBe(true);
  });

  it("un skimmer se ubica según su posición normalizada", () => {
    const g = calcularGeometriaPlano(
      { ...BASE, skimmer: true, cantSkimmers: 1, skimmersPos: [{ x: 1, y: 1 }] },
      EDITOR
    );
    const agarre = g.extras.find((p) => p.t === "circle" && p.drag?.tipo === "skimmer");
    expect(agarre && agarre.t === "circle" ? agarre.cx : null).toBeCloseTo(g.pool.x + g.pool.w, 5);
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

describe("calcularGeometriaPlano — escalera", () => {
  const rectEscalera = (extras: ReturnType<typeof calcularGeometriaPlano>["extras"]) =>
    extras.find((p) => p.t === "rect" && p.dash === "3 2");

  it("sin escalera activada, no dibuja nada", () => {
    const g = calcularGeometriaPlano(BASE, CLIENTE);
    expect(rectEscalera(g.extras)).toBeUndefined();
  });

  it("del lado del solar, la franja corre a todo el ancho de la pileta (alto = poolH)", () => {
    const g = calcularGeometriaPlano(
      { ...BASE, escalera: true, escaleraPos: "solar", escaleraEscalones: 2, escaleraMedidaEscalon: 0.3 },
      CLIENTE
    );
    const rect = rectEscalera(g.extras);
    expect(rect).toBeTruthy();
    if (rect && rect.t === "rect") {
      expect(rect.h).toBeCloseTo(g.pool.h, 5);
      expect(rect.x).toBeCloseTo(g.pool.x, 5);
    }
  });

  it("la profundidad de la franja sale de escalones × medida de escalón, no de un ancho suelto", () => {
    const g = calcularGeometriaPlano(
      { ...BASE, escalera: true, escaleraPos: "solar", escaleraEscalones: 3, escaleraMedidaEscalon: 0.3 },
      CLIENTE
    );
    const rect = rectEscalera(g.extras);
    const pxPerM = g.pool.w / BASE.largo;
    expect(rect).toBeTruthy();
    if (rect && rect.t === "rect") {
      expect(rect.w).toBeCloseTo(0.9 * pxPerM, 5); // 3 × 0,30 m
    }
    // Rotulado con el total calculado, no con un número suelto que alguien cargó.
    const etiqueta = g.extras.find((p) => p.t === "text" && p.text.startsWith("Escalera"));
    expect(etiqueta && etiqueta.t === "text" ? etiqueta.text : null).toBe("Escalera (0,9m)");
    // 3 escalones → 2 líneas divisorias adentro de la franja.
    const divisorias = g.extras.filter((p) => p.t === "line" && p.opacity === 0.5);
    expect(divisorias).toHaveLength(2);
  });

  it("con solar húmedo en el mismo lado, la escalera arranca después de esa franja, no superpuesta", () => {
    const g = calcularGeometriaPlano(
      { ...BASE, escalera: true, escaleraPos: "solar", escaleraEscalones: 2, escaleraMedidaEscalon: 0.25, solarHumedo: true, solarHumedoAncho: 1 },
      CLIENTE
    );
    const rect = rectEscalera(g.extras);
    const pxPerM = g.pool.w / BASE.largo;
    expect(rect).toBeTruthy();
    if (rect && rect.t === "rect") {
      expect(rect.x).toBeCloseTo(g.pool.x + 1 * pxPerM, 5);
    }
  });

  it("del lado lateral2, la franja corre a todo el largo (ancho = poolW) y queda pegada abajo", () => {
    const g = calcularGeometriaPlano(
      { ...BASE, escalera: true, escaleraPos: "lateral2", escaleraEscalones: 2, escaleraMedidaEscalon: 0.25 },
      CLIENTE
    );
    const rect = rectEscalera(g.extras);
    expect(rect).toBeTruthy();
    if (rect && rect.t === "rect") {
      expect(rect.w).toBeCloseTo(g.pool.w, 5);
      expect(rect.y + rect.h).toBeCloseTo(g.pool.y + g.pool.h, 5);
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
