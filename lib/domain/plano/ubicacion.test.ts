import { describe, expect, it } from "vitest";
import { calcularGeometriaPlano, type Prim } from "./losetas";
import { ajustarLucesPos, seTocan } from "./losetas";
import { centroPorDefecto, colocarObjeto, dibujarBrujula, reservaUbicacion, separarObjetos, vectoresCardinales } from "./ubicacion";

const base = { largo: 8, ancho: 4, solar: 1.5, opuesto: 1.5, lateral1: 1.5, lateral2: 1.5 };
const editor = { viewW: 680, viewHmax: 420, showDims: false, interactive: true };
const cliente = { viewW: 1000, viewHmax: 650, showDims: true, interactive: false };

const textos = (prims: Prim[]) => prims.filter((p): p is Extract<Prim, { t: "text" }> => p.t === "text").map((p) => p.text);
const rects = (prims: Prim[]) => prims.filter((p): p is Extract<Prim, { t: "rect" }> => p.t === "rect");

describe("puntos cardinales", () => {
  it("el norte arriba: N arriba, E a la derecha, S abajo, O a la izquierda", () => {
    const { norte, este } = vectoresCardinales(0);
    expect(norte[0]).toBeCloseTo(0);
    expect(norte[1]).toBeCloseTo(-1);
    expect(este[0]).toBeCloseTo(1);
    expect(este[1]).toBeCloseTo(0);
  });

  it("el norte a la derecha: el este queda abajo", () => {
    const { norte, este } = vectoresCardinales(90);
    expect(norte[0]).toBeCloseTo(1);
    expect(este[1]).toBeCloseTo(1);
  });

  it("la rosa tiene las cuatro letras, con la N en el lado que corresponde", () => {
    const prims = dibujarBrujula(100, 100, 24, 90, 12);
    expect(textos(prims).sort()).toEqual(["E", "N", "O", "S"]);
    const n = prims.find((p) => p.t === "text" && p.text === "N") as Extract<Prim, { t: "text" }>;
    expect(n.x).toBeGreaterThan(100); // norte a la derecha
    expect(n.y).toBeCloseTo(100);
    const o = prims.find((p) => p.t === "text" && p.text === "O") as Extract<Prim, { t: "text" }>;
    expect(o.y).toBeLessThan(100); // oeste arriba
  });

  it("sólo aparece si se pide, y no mueve nada del plano", () => {
    const sin = calcularGeometriaPlano(base, cliente);
    const con = calcularGeometriaPlano({ ...base, puntosCardinales: true, norteGrados: 45 }, cliente);
    expect(textos(sin.extras)).not.toContain("N");
    expect(textos(con.extras)).toEqual(expect.arrayContaining(["N", "E", "S", "O"]));
    expect(con.pool).toEqual(sin.pool);
  });

  it("queda dentro del dibujo, en el margen y no sobre el plano", () => {
    for (const op of [editor, cliente]) {
      const g = calcularGeometriaPlano({ ...base, puntosCardinales: true }, op);
      const n = g.extras.find((p) => p.t === "text" && p.text === "N") as Extract<Prim, { t: "text" }>;
      expect(n.x).toBeGreaterThan(g.fondo.t === "rect" ? g.fondo.x + g.fondo.w : 0);
      expect(n.x).toBeLessThan(g.viewW);
    }
  });
});

