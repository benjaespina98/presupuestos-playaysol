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
});
