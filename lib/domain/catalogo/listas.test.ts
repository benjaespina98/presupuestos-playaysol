import { describe, expect, it } from "vitest";
import { esListaDePrecios, lineaDeClave, medidaDeLista, nombreCortoLista } from "./listas";

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

describe("lineaDeClave", () => {
  it("distingue hormigón de fibra Indusplast por el prefijo", () => {
    expect(lineaDeClave("lista_hormigon_8x4")).toBe("hormigon");
    expect(lineaDeClave("indusplast_spa_240")).toBe("indusplast");
  });

  it("devuelve null para cualquier otro ítem", () => {
    expect(lineaDeClave("luces")).toBeNull();
    expect(lineaDeClave("precioSin")).toBeNull();
  });
});

describe("nombre y medida de una piscina de lista", () => {
  it("fibra: modelo y número", () => {
    expect(nombreCortoLista("indusplast_caribe_550")).toBe("Caribe 550");
    expect(medidaDeLista("indusplast_racionalista_845")).toBe("845");
  });

  it("hormigón: la medida recupera el punto decimal de la clave", () => {
    expect(nombreCortoLista("lista_hormigon_5x3")).toBe("Hormigón 5x3");
    expect(medidaDeLista("lista_hormigon_7x3_50")).toBe("7x3.50");
    expect(medidaDeLista("lista_hormigon_6_5x2.5")).toBe("6.5x2.5");
  });

  it("un ítem que no es de lista no tiene nombre corto", () => {
    expect(nombreCortoLista("luces")).toBeNull();
  });
});
