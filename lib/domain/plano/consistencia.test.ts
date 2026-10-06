import { describe, expect, it } from "vitest";
import { calcularGeometriaPlano, posicionPorDefecto, ajustarLucesPos, type Prim } from "./losetas";
import { cajaDeTexto, seSuperponen, type Caja } from "./solapes";

const CLIENTE = { viewW: 1000, viewHmax: 650, showDims: true, interactive: false } as const;
const EDITOR = { viewW: 680, viewHmax: 420, showDims: false, interactive: true } as const;

const BASE = { largo: 8, ancho: 4, solar: 1, opuesto: 1, lateral1: 1, lateral2: 1 };

function textos(g: { extras: Prim[]; dims: Prim[] }) {
  return [...g.extras, ...g.dims].filter((p): p is Extract<Prim, { t: "text" }> => p.t === "text");
}

/** Las cajas de los objetos que dibuja el plano (luces, skimmers, hidromasajes),
 *  reconocidas por su relleno — son los que no se pueden pisar entre sí. */
function objetos(g: { extras: Prim[] }): Caja[] {
  const cajas: Caja[] = [];
  for (const p of g.extras) {
    if (p.t === "circle" && p.fill === "#FFEFA8") cajas.push({ x0: p.cx - p.r, y0: p.cy - p.r, x1: p.cx + p.r, y1: p.cy + p.r });
    if (p.t === "circle" && p.fill === "#ffffff" && p.stroke === "#0C7A8C") cajas.push({ x0: p.cx - p.r, y0: p.cy - p.r, x1: p.cx + p.r, y1: p.cy + p.r });
    if (p.t === "rect" && p.fill === "#EAF0F3") cajas.push({ x0: p.x, y0: p.y, x1: p.x + p.w, y1: p.y + p.h });
  }
  return cajas;
}

/** Los textos de adentro de la pileta que el plano sabe correr de lugar. */
function etiquetas(g: { extras: Prim[]; dims: Prim[] }) {
  return textos(g).filter((t) =>
    /^(Solar húmedo|Escalera|Espejo de agua|Revestimiento:|\d+,\d\d m$|\d+(,\d+)? a \d+(,\d+)? m$)/.test(t.text)
  );
}

/** La caja de un texto, rotada si va de costado (como los de las franjas angostas). */
function cajaDe(t: Extract<Prim, { t: "text" }>): Caja {
  const c = cajaDeTexto(t);
  if (!t.rotateDeg) return c;
  const w = c.x1 - c.x0;
  const h = c.y1 - c.y0;
  return { x0: t.x - h / 2, y0: t.y - w / 2, x1: t.x + h / 2, y1: t.y + w / 2 };
}

describe("posición por defecto de cada tipo de objeto", () => {
  it("las luces conservan su lugar de siempre; los demás nacen en otra pared", () => {
    expect(posicionPorDefecto("luz", 0, 1)).toEqual({ x: 0.06, y: 0.5 });
    expect(posicionPorDefecto("hidromasaje", 0, 1)).toEqual({ x: 0.94, y: 0.5 });
    expect(posicionPorDefecto("skimmer", 0, 1)).toEqual({ x: 0.5, y: 0.1 });
  });

  it("ajustarLucesPos usa el lugar del tipo que se le pide", () => {
    expect(ajustarLucesPos([], true, 2, "hidromasaje")).toEqual([
      { x: 0.94, y: 0.25 },
      { x: 0.94, y: 0.75 },
    ]);
    expect(ajustarLucesPos([], true, 2)).toEqual([
      { x: 0.06, y: 0.25 },
      { x: 0.06, y: 0.75 },
    ]);
  });

  it("una luz, un skimmer y un hidromasaje agregados sin arrastrar no quedan uno encima del otro", () => {
    const g = calcularGeometriaPlano(
      { ...BASE, luces: true, cantLuces: 1, skimmer: true, cantSkimmers: 1, hidromasaje: true, cantHidromasajes: 1 },
      CLIENTE
    );
    const cajas = objetos(g);
    expect(cajas).toHaveLength(3);
    for (let i = 0; i < cajas.length; i++) for (let j = i + 1; j < cajas.length; j++) expect(seSuperponen(cajas[i], cajas[j])).toBe(false);
  });
});

