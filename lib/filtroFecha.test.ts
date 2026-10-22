import { describe, expect, it } from "vitest";
import { contarPorFecha, dentroDeFecha } from "./filtroFecha";

const ahora = new Date("2026-10-22T12:00:00Z");

describe("filtro de fecha", () => {
  it("sin filtro, todo entra", () => {
    expect(dentroDeFecha("2020-01-01T00:00:00Z", "", ahora)).toBe(true);
  });
  it("los últimos N días", () => {
    expect(dentroDeFecha("2026-10-16T12:00:00Z", "7", ahora)).toBe(true);
    expect(dentroDeFecha("2026-10-10T12:00:00Z", "7", ahora)).toBe(false);
    expect(dentroDeFecha("2026-10-10T12:00:00Z", "30", ahora)).toBe(true);
    expect(dentroDeFecha("2026-06-01T12:00:00Z", "90", ahora)).toBe(false);
  });
  it("este año", () => {
    expect(dentroDeFecha("2026-01-05T12:00:00Z", "anio", ahora)).toBe(true);
    expect(dentroDeFecha("2025-12-30T12:00:00Z", "anio", ahora)).toBe(false);
  });
  it("cuenta por período", () => {
    const fechas = ["2026-10-20T00:00:00Z", "2026-10-01T00:00:00Z", "2026-07-01T00:00:00Z", "2025-01-01T00:00:00Z"];
    expect(contarPorFecha(fechas, (f) => f, ahora)).toEqual({ "": 4, "7": 1, "30": 2, "90": 2, anio: 3 });
  });
});
