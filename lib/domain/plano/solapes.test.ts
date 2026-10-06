import { describe, expect, it } from "vitest";
import { buscarLugarLibre, cajaDeTexto, contiene, seSuperponen, unirCajas } from "./solapes";

const caja = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 });

describe("seSuperponen / contiene", () => {
  it("dos cajas que sólo se tocan en el borde no se superponen; con margen sí chocan", () => {
    expect(seSuperponen(caja(0, 0, 10, 10), caja(10, 0, 20, 10))).toBe(false);
    expect(seSuperponen(caja(0, 0, 10, 10), caja(9, 0, 20, 10))).toBe(true);
    expect(seSuperponen(caja(0, 0, 10, 10), caja(12, 0, 20, 10), 3)).toBe(true);
  });

  it("contiene exige que quepa entera", () => {
    expect(contiene(caja(0, 0, 100, 100), caja(10, 10, 20, 20))).toBe(true);
    expect(contiene(caja(0, 0, 100, 100), caja(90, 10, 110, 20))).toBe(false);
  });

  it("unirCajas abarca todas", () => {
    expect(unirCajas([caja(0, 0, 5, 5), caja(10, 2, 12, 20)])).toEqual(caja(0, 0, 12, 20));
  });
});

describe("cajaDeTexto", () => {
  it("centrado: el ancho sale de la cantidad de caracteres y queda centrado en x", () => {
    const c = cajaDeTexto({ x: 100, y: 50, text: "1,00 m", fontSize: 10, anchor: "middle", central: true });
    expect(c.x0).toBeCloseTo(100 - (6 * 10 * 0.56) / 2, 5);
    expect(c.x1).toBeCloseTo(100 + (6 * 10 * 0.56) / 2, 5);
    expect((c.y0 + c.y1) / 2).toBeCloseTo(50, 5);
  });

  it("anchor start crece hacia la derecha, end hacia la izquierda", () => {
    const s = cajaDeTexto({ x: 100, y: 50, text: "abcd", fontSize: 10, anchor: "start" });
    const e = cajaDeTexto({ x: 100, y: 50, text: "abcd", fontSize: 10, anchor: "end" });
    expect(s.x0).toBe(100);
    expect(e.x1).toBe(100);
  });
});

describe("buscarLugarLibre", () => {
  const region = caja(0, 0, 200, 100);

  it("si ya está libre, no se mueve", () => {
    expect(buscarLugarLibre(caja(10, 10, 30, 20), region, [caja(150, 50, 190, 90)])).toEqual({ dx: 0, dy: 0 });
  });

  it("si está pisado, devuelve el movimiento mínimo que lo deja libre y dentro de la región", () => {
    const ocupado = caja(0, 0, 100, 30);
    const lugar = buscarLugarLibre(caja(10, 10, 40, 20), region, [ocupado], 8, 2)!;
    expect(lugar).not.toBeNull();
    const movida = caja(10 + lugar.dx, 10 + lugar.dy, 40 + lugar.dx, 20 + lugar.dy);
    expect(seSuperponen(movida, ocupado, 2)).toBe(false);
    expect(contiene(region, movida)).toBe(true);
  });

  it("prefiere correrse en vertical antes que de costado", () => {
    const lugar = buscarLugarLibre(caja(80, 40, 120, 50), region, [caja(70, 35, 130, 55)], 8, 0)!;
    expect(lugar.dy).not.toBe(0);
  });

  it("devuelve null si no hay lugar libre en la región", () => {
    expect(buscarLugarLibre(caja(10, 10, 30, 20), caja(0, 0, 40, 30), [caja(0, 0, 40, 30)], 8, 0)).toBeNull();
  });
});
