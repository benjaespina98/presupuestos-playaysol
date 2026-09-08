import { describe, expect, it } from "vitest";
import { aNuevoItem, nuevoItemFormVacio } from "./nuevo-item.schema";

describe("aNuevoItem", () => {
  it("normaliza la clave: tildes, mayúsculas y espacios a snake_case", () => {
    const resultado = aNuevoItem({
      ...nuevoItemFormVacio(),
      tipo: "cercos",
      clave: "Cerco Reforzado (Ñandú)",
      descripcion: "Cerco reforzado",
    });
    expect(resultado?.clave).toBe("cerco_reforzado_nandu");
  });

  it("una clave que queda vacía después de normalizar (sólo símbolos) devuelve null", () => {
    const resultado = aNuevoItem({ ...nuevoItemFormVacio(), clave: "###" });
    expect(resultado).toBeNull();
  });

  it("descripción vacía se guarda como null, no como cadena vacía", () => {
    const resultado = aNuevoItem({ ...nuevoItemFormVacio(), clave: "x", descripcion: "   " });
    expect(resultado?.descripcion).toBeNull();
  });

  it("categoría/unidad '' (sin elegir) se traducen a null", () => {
    const resultado = aNuevoItem({ ...nuevoItemFormVacio(), clave: "x", categoria: "", unidad: "" });
    expect(resultado?.categoria).toBeNull();
    expect(resultado?.unidad).toBeNull();
  });
});
