import { describe, expect, it } from "vitest";
import { justificarFilas } from "./imageLayout";

const ANCHO = 500;
const ALTO_OBJETIVO = 150;

function sumaAnchoFila(fila: { anchoRender: number }[]): number {
  return fila.reduce((s, f) => s + f.anchoRender, 0);
}

describe("justificarFilas", () => {
  it("sin fotos no arma ninguna fila", () => {
    expect(justificarFilas([], ANCHO, ALTO_OBJETIVO)).toEqual([]);
  });

  it("una sola foto apaisada no se estira más allá del techo de altura, sin deformarse", () => {
    const filas = justificarFilas([{ width: 1600, height: 900 }], ANCHO, ALTO_OBJETIVO);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toHaveLength(1);
    // Es la única foto de la fila: no hay con qué compartirla, así que no se
    // estira a lo ancho de toda la página — se respeta el techo de altura.
    const { anchoRender, altoRender } = filas[0][0];
    expect(altoRender).toBeCloseTo(ALTO_OBJETIVO * 1.6, 5);
    expect(anchoRender).toBeLessThan(ANCHO);
    // No se deformó: sigue siendo 16:9.
    expect(anchoRender / altoRender).toBeCloseTo(1600 / 900, 5);
  });

  it("una foto sola menos apaisada sí puede llegar a llenar el ancho si el techo lo permite", () => {
    const filas = justificarFilas([{ width: 900, height: 1600 }], ANCHO, ALTO_OBJETIVO, 900);
    expect(sumaAnchoFila(filas[0])).toBeCloseTo(ANCHO, 5);
  });

  it("dos fotos de proporción distinta comparten fila sin deformarse y llenan el ancho", () => {
    const fotos = [
      { width: 400, height: 400 }, // cuadrada
      { width: 800, height: 400 }, // apaisada 2:1
    ];
    const filas = justificarFilas(fotos, ANCHO, ALTO_OBJETIVO);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toHaveLength(2);
    expect(sumaAnchoFila(filas[0])).toBeCloseTo(ANCHO, 5);
    expect(filas[0][0].anchoRender / filas[0][0].altoRender).toBeCloseTo(1, 5);
    expect(filas[0][1].anchoRender / filas[0][1].altoRender).toBeCloseTo(2, 5);
    // Las dos fotos de una misma fila comparten alto.
    expect(filas[0][0].altoRender).toBeCloseTo(filas[0][1].altoRender, 5);
  });

  it("varias fotos mixtas arman más de una fila y cada una llena el ancho", () => {
    const fotos = [
      { width: 400, height: 400 },
      { width: 400, height: 400 },
      { width: 400, height: 400 },
      { width: 1600, height: 900 },
      { width: 300, height: 500 }, // vertical
    ];
    const filas = justificarFilas(fotos, ANCHO, ALTO_OBJETIVO);
    expect(filas.length).toBeGreaterThan(1);
    for (const fila of filas.slice(0, -1)) {
      expect(sumaAnchoFila(fila)).toBeCloseTo(ANCHO, 3);
    }
    // La última fila nunca excede el techo (evita una foto sola gigante).
    const ultima = filas[filas.length - 1];
    for (const f of ultima) expect(f.altoRender).toBeLessThanOrEqual(ALTO_OBJETIVO * 1.6 + 0.001);
  });

  it("una foto sin dimensiones válidas se trata como cuadrada, no rompe el cálculo", () => {
    const filas = justificarFilas([{ width: 0, height: 0 }], ANCHO, ALTO_OBJETIVO);
    expect(filas).toHaveLength(1);
    expect(filas[0][0].anchoRender).toBeCloseTo(filas[0][0].altoRender, 5);
  });
});
