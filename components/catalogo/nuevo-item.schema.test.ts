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

describe("aNuevoItem · piscinas", () => {
  it("hormigón: clave, descripción, categoría y unidad salen de las medidas", () => {
    const r = aNuevoItem({ ...nuevoItemFormVacio(), alta: "hormigon", largo: 8, ancho: 4.5, precio: 1000 });
    expect(r).toMatchObject({ tipo: "piscinas", clave: "lista_hormigon_8x4_5", categoria: "Piscinas", unidad: "obra", precio: 1000 });
    expect(r?.descripcion).toBe("Piscina de hormigón 8x4.5 — precio de lista, obra terminada");
  });

  it("Indusplast: clave con modelo y medida", () => {
    const r = aNuevoItem({ ...nuevoItemFormVacio(), alta: "indusplast", modelo: "finesa", medida: 650 });
    expect(r).toMatchObject({ clave: "indusplast_finesa_650", categoria: "Piscinas", unidad: "obra" });
  });

  it("sin medidas, o con un modelo que no existe, devuelve null", () => {
    expect(aNuevoItem({ ...nuevoItemFormVacio(), alta: "hormigon", largo: 0, ancho: 4 })).toBeNull();
    expect(aNuevoItem({ ...nuevoItemFormVacio(), alta: "indusplast", modelo: "inventado", medida: 500 })).toBeNull();
    expect(aNuevoItem({ ...nuevoItemFormVacio(), alta: "indusplast", modelo: "spa", medida: 2.5 })).toBeNull();
  });

  it("el stock de una piscina se guarda (0 si se tilda sin número)", () => {
    expect(aNuevoItem({ ...nuevoItemFormVacio(), alta: "indusplast", modelo: "spa", medida: 240, llevaStock: true, stock: null })?.stock).toBe(0);
    expect(aNuevoItem({ ...nuevoItemFormVacio(), alta: "indusplast", modelo: "spa", medida: 240 })?.stock).toBeNull();
  });
});

describe("aNuevoItem · otro ítem sin clave", () => {
  it("la clave sale de la descripción", () => {
    expect(aNuevoItem({ ...nuevoItemFormVacio(), clave: "", descripcion: "Cerco Reforzado Ñandú" })?.clave).toBe("cerco_reforzado_nandu");
  });
  it("sin clave ni descripción, null", () => {
    expect(aNuevoItem({ ...nuevoItemFormVacio(), clave: "", descripcion: "  " })).toBeNull();
  });
});
