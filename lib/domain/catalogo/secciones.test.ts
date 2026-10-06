import { describe, expect, it } from "vitest";
import { ETIQUETA_SECCION, SECCIONES, seccionDeItem } from "./secciones";
import { contarPorSeccion, filtrarCatalogo, ItemCatalogo } from "./item";

const it0 = (o: Partial<ItemCatalogo>) =>
  ItemCatalogo.parse({
    id: o.id ?? o.clave ?? "x", tipo: "piscinas", clave: "clave", descripcion: null, precio: 1, categoria: null, unidad: null,
    activo: true, orden: null, updated_at: "2026-01-01T00:00:00.000Z", ...o,
  });

describe("seccionDeItem", () => {
  it("las piscinas completas por su prefijo", () => {
    expect(seccionDeItem(it0({ clave: "lista_hormigon_8x4" }))).toBe("hormigon");
    expect(seccionDeItem(it0({ clave: "indusplast_caribe_550" }))).toBe("indusplast");
  });

  it("cobertores, cercos, climatización y revestimientos, por calculadora, clave o categoría", () => {
    expect(seccionDeItem(it0({ tipo: "cobertores", clave: "precioMenos15" }))).toBe("cobertores");
    expect(seccionDeItem(it0({ tipo: "cercos", clave: "precioCon" }))).toBe("cercos");
    expect(seccionDeItem(it0({ clave: "cerco_perimetral" }))).toBe("cercos"); // vive en piscinas, pero es un cerco
    expect(seccionDeItem(it0({ clave: "climatizacion25000" }))).toBe("climatizacion");
    expect(seccionDeItem(it0({ clave: "x", descripcion: "Climatización bomba de calor" }))).toBe("climatizacion");
    expect(seccionDeItem(it0({ tipo: "revestimientos", clave: "solar_seco_deck" }))).toBe("revestimientos");
    expect(seccionDeItem(it0({ clave: "travertino_pulido_interior" }))).toBe("revestimientos");
    expect(seccionDeItem(it0({ clave: "revestimiento_ceramico_bali" }))).toBe("revestimientos");
  });

  it("todo lo demás es 'Otros', y hay una etiqueta para cada sección", () => {
    expect(seccionDeItem(it0({ clave: "luces" }))).toBe("otros");
    expect(seccionDeItem(it0({ clave: "kit_limpieza" }))).toBe("otros");
    for (const s of SECCIONES) expect(ETIQUETA_SECCION[s.id]).toBe(s.etiqueta);
  });
});

describe("filtrar y contar por sección", () => {
  const items = [
    it0({ id: "a", clave: "lista_hormigon_8x4" }),
    it0({ id: "b", clave: "indusplast_spa_240" }),
    it0({ id: "c", tipo: "cercos", clave: "precioCon" }),
    it0({ id: "d", clave: "luces" }),
  ];
  it("filtra por sección", () => {
    expect(filtrarCatalogo(items, { seccion: "cercos" }).map((i) => i.id)).toEqual(["c"]);
    expect(filtrarCatalogo(items, { seccion: "otros" }).map((i) => i.id)).toEqual(["d"]);
  });
  it("cuenta con el resto de los filtros e ignorando el de sección", () => {
    expect(contarPorSeccion(items, {})).toEqual({ total: 4, porSeccion: { hormigon: 1, indusplast: 1, cercos: 1, otros: 1 } });
    expect(contarPorSeccion(items, { busqueda: "spa", seccion: "cercos" } as never).total).toBe(1);
  });
});
