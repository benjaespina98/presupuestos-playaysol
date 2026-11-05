import { describe, expect, it } from "vitest";
import { coincideBusqueda, normalizarTexto } from "./texto";

describe("normalizarTexto", () => {
  it("quita tildes y mayúsculas", () => {
    expect(normalizarTexto("Solárium HORMIGÓN")).toBe("solarium hormigon");
  });
});

describe("coincideBusqueda", () => {
  it("no distingue tildes ni mayúsculas, en ninguno de los dos sentidos", () => {
    expect(coincideBusqueda("Solárium seco", "solarium")).toBe(true);
    expect(coincideBusqueda("Solarium seco", "SOLÁRIUM")).toBe(true);
  });

  it("cada palabra puede estar en cualquier orden", () => {
    expect(coincideBusqueda("Hormigón 8x4", "8x4 hormigon")).toBe(true);
  });

  it("todas las palabras tienen que aparecer", () => {
    expect(coincideBusqueda("Hormigón 8x4", "hormigon 7x3")).toBe(false);
  });

  it("una búsqueda vacía o de espacios coincide con todo", () => {
    expect(coincideBusqueda("Lo que sea", "")).toBe(true);
    expect(coincideBusqueda("Lo que sea", "   ")).toBe(true);
  });
});