describe("profundidad en el plano", () => {
  it("una profundidad general va en el título y no dibuja cortes", () => {
    const g = calcularGeometriaPlano({ ...BASE, profundidad: 1.15 }, CLIENTE);
    expect(textos(g).some((t) => t.text === "Pileta 8 x 4 m · Prof. 1,15 m")).toBe(true);
    expect(g.extras.filter((p) => p.t === "line")).toHaveLength(0);
  });

  it("sin profundidad cargada el título es el de siempre", () => {
    const g = calcularGeometriaPlano(BASE, CLIENTE);
    expect(textos(g).some((t) => t.text === "Pileta 8 x 4 m")).toBe(true);
  });

  it("'de 0 a 3 m, 1,00; el resto, 1,10': título con rango, un corte y un cartel por franja con su rango", () => {
    const g = calcularGeometriaPlano(
      { ...BASE, profundidad: 1.1, tramosProfundidad: [{ desde: 0, hasta: 3, prof: 1 }] },
      CLIENTE
    );
    const t = textos(g).map((x) => x.text);
    expect(t).toContain("Pileta 8 x 4 m · Prof. 1,00 a 1,10 m");
    expect(t).toContain("1,00 m");
    expect(t).toContain("1,10 m");
    expect(t).toContain("0 a 3 m");
    expect(t).toContain("3 a 8 m");
    expect(g.extras.filter((p) => p.t === "line")).toHaveLength(1);
  });

  it("el corte cae a la distancia correcta desde el lado del solar", () => {
    const g = calcularGeometriaPlano(
      { ...BASE, profundidad: 1.1, tramosProfundidad: [{ desde: 0, hasta: 3, prof: 1 }] },
      CLIENTE
    );
    const corte = g.extras.find((p) => p.t === "line");
    const pxPorM = g.pool.w / BASE.largo;
    expect(corte && corte.t === "line" ? corte.x1 : null).toBeCloseTo(g.pool.x + 3 * pxPorM, 5);
  });

  it("la franja más profunda se dibuja más oscura", () => {
    const g = calcularGeometriaPlano(
      { ...BASE, profundidad: 1.1, tramosProfundidad: [{ desde: 0, hasta: 3, prof: 1 }] },
      CLIENTE
    );
    const franjas = g.extras.filter((p): p is Extract<Prim, { t: "rect" }> => p.t === "rect" && p.fill === "#1B3A5C");
    expect(franjas).toHaveLength(2);
    const [somera, honda] = franjas; // la primera es la de 1,00 m; la segunda la de 1,10 m
    expect(honda.opacity!).toBeGreaterThan(somera.opacity!);
  });

  it("también se ve en el editor, pero sin los rangos", () => {
    const g = calcularGeometriaPlano(
      { ...BASE, profundidad: 1.1, tramosProfundidad: [{ desde: 0, hasta: 3, prof: 1 }] },
      EDITOR
    );
    expect(textos(g).map((t) => t.text)).toContain("1,00 m");
  });

  it("tramos inválidos no rompen el plano", () => {
    expect(() =>
      calcularGeometriaPlano({ ...BASE, profundidad: 1, tramosProfundidad: [{ desde: 5, hasta: 2, prof: 1 }] }, CLIENTE)
    ).not.toThrow();
  });
});

