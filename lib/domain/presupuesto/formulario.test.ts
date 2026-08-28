import { describe, expect, it } from "vitest";
import { crearLinea } from "../precios/tipos";
import { adicionalesDesdeLineas } from "./formulario";

describe("adicionalesDesdeLineas", () => {
  it("sin líneas, no hay adicionales", () => {
    expect(adicionalesDesdeLineas([])).toEqual([]);
  });

  it("sólo toma las líneas 'cotiza' — opcionales/materiales quedan afuera", () => {
    const lineas = [
      crearLinea({
        clave: null,
        descripcion: "Reja extra",
        unidad: null,
        cantidad: 1,
        precioUnitario: 50000,
        naturaleza: "cotiza",
        incluida: true,
        origen: "manual",
      }),
      crearLinea({
        clave: "luces",
        descripcion: "Luces",
        unidad: null,
        cantidad: 1,
        precioUnitario: 240000,
        naturaleza: "informativa",
        incluida: true,
        origen: "catalogo",
      }),
      crearLinea({
        clave: "material_x",
        descripcion: "Material X",
        unidad: "m²",
        cantidad: 1,
        precioUnitario: 100000,
        naturaleza: "alternativa",
        incluida: true,
        origen: "catalogo",
      }),
    ];
    expect(adicionalesDesdeLineas(lineas)).toEqual([{ descripcion: "Reja extra", precio: 50000 }]);
  });

  it("un adicional a cotizar (precio null) sale con precio 0, no null", () => {
    const lineas = [
      crearLinea({
        clave: null,
        descripcion: "A cotizar",
        unidad: null,
        cantidad: 1,
        precioUnitario: null,
        naturaleza: "cotiza",
        incluida: true,
        origen: "manual",
      }),
    ];
    expect(adicionalesDesdeLineas(lineas)).toEqual([{ descripcion: "A cotizar", precio: 0 }]);
  });
});
