import { describe, expect, it } from "vitest";
import { esListaDePrecios } from "./listas";

describe("esListaDePrecios", () => {
  it("reconoce piscinas de hormigón por tamaño y modelos Indusplast", () => {
    expect(esListaDePrecios("lista_hormigon_8x4")).toBe(true);
    expect(esListaDePrecios("indusplast_racionalista_400")).toBe(true);
  });

  it("no confunde un opcional común con una lista", () => {
    expect(esListaDePrecios("luces")).toBe(false);
    expect(esListaDePrecios("cascada")).toBe(false);
    expect(esListaDePrecios("revestimiento_ceramico_bali")).toBe(false);
  });
});