describe("sala de filtro y casa (se arrastran, pero quedan siempre afuera del borde)", () => {
  const borde = { x: 200, y: 150, w: 400, h: 200 };
  const R = reservaUbicacion(["sala", "casa"]);
  const adentro = (c: { x: number; y: number; w: number; h: number }) =>
    c.x < borde.x + borde.w && c.x + c.w > borde.x && c.y < borde.y + borde.h && c.y + c.h > borde.y;

  it("reserva sólo si hay algo, y lo que pide el más grande", () => {
    expect(reservaUbicacion([])).toBe(0);
    expect(reservaUbicacion(["sala"])).toBeLessThan(reservaUbicacion(["casa"]));
    expect(reservaUbicacion(["sala", "casa"])).toBe(reservaUbicacion(["casa"]));
  });

  it("soltarla en cualquier punto (incluso encima de la pileta) la deja afuera del borde y dentro de lo reservado", () => {
    for (const tipo of ["sala", "casa"] as const) {
      for (let fx = -0.4; fx <= 1.4; fx += 0.1) {
        for (let fy = -0.6; fy <= 1.6; fy += 0.15) {
          const c = colocarObjeto(tipo, { x: borde.x + fx * borde.w, y: borde.y + fy * borde.h }, borde, R);
          expect(adentro(c)).toBe(false);
          expect(c.x).toBeGreaterThanOrEqual(borde.x - R - 0.001);
          expect(c.y).toBeGreaterThanOrEqual(borde.y - R - 0.001);
          expect(c.x + c.w).toBeLessThanOrEqual(borde.x + borde.w + R + 0.001);
          expect(c.y + c.h).toBeLessThanOrEqual(borde.y + borde.h + R + 0.001);
        }
      }
    }
  });

  it("queda pegada al lado donde se la soltó, con su lado largo a lo largo de ese lado", () => {
    const arriba = colocarObjeto("casa", { x: 400, y: 100 }, borde, R);
    expect(arriba.y + arriba.h).toBeLessThanOrEqual(borde.y);
    expect(arriba.w).toBeGreaterThan(arriba.h);
    const izquierda = colocarObjeto("casa", { x: 150, y: 250 }, borde, R);
    expect(izquierda.x + izquierda.w).toBeLessThanOrEqual(borde.x);
    expect(izquierda.h).toBeGreaterThan(izquierda.w);
    const derecha = colocarObjeto("sala", { x: 650, y: 250 }, borde, R);
    expect(derecha.x).toBeGreaterThanOrEqual(borde.x + borde.w);
    const abajo = colocarObjeto("sala", { x: 400, y: 400 }, borde, R);
    expect(abajo.y).toBeGreaterThanOrEqual(borde.y + borde.h);
  });

  it("de fábrica: la sala del lado opuesto y la casa del lado del solar", () => {
    expect(colocarObjeto("sala", centroPorDefecto("sala", borde), borde, R).x).toBeGreaterThanOrEqual(borde.x + borde.w);
    expect(colocarObjeto("casa", centroPorDefecto("casa", borde), borde, R).x + 64).toBeLessThanOrEqual(borde.x);
  });

  it("si la casa queda encima de la sala, se corre a lo largo del lado", () => {
    const sala = colocarObjeto("sala", { x: 650, y: 330 }, borde, R);
    const casa = colocarObjeto("casa", { x: 650, y: 300 }, borde, R);
    const corrida = separarObjetos(sala, casa, borde, R);
    const chocan = corrida.x < sala.x + sala.w && sala.x < corrida.x + corrida.w && corrida.y < sala.y + sala.h && sala.y < corrida.y + corrida.h;
    expect(chocan).toBe(false);
  });

  it("en el plano: sale con su nombre, en la leyenda, y la posición guardada (en metros) la mueve", () => {
    const g0 = calcularGeometriaPlano({ ...base, salaFiltro: true, casa: true }, cliente);
    expect(textos(g0.extras)).toEqual(expect.arrayContaining(["Sala de", "filtro", "Casa"]));
    expect(g0.legend.map((l) => l.label)).toEqual(expect.arrayContaining(["Sala de filtro", "Casa"]));

    const salaDe = (g: typeof g0) => rects(g.extras).find((r) => r.fill === "#4B5563")!;
    const g1 = calcularGeometriaPlano({ ...base, salaFiltro: true, salaPosLibre: { x: 5, y: -1 } }, cliente);
    expect(salaDe(g1).y + salaDe(g1).h).toBeLessThanOrEqual(g1.caja.y); // arriba del borde
    const g2 = calcularGeometriaPlano({ ...base, salaFiltro: true, salaPosLibre: { x: 5, y: 4 } }, cliente);
    expect(salaDe(g2).y).toBeGreaterThanOrEqual(g2.caja.y + g2.caja.h);
  });

  it("en el editor se puede agarrar (hay manija); en el plano del cliente no", () => {
    const manijas = (g: ReturnType<typeof calcularGeometriaPlano>) =>
      g.extras.filter((p) => p.t === "circle" && p.drag && (p.drag.tipo === "sala" || p.drag.tipo === "casa")).length;
    expect(manijas(calcularGeometriaPlano({ ...base, salaFiltro: true, casa: true }, editor))).toBe(2);
    expect(manijas(calcularGeometriaPlano({ ...base, salaFiltro: true, casa: true }, cliente))).toBe(0);
  });

  it("expone el borde y la escala para convertir el puntero a metros", () => {
    const g = calcularGeometriaPlano(base, editor);
    expect(g.caja.w / g.caja.pxPerM).toBeCloseTo(11, 5); // 8 + 1,5 + 1,5
    expect(g.caja.h / g.caja.pxPerM).toBeCloseTo(7, 5);
  });

  it("reservar lugar achica el plano pero la pileta sigue proporcionada", () => {
    const sin = calcularGeometriaPlano(base, cliente);
    const con = calcularGeometriaPlano({ ...base, casa: true, salaFiltro: true }, cliente);
    expect(con.pool.w / con.pool.h).toBeCloseTo(sin.pool.w / sin.pool.h, 5);
    expect(con.pool.w).toBeLessThanOrEqual(sin.pool.w);
  });

  it("las cotas y el título quedan por fuera de lo reservado: nada se pisa con la casa arrastrada arriba", () => {
    const g = calcularGeometriaPlano({ ...base, casa: true, casaPosLibre: { x: 5.5, y: -3 } }, cliente);
    const casa = rects(g.extras).find((r) => r.fill === "#E4DED2")!;
    const titulo = g.dims.find((p) => p.t === "text" && p.text.startsWith("Pileta")) as Extract<Prim, { t: "text" }>;
    expect(titulo.y).toBeLessThan(casa.y);
  });

  it("el cartel de ayuda del editor nombra la sala y la casa", () => {
    const g = calcularGeometriaPlano({ ...base, salaFiltro: true, casa: true }, editor);
    expect(textos(g.extras).some((t) => t.includes("la sala de filtro") && t.includes("la casa"))).toBe(true);
  });
});

