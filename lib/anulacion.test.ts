import { describe, expect, it } from "vitest";
import {
  MOTIVO_MAX,
  MOTIVO_MIN,
  contarAnulados,
  estaAnulado,
  filtrarAnulados,
  mensajeDeErrorAnulacion,
  validarMotivo,
} from "./anulacion";

describe("validarMotivo", () => {
  it("acepta un motivo y lo devuelve recortado", () => {
    expect(validarMotivo("  Cargado dos veces  ")).toEqual({ motivo: "Cargado dos veces", error: null });
  });

  it("acepta justo el mínimo y justo el máximo", () => {
    expect(validarMotivo("a".repeat(MOTIVO_MIN)).error).toBeNull();
    expect(validarMotivo("a".repeat(MOTIVO_MAX)).error).toBeNull();
  });

  it.each([["vacío", ""], ["sólo espacios", "     "], ["muy corto", "ab"], ["corto con espacios", "  a  "]])(
    "rechaza un motivo %s",
    (_n, texto) => {
      const r = validarMotivo(texto);
      expect(r.motivo).toBeNull();
      expect(r.error).toMatch(/motivo/i);
    }
  );

  it("rechaza un motivo de más de 500 caracteres", () => {
    const r = validarMotivo("a".repeat(MOTIVO_MAX + 1));
    expect(r.motivo).toBeNull();
    expect(r.error).toMatch(/largo/i);
  });
});

describe("filtrarAnulados", () => {
  const items = [
    { id: 1, anulado_at: null },
    { id: 2, anulado_at: "2026-10-01T10:00:00Z" },
    { id: 3 },
  ];

  it("por defecto no muestra los anulados", () => {
    expect(filtrarAnulados(items, false).map((i) => i.id)).toEqual([1, 3]);
  });

  it("con el interruptor, los muestra junto al resto y en el mismo orden", () => {
    expect(filtrarAnulados(items, true).map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it("estaAnulado y contarAnulados miran sólo anulado_at", () => {
    expect(estaAnulado(items[0])).toBe(false);
    expect(estaAnulado(items[1])).toBe(true);
    expect(estaAnulado(items[2])).toBe(false);
    expect(contarAnulados(items)).toBe(1);
  });
});

describe("mensajeDeErrorAnulacion", () => {
  it("traduce el error de registro ya anulado", () => {
    expect(mensajeDeErrorAnulacion("El registro está anulado y no se puede modificar.")).toMatch(/ya está anulado/);
  });

  it("traduce el error de motivo", () => {
    expect(mensajeDeErrorAnulacion("Para anular hace falta un motivo de entre 3 y 500 caracteres.")).toMatch(/3 y 500/);
  });

  it("deja pasar lo que no reconoce, y tiene un texto si no hay nada", () => {
    expect(mensajeDeErrorAnulacion("fallo de red")).toBe("fallo de red");
    expect(mensajeDeErrorAnulacion(null)).toBe("No se pudo anular.");
  });
});
