import { describe, expect, it } from "vitest";
import { z } from "zod";
import { idDeFila, mensajeFilaInvalida, resumenErrorZod } from "./logs";

const Esquema = z.object({
  id: z.string(),
  nombre: z.string(),
  telefono: z.string(),
  precio: z.number().min(0),
});

describe("idDeFila", () => {
  it("devuelve el id si es texto o número", () => {
    expect(idDeFila({ id: "abc-123", nombre: "x" })).toBe("abc-123");
    expect(idDeFila({ id: 42 })).toBe("42");
  });

  it.each([null, undefined, "texto", 7, {}, { id: null }, { id: { a: 1 } }])("devuelve 'sin id' para %j", (fila) => {
    expect(idDeFila(fila)).toBe("sin id");
  });
});

describe("mensajeFilaInvalida", () => {
  const fila = { id: "p-1", nombre: "Corralón Juan Pérez", telefono: 3534111111, precio: -999 };
  const resultado = Esquema.safeParse(fila);

  it("incluye el id, el campo y el motivo", () => {
    if (resultado.success) throw new Error("la fila de prueba debería ser inválida");
    const msg = mensajeFilaInvalida("Fila de proveedores omitida", fila, resultado.error);
    expect(msg).toContain("id: p-1");
    expect(msg).toContain("telefono");
    expect(msg).toContain("precio");
  });

  it("NO filtra los datos de la fila (nombre, teléfono, importe)", () => {
    if (resultado.success) throw new Error("la fila de prueba debería ser inválida");
    const msg = mensajeFilaInvalida("Fila de proveedores omitida", fila, resultado.error);
    expect(msg).not.toContain("Corralón");
    expect(msg).not.toContain("Pérez");
    expect(msg).not.toContain("3534111111");
    expect(msg).not.toContain("-999");
  });
});

describe("resumenErrorZod", () => {
  it("marca (raíz) cuando el error no tiene campo", () => {
    const r = z.string().safeParse(5);
    if (r.success) throw new Error("debería fallar");
    expect(resumenErrorZod(r.error)).toMatch(/^\(raíz\): /);
  });
});
