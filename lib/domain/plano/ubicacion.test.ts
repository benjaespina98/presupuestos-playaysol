import { describe, expect, it } from "vitest";
import { calcularGeometriaPlano, type Prim } from "./losetas";
import { dibujarBrujula, reservaPorLado, ubicarObjetos, vectoresCardinales, etiquetaPosicion } from "./ubicacion";

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

describe("sala de filtro y casa", () => {
  it("reserva lugar sólo en el lado elegido, y se apilan en el mismo lado", () => {
    expect(reservaPorLado([{ tipo: "sala", lado: "opuesto", pos: "fin" }])).toEqual({ solar: 0, opuesto: 56, lateral1: 0, lateral2: 0 });
    const juntas = reservaPorLado([
      { tipo: "sala", lado: "solar", pos: "inicio" },
      { tipo: "casa", lado: "solar", pos: "centro" },
    ]);
    expect(juntas.solar).toBe(56 + 88);
  });

  it("la sala va afuera del borde, del lado pedido y nunca encima", () => {
    const borde = { x: 100, y: 100, w: 400, h: 200 };
    const lados = {
      lateral1: (c: { y: number; h: number }) => c.y + c.h <= borde.y,
      lateral2: (c: { y: number }) => c.y >= borde.y + borde.h,
      solar: (c: { x: number; w: number }) => c.x + c.w <= borde.x,
      opuesto: (c: { x: number }) => c.x >= borde.x + borde.w,
    } as const;
    for (const lado of ["lateral1", "lateral2", "solar", "opuesto"] as const) {
      const [c] = ubicarObjetos([{ tipo: "sala", lado, pos: "centro" }], borde);
      expect(lados[lado](c)).toBe(true);
    }
  });

  it("la posición sobre el lado: inicio, centro o fin", () => {
    const borde = { x: 0, y: 100, w: 400, h: 200 };
    const x = (pos: "inicio" | "centro" | "fin") => ubicarObjetos([{ tipo: "sala", lado: "lateral1", pos }], borde)[0].x;
    expect(x("inicio")).toBe(0);
    expect(x("centro")).toBe((400 - 84) / 2);
    expect(x("fin")).toBe(400 - 84);
  });

  it("si comparten lado, la casa queda detrás de la sala (más lejos del borde)", () => {
    const [sala, casa] = ubicarObjetos(
      [{ tipo: "sala", lado: "lateral2", pos: "fin" }, { tipo: "casa", lado: "lateral2", pos: "centro" }],
      { x: 0, y: 0, w: 400, h: 200 }
    );
    expect(casa.y).toBeGreaterThanOrEqual(sala.y + sala.h);
  });

  it("en el plano: se dibujan con su nombre, en la leyenda y dentro del dibujo, sin tocar la pileta", () => {
    const g = calcularGeometriaPlano({ ...base, salaFiltro: true, salaLado: "opuesto", casa: true, casaLado: "lateral1" }, cliente);
    expect(textos(g.extras)).toEqual(expect.arrayContaining(["Sala de", "filtro", "Casa /", "quincho"]));
    expect(g.legend.map((l) => l.label)).toEqual(expect.arrayContaining(["Sala de filtro", "Casa / quincho"]));
    const fondo = g.fondo as Extract<Prim, { t: "rect" }>;
    const sala = rects(g.extras).find((r) => r.fill === "#4B5563")!;
    expect(sala.x).toBeGreaterThanOrEqual(fondo.x + fondo.w); // fuera del borde, a la derecha
    for (const r of rects(g.extras).filter((r) => r.fill === "#4B5563" || r.fill === "#E4DED2")) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(g.viewW);
      expect(r.y + r.h).toBeLessThanOrEqual(g.svgH);
    }
  });

  it("reservar lugar achica el plano pero el borde y la pileta siguen proporcionales", () => {
    const sin = calcularGeometriaPlano(base, cliente);
    const con = calcularGeometriaPlano({ ...base, casa: true, casaLado: "solar", salaFiltro: true, salaLado: "lateral2" }, cliente);
    expect(con.pool.w / con.pool.h).toBeCloseTo(sin.pool.w / sin.pool.h, 5);
    expect(con.pool.w).toBeLessThanOrEqual(sin.pool.w);
  });

  it("las cotas y el título quedan por fuera de lo reservado (no se pisan con la casa)", () => {
    const g = calcularGeometriaPlano({ ...base, casa: true, casaLado: "lateral1" }, cliente);
    const casa = rects(g.extras).find((r) => r.fill === "#E4DED2")!;
    const titulo = g.dims.find((p) => p.t === "text" && p.text.startsWith("Pileta")) as Extract<Prim, { t: "text" }>;
    expect(titulo.y).toBeLessThan(casa.y);
  });

  it("en cada lado: ninguna combinación se sale del dibujo ni de la leyenda", () => {
    for (const lado of ["solar", "opuesto", "lateral1", "lateral2"] as const) {
      for (const op of [editor, cliente]) {
        const g = calcularGeometriaPlano({ ...base, salaFiltro: true, salaLado: lado, casa: true, casaLado: lado, puntosCardinales: true }, op);
        for (const r of rects(g.extras).filter((r) => r.fill === "#4B5563" || r.fill === "#E4DED2")) {
          expect(r.x).toBeGreaterThanOrEqual(-0.5);
          expect(r.y).toBeGreaterThanOrEqual(-0.5);
          expect(r.x + r.w).toBeLessThanOrEqual(g.viewW + 0.5);
          expect(r.y + r.h).toBeLessThanOrEqual(g.svgH + 0.5);
        }
      }
    }
  });

  it("etiquetas de posición según el lado", () => {
    expect(etiquetaPosicion("lateral1", "inicio")).toBe("Hacia la izquierda");
    expect(etiquetaPosicion("solar", "fin")).toBe("Hacia abajo");
    expect(etiquetaPosicion("opuesto", "centro")).toBe("Centrada");
  });
});
