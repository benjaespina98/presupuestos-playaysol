import { describe, expect, it } from "vitest";
import { MATERIALES_BORDE, calcularGeometriaPlano, colorDeBorde, leyendaDeBorde, nombreDeBorde } from "./losetas";

const BASE = { largo: 8, ancho: 4, solar: 1, opuesto: 1, lateral1: 1, lateral2: 1 };
const CLIENTE = { viewW: 1000, viewHmax: 650, showDims: true, interactive: false } as const;

describe("material y tono del borde", () => {
  it("losetas y decks tienen marfil y blanco, distintos entre sí; el travertino un solo color", () => {
    for (const m of ["losetas", "decks"] as const) {
      expect(MATERIALES_BORDE[m].conTono).toBe(true);
      expect(colorDeBorde(m, "marfil")).not.toBe(colorDeBorde(m, "blanco"));
    }
    expect(MATERIALES_BORDE.travertino.conTono).toBe(false);
    expect(colorDeBorde("travertino", "blanco")).toBe(colorDeBorde("travertino", "marfil"));
  });

  it("el marfil de las losetas es el color de siempre del plano (los planos viejos no cambian)", () => {
    expect(colorDeBorde("losetas", "marfil")).toBe("#F7E6D3");
  });

  it("la leyenda y el nombre incluyen el tono sólo cuando hay tono", () => {
    expect(leyendaDeBorde("losetas", "marfil")).toBe("Borde de loseta marfil");
    expect(leyendaDeBorde("decks", "blanco")).toBe("Borde de deck blanco");
    expect(leyendaDeBorde("travertino", "blanco")).toBe("Borde de travertino");
    expect(nombreDeBorde("decks", "blanco")).toBe("decks blanco");
    expect(nombreDeBorde("travertino", "marfil")).toBe("travertino");
  });

  it("el plano del cliente nombra el borde con material y tono", () => {
    const leyenda = (material: "losetas" | "decks" | "travertino", tono: "marfil" | "blanco") =>
      calcularGeometriaPlano({ ...BASE, materialBorde: material, tonoBorde: tono }, CLIENTE).legend.map((l) => l.label);

    expect(leyenda("losetas", "blanco")).toContain("Borde de loseta blanco");
    expect(leyenda("decks", "marfil")).toContain("Borde de deck marfil");
    expect(leyenda("travertino", "blanco")).toContain("Borde de travertino");
  });

  it("sin elegir tono (plano viejo) es marfil", () => {
    const g = calcularGeometriaPlano(BASE, CLIENTE);
    expect(g.legend.map((l) => l.label)).toContain("Borde de loseta marfil");
  });
});
