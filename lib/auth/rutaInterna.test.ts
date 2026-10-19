import { describe, expect, it } from "vitest";
import { RUTA_POR_DEFECTO, rutaInternaSegura } from "./rutaInterna";

describe("rutaInternaSegura", () => {
  it.each([
    "/dashboard",
    "/dashboard/historial",
    "/dashboard/catalogo?categoria=Piscinas",
    "/dashboard/historial?usuario=abc#fila-3",
    "/",
  ])("deja pasar la ruta interna %s", (ruta) => {
    expect(rutaInternaSegura(ruta)).toBe(ruta);
  });

  it.each([
    ["URL absoluta https", "https://x.com"],
    ["URL absoluta http", "http://x.com/dashboard"],
    ["protocolo relativo", "//x.com"],
    ["protocolo relativo con ruta", "//x.com/dashboard"],
    ["barra y contrabarra", "/\\x.com"],
    ["contrabarra al inicio", "\\x.com"],
    ["contrabarra en el medio", "/dashboard\\..\\x.com"],
    ["javascript:", "javascript:alert(1)"],
    ["javascript: en mayúsculas", "JaVaScRiPt:alert(1)"],
    ["data:", "data:text/html,<script>alert(1)</script>"],
    ["sin barra inicial", "dashboard"],
    ["host sin esquema", "x.com/dashboard"],
    ["tabulador entre barras", "/\t/x.com"],
    ["salto de línea entre barras", "/\n/x.com"],
    ["retorno de carro entre barras", "/\r/x.com"],
    ["espacio entre barras", "/ /x.com"],
    ["carácter nulo", "/dashboard\u0000"],
    ["// codificado", "/%2F/x.com"],
    ["// codificado en minúscula", "/%2f/x.com"],
    ["contrabarra codificada", "/%5Cx.com"],
    ["tabulador codificado", "/%09/x.com"],
    ["codificación inválida", "/%E0%A4%A"],
    ["URL completa codificada", "https%3A%2F%2Fx.com"],
    ["vacío", ""],
  ])("rechaza %s", (_nombre, ruta) => {
    expect(rutaInternaSegura(ruta)).toBe(RUTA_POR_DEFECTO);
  });

  it("rechaza null y undefined", () => {
    expect(rutaInternaSegura(null)).toBe(RUTA_POR_DEFECTO);
    expect(rutaInternaSegura(undefined)).toBe(RUTA_POR_DEFECTO);
  });

  it("rechaza lo que no es un string", () => {
    expect(rutaInternaSegura(42 as unknown as string)).toBe(RUTA_POR_DEFECTO);
  });
});
