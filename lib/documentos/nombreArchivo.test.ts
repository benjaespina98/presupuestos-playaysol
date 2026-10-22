import { describe, expect, it } from "vitest";
import { armarNombreArchivo } from "./nombreArchivo";

/** Convención: "<Cliente> - <Tipo> - DD-MM-AAAA". El cliente es texto libre: se usa tal como se cargó. */
describe("armarNombreArchivo", () => {
  it("arma '<Cliente> - <Tipo> - DD-MM-AAAA' con el cliente tal como se cargó (tildes y coma incluidas, sin reordenar)", () => {
    expect(armarNombreArchivo("Cerco", "Pérez, María José", "20/08/2026")).toBe("Pérez, María José - Cerco - 20-08-2026");
    // No adivina apellido y nombre: "María Pérez" queda como se escribió.
    expect(armarNombreArchivo("Piscina", "María Pérez", "05/10/2026")).toBe("María Pérez - Piscina - 05-10-2026");
  });

  it("completa con ceros el día y el mes", () => {
    expect(armarNombreArchivo("Cerco", "Gómez", "5/3/2026")).toBe("Gómez - Cerco - 05-03-2026");
  });

  it("sin cliente, usa 'Sin nombre'", () => {
    expect(armarNombreArchivo("Cerco", "", "20/08/2026")).toBe("Sin nombre - Cerco - 20-08-2026");
    expect(armarNombreArchivo("Cerco", "   ", "20/08/2026")).toBe("Sin nombre - Cerco - 20-08-2026");
  });

  it("sin fecha, usa la de hoy en formato DD-MM-AAAA", () => {
    expect(armarNombreArchivo("Cerco", "Gómez", "")).toMatch(/^Gómez - Cerco - \d{2}-\d{2}-\d{4}$/);
  });

  it("saca los caracteres que Windows no acepta, sin tocar el resto", () => {
    expect(armarNombreArchivo("Cerco", 'Juan "el Grande" <Pérez>', "20/08/2026")).toBe("Juan el Grande Pérez - Cerco - 20-08-2026");
    expect(armarNombreArchivo("Cerco", "a:b*c?d|e/f\\g", "20/08/2026")).toBe("abcdefg - Cerco - 20-08-2026");
  });

  it("saca los caracteres de control y de formato", () => {
    // nulo, escape, borrar (DEL), espacio de ancho cero y marca de orden de bytes
    expect(armarNombreArchivo("Cerco", "Ju\u0000an\u001B\u007F​﻿", "20/08/2026")).toBe("Juan - Cerco - 20-08-2026");
  });

  it("saca el RTL override que invierte cómo se ve la extensión", () => {
    expect(armarNombreArchivo("Cerco", "Pepe‮gpj.exe", "20/08/2026")).toBe("Pepegpj.exe - Cerco - 20-08-2026");
  });

  it("tabs y saltos de línea son un espacio: no se pegan las palabras", () => {
    expect(armarNombreArchivo("Cerco", "Juan\tPérez\nGómez", "20/08/2026")).toBe("Juan Pérez Gómez - Cerco - 20-08-2026");
  });

  it("un cliente hecho sólo de caracteres de control termina en 'Sin nombre'", () => {
    expect(armarNombreArchivo("Cerco", "\u0000​", "20/08/2026")).toBe("Sin nombre - Cerco - 20-08-2026");
  });

  it("un cliente larguísimo se recorta a 80 caracteres, sin dejar puntos, comas ni espacios colgados", () => {
    const nombre = armarNombreArchivo("Piscina", "Rodríguez de la Fuente, ".repeat(40), "20/08/2026");
    const cliente = nombre.replace(" - Piscina - 20-08-2026", "");
    expect(cliente.length).toBeLessThanOrEqual(80);
    expect(cliente).toMatch(/^Rodríguez de la Fuente/);
    expect(cliente).not.toMatch(/[\s.,]$/);
    expect(nombre).toMatch(/ - Piscina - 20-08-2026$/);
  });

  it("nunca produce caracteres que Windows no acepta ni un cliente que termine en punto o espacio", () => {
    for (const cliente of ["CON", "NUL.txt", 'a:b*c?d"e<f>g|h\\i/j', "punto.", "espacio ", "..", "COM1", "  "]) {
      const nombre = armarNombreArchivo("Cerco", cliente, "01/02/2026");
      expect(nombre).not.toMatch(/[\\/:*?"<>|]/);
      expect(nombre).not.toMatch(/[. ]$/);
      // Con el " - Tipo - fecha" detrás, ningún nombre coincide con un dispositivo reservado (CON, PRN, AUX, NUL, COM1...).
      expect(nombre).toMatch(/ - Cerco - 01-02-2026$/);
      expect(nombre.replace(/ - Cerco - 01-02-2026$/, "")).not.toMatch(/[. ]$/);
    }
  });

  it("el plano de la piscina usa su propio tipo", () => {
    expect(armarNombreArchivo("Plano de piscina", "Gómez, Martín", "")).toMatch(/^Gómez, Martín - Plano de piscina - \d{2}-\d{2}-\d{4}$/);
  });
});