describe("el plano del cliente no tiene nada pisado", () => {
  const luces = [0, 1, 3];
  const skimmers = [0, 2];
  const hidros = [0, 3];
  const combos: { nombre: string; extra: Record<string, unknown> }[] = [
    { nombre: "solar húmedo + escalera en el solar", extra: { solarHumedo: true, solarHumedoAncho: 1.2, escalera: true, escaleraPos: "solar" } },
    { nombre: "escalera en el lado opuesto", extra: { escalera: true, escaleraPos: "opuesto" } },
    { nombre: "fibra con espejo de agua", extra: { tipoPileta: "fibra", labios: 0.2 } },
    { nombre: "con revestimiento", extra: { revestimiento: "ceramicos" } },
    { nombre: "con profundidad por tramos", extra: { profundidad: 1.1, tramosProfundidad: [{ desde: 0, hasta: 3, prof: 1 }] } },
    {
      nombre: "todo junto",
      extra: {
        solarHumedo: true, solarHumedoAncho: 1.2, escalera: true, escaleraPos: "opuesto", tipoPileta: "fibra", labios: 0.2,
        revestimiento: "travertino", profundidad: 1.1, tramosProfundidad: [{ desde: 0, hasta: 3, prof: 1 }],
      },
    },
  ];

  for (const combo of combos) {
    for (const nl of luces) {
      for (const ns of skimmers) {
        for (const nh of hidros) {
          it(`${combo.nombre} · ${nl} luces, ${ns} skimmers, ${nh} hidromasajes`, () => {
            const g = calcularGeometriaPlano(
              {
                ...BASE,
                ...combo.extra,
                luces: nl > 0, cantLuces: nl,
                skimmer: ns > 0, cantSkimmers: ns,
                hidromasaje: nh > 0, cantHidromasajes: nh,
              },
              CLIENTE
            );
            const cajas = objetos(g);
            expect(cajas).toHaveLength(nl + ns + nh);

            // Ningún objeto encima de otro.
            for (let i = 0; i < cajas.length; i++) {
              for (let j = i + 1; j < cajas.length; j++) {
                expect(seSuperponen(cajas[i], cajas[j]), `objetos ${i} y ${j}`).toBe(false);
              }
            }
            // Ningún texto de la pileta encima de un objeto.
            for (const t of etiquetas(g)) {
              const ct = cajaDe(t);
              cajas.forEach((c, i) => expect(seSuperponen(ct, c), `"${t.text}" con el objeto ${i}`).toBe(false));
            }
          });
        }
      }
    }
  }

  it("los carteles de profundidad quedan a la vista: no caen sobre el solar húmedo ni sobre la escalera", () => {
    const g = calcularGeometriaPlano(
      {
        ...BASE,
        solar: 1.5,
        solarHumedo: true, solarHumedoAncho: 1, escalera: true, escaleraPos: "solar",
        profundidad: 1.1, tramosProfundidad: [{ desde: 0, hasta: 3, prof: 1 }],
      },
      CLIENTE
    );
    const franjas = g.extras
      .filter((p): p is Extract<Prim, { t: "rect" }> => p.t === "rect" && (p.fill === "#BFE0EF" || p.dash === "3 2"))
      .map((p) => ({ x0: p.x, y0: p.y, x1: p.x + p.w, y1: p.y + p.h }));
    expect(franjas).toHaveLength(2);
    const cartel = textos(g).find((t) => t.text === "1,00 m")!;
    for (const franja of franjas) expect(seSuperponen(cajaDe(cartel), franja)).toBe(false);
  });

  it("los carteles de profundidad se dibujan después de las franjas, para que nada los tape", () => {
    const g = calcularGeometriaPlano(
      {
        ...BASE,
        solarHumedo: true, solarHumedoAncho: 1, escalera: true, escaleraPos: "solar",
        profundidad: 1.1, tramosProfundidad: [{ desde: 0, hasta: 3, prof: 1 }],
      },
      CLIENTE
    );
    const orden = (pred: (p: Prim) => boolean) => g.extras.findIndex(pred);
    const franja = orden((p) => p.t === "rect" && p.dash === "3 2");
    const cartel = orden((p) => p.t === "text" && p.text === "1,00 m");
    expect(franja).toBeGreaterThanOrEqual(0);
    expect(cartel).toBeGreaterThan(franja);
  });

  it("el texto de una franja angosta va de costado en vez de pisar a la de al lado", () => {
    const g = calcularGeometriaPlano({ ...BASE, solarHumedo: true, solarHumedoAncho: 1, escalera: true, escaleraPos: "solar" }, CLIENTE);
    const sh = textos(g).find((t) => t.text.startsWith("Solar húmedo"))!;
    expect(sh.rotateDeg).toBe(-90);
  });

  it("el texto de una franja ancha sigue horizontal", () => {
    const g = calcularGeometriaPlano({ ...BASE, solarHumedo: true, solarHumedoAncho: 4 }, CLIENTE);
    const sh = textos(g).find((t) => t.text.startsWith("Solar húmedo"))!;
    expect(sh.rotateDeg).toBeUndefined();
  });

  it("en el editor lo arrastrado se ve donde se lo puso, aunque quede encima de otra cosa", () => {
    const g = calcularGeometriaPlano(
      {
        ...BASE,
        luces: true, cantLuces: 1, lucesPos: [{ x: 0.5, y: 0.5 }],
        hidromasaje: true, cantHidromasajes: 1, hidromasajesPos: [{ x: 0.5, y: 0.5 }],
      },
      EDITOR
    );
    const [luz, hidro] = objetos(g);
    expect((luz.x0 + luz.x1) / 2).toBeCloseTo((hidro.x0 + hidro.x1) / 2, 5);
  });

  it("en la imagen del cliente, dos objetos puestos en el mismo punto se separan", () => {
    const g = calcularGeometriaPlano(
      {
        ...BASE,
        luces: true, cantLuces: 1, lucesPos: [{ x: 0.5, y: 0.5 }],
        hidromasaje: true, cantHidromasajes: 1, hidromasajesPos: [{ x: 0.5, y: 0.5 }],
      },
      CLIENTE
    );
    const [luz, hidro] = objetos(g);
    expect(seSuperponen(luz, hidro)).toBe(false);
  });
});
