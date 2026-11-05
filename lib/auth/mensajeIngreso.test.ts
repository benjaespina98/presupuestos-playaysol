import { describe, expect, it } from "vitest";
import { mensajeDeIngreso } from "./mensajeIngreso";

describe("mensajeDeIngreso", () => {
  it.each(["", "   ", "{}", "[]", "{ }", null, undefined])("un mensaje vacío (%j) avisa que no hubo conexión", (m) => {
    expect(mensajeDeIngreso(m)).toBe("No se pudo conectar con el servidor. Probá de nuevo en un momento.");
  });

  it("traduce los casos comunes", () => {
    expect(mensajeDeIngreso("Invalid login credentials")).toMatch(/no son correctos/);
    expect(mensajeDeIngreso("Email not confirmed")).toMatch(/no fue confirmado/);
    expect(mensajeDeIngreso("Too many requests")).toMatch(/Demasiados intentos/);
    expect(mensajeDeIngreso("Failed to fetch")).toMatch(/No se pudo conectar\. Revisá/);
  });

  it("lo que no reconoce se muestra tal cual", () => {
    expect(mensajeDeIngreso("Algo raro pasó")).toBe("Algo raro pasó");
  });
});
