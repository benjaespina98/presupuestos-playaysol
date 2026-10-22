import { describe, expect, it } from "vitest";
import { armarNombreArchivo } from "./nombreArchivo";

/** Mismos casos que probarían contra `public/nombre-archivo.js` — es un
 *  port 1:1, así que el contrato (el nombre del archivo que baja el
 *  navegador) tiene que ser idéntico carácter por carácter. */
describe("armarNombreArchivo", () => {
  it("arma Presupuesto_<Tipo>_<Cliente>_<Fecha> normalizando la fecha DD/MM/YYYY", () => {
    expect(armarNombreArchivo("Cerco", "Pérez, María José", "20/08/2026")).toBe(
      "Presupuesto_Cerco_Perez_Maria_Jose_2026-08-20"
    );
  });

  it("sin cliente, usa 'Sin_nombre'", () => {
    expect(armarNombreArchivo("Cerco", "", "20/08/2026")).toBe(
      "Presupuesto_Cerco_Sin_nombre_2026-08-20"
    );
  });

  it("sin fecha, usa la fecha de hoy en formato ISO", () => {
    const nombre = armarNombreArchivo("Cerco", "Gómez", "");
    expect(nombre).toMatch(/^Presupuesto_Cerco_Gomez_\d{4}-\d{2}-\d{2}$/);
  });

  it("saca caracteres inválidos para nombre de archivo", () => {
    expect(armarNombreArchivo("Cerco", 'Juan "el Grande" <Pérez>', "20/08/2026")).toBe(
      "Presupuesto_Cerco_Juan_el_Grande_Perez_2026-08-20"
    );
  });

  it("saca los caracteres de control y de formato", () => {
    // nulo, escape, borrar (DEL), espacio de ancho cero y marca de orden de bytes
    expect(armarNombreArchivo("Cerco", "Ju\u0000an\u001B\u007F​﻿", "20/08/2026")).toBe(
      "Presupuesto_Cerco_Juan_2026-08-20"
    );
  });

  it("saca el RTL override que invierte cómo se ve la extensión", () => {
    expect(armarNombreArchivo("Cerco", "Pepe‮gpj.exe", "20/08/2026")).toBe(
      "Presupuesto_Cerco_Pepegpj.exe_2026-08-20"
    );
  });

  it("tabs y saltos de línea siguen siendo un guion bajo, no se pegan las palabras", () => {
    expect(armarNombreArchivo("Cerco", "Juan\tPérez\nGómez", "20/08/2026")).toBe(
      "Presupuesto_Cerco_Juan_Perez_Gomez_2026-08-20"
    );
  });

  it("un cliente hecho sólo de caracteres de control termina en 'Sin_nombre'", () => {
    expect(armarNombreArchivo("Cerco", "\u0000​", "20/08/2026")).toBe(
      "Presupuesto_Cerco_Sin_nombre_2026-08-20"
    );
  });

  it("un cliente larguísimo se recorta: el nombre total nunca pasa de un largo seguro", () => {
    const nombre = armarNombreArchivo("Piscina", "Rodríguez de la Fuente ".repeat(40), "20/08/2026");
    expect(nombre.length).toBeLessThanOrEqual(120);
    expect(nombre).toMatch(/^Presupuesto_Piscina_Rodriguez_de_la_Fuente/);
    expect(nombre).toMatch(/_2026-08-20$/);
    expect(nombre).not.toMatch(/__/);
  });

  it("nunca produce caracteres que Windows no acepta, ni nombres reservados, ni termina en punto o espacio", () => {
    for (const cliente of ['CON', 'NUL.txt', 'a:b*c?d"e<f>g|h\i/j', "punto.", "espacio ", "..", "COM1", "  "]) {
      const nombre = armarNombreArchivo("Cerco", cliente, "01/02/2026");
      expect(nombre).not.toMatch(/[\/:*?"<>|]/);
      expect(nombre).not.toMatch(/[. ]$/);
      // Siempre empieza con "Presupuesto_", así que ningún nombre coincide con CON, PRN, AUX, NUL, COM1...
      expect(nombre.startsWith("Presupuesto_")).toBe(true);
    }
  });

  it("sin acentos ni eñes sueltas: ñ pasa a n (el nombre queda en ASCII)", () => {
    expect(armarNombreArchivo("Cerco", "Peña Ñandú", "20/08/2026")).toBe("Presupuesto_Cerco_Pena_Nandu_2026-08-20");
  });
});