describe("que un objeto nuevo no nazca encima de otro", () => {
  it("un skimmer nuevo se corre si una luz ya está donde nacería", () => {
    const luzArriba = { x: 0.5, y: 0.1 };
    const [skimmer] = ajustarLucesPos([], true, 1, "skimmer", [luzArriba]);
    expect(seTocan(skimmer, luzArriba)).toBe(false);
    expect(skimmer.y).toBeCloseTo(0.1); // sigue sobre la pared de arriba
  });

  it("sin choque, la posición de siempre", () => {
    expect(ajustarLucesPos([], true, 1, "skimmer", [{ x: 0.9, y: 0.9 }])).toEqual([{ x: 0.5, y: 0.1 }]);
  });

  it("varios objetos del mismo tipo tampoco se pisan entre sí", () => {
    const luces = ajustarLucesPos([], true, 4, "luz", [{ x: 0.06, y: 0.375 }]);
    for (let i = 0; i < luces.length; i++) for (let j = i + 1; j < luces.length; j++) expect(seTocan(luces[i], luces[j])).toBe(false);
  });
});

describe("la medida de cada lado siempre se dice", () => {
  it("un lado sin borde (0 m) lleva su medida afuera, pegada a él", () => {
    for (const op of [editor, cliente]) {
      const g = calcularGeometriaPlano({ largo: 7, ancho: 3, solar: 2, opuesto: 0, lateral1: 0.5, lateral2: 0.5 }, op);
      const t = g.dims.find((p) => p.t === "text" && p.text === "Opuesto: 0 m") as Extract<Prim, { t: "text" }> | undefined;
      expect(t, "falta la medida del opuesto").toBeTruthy();
      expect(t!.x).toBeGreaterThanOrEqual(g.caja.x + g.caja.w);
    }
  });

  it("un lado con desborde infinito no lleva medida (ya dice DESBORDE)", () => {
    const g = calcularGeometriaPlano({ largo: 7, ancho: 3, solar: 2, opuesto: 1, desbordeOpuesto: true }, cliente);
    expect(textos(g.dims).some((t) => t.startsWith("Opuesto"))).toBe(false);
  });
});
