import { describe, expect, it } from "vitest";
import { sinTituloRepetido } from "./nombre";

describe("sinTituloRepetido", () => {
  it("saca el título repetido al comienzo, con cualquier separador", () => {
    expect(sinTituloRepetido("Revestimientos - Cerámico Simil Piedra Bali", "Revestimientos")).toBe("Cerámico Simil Piedra Bali");
    expect(sinTituloRepetido("Revestimientos: Venecitas Premium", "Revestimientos")).toBe("Venecitas Premium");
    expect(sinTituloRepetido("REVESTIMIENTOS · Venecitas", "Revestimientos")).toBe("Venecitas");
    expect(sinTituloRepetido("Revestimiento - Venecitas", "Revestimientos")).toBe("Venecitas");
  });

  it("no toca lo que no empieza con el título, ni lo deja vacío", () => {
    expect(sinTituloRepetido("Cerámico para revestimientos", "Revestimientos")).toBe("Cerámico para revestimientos");
    expect(sinTituloRepetido("Revestimientos", "Revestimientos")).toBe("Revestimientos");
    expect(sinTituloRepetido("Cerco perimetral", "Cercos")).toBe("Cerco perimetral");
    expect(sinTituloRepetido("Hormigón 5x3", "Revestimientos", null)).toBe("Hormigón 5x3");
  });
});
