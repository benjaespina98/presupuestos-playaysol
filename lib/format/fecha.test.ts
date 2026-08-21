import { describe, expect, it } from "vitest";
import { formatFechaRelativa, formatFechaCompleta } from "./fecha";

const AHORA = new Date("2026-08-21T15:00:00");

describe("formatFechaRelativa", () => {
  it("hoy", () => {
    expect(formatFechaRelativa("2026-08-21T09:00:00", AHORA)).toBe("hoy");
  });

  it("una fecha futura también cae en 'hoy' (piso en 0, nunca negativo)", () => {
    expect(formatFechaRelativa("2026-08-22T09:00:00", AHORA)).toBe("hoy");
  });

  it("ayer", () => {
    expect(formatFechaRelativa("2026-08-20T23:59:00", AHORA)).toBe("ayer");
  });

  it("hace N días (2 a 6)", () => {
    expect(formatFechaRelativa("2026-08-18T00:00:00", AHORA)).toBe("hace 3 días");
    expect(formatFechaRelativa("2026-08-15T00:00:00", AHORA)).toBe("hace 6 días");
  });

  it("hace N semanas (7 a 29 días)", () => {
    expect(formatFechaRelativa("2026-08-14T00:00:00", AHORA)).toBe("hace 1 semana");
    expect(formatFechaRelativa("2026-07-25T00:00:00", AHORA)).toBe("hace 3 semanas");
  });

  it("hace N meses (30 a 364 días)", () => {
    expect(formatFechaRelativa("2026-07-20T00:00:00", AHORA)).toBe("hace 1 mes");
    expect(formatFechaRelativa("2026-02-21T00:00:00", AHORA)).toBe("hace 6 meses");
  });

  it("hace N años (365+ días)", () => {
    expect(formatFechaRelativa("2025-08-20T00:00:00", AHORA)).toBe("hace 1 año");
    expect(formatFechaRelativa("2023-08-20T00:00:00", AHORA)).toBe("hace 3 años");
  });

  it("fecha inválida da string vacío, no NaN ni excepción", () => {
    expect(formatFechaRelativa("no es una fecha", AHORA)).toBe("");
  });
});

describe("formatFechaCompleta", () => {
  it("formatea en español, día/mes largo/año", () => {
    expect(formatFechaCompleta("2026-08-21T09:00:00")).toBe("21 de agosto de 2026");
  });

  it("fecha inválida da string vacío", () => {
    expect(formatFechaCompleta("no es una fecha")).toBe("");
  });
});
