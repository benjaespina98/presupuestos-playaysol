import { describe, expect, it } from "vitest";
import { CATEGORIAS } from "./categorias";
import {
  agruparPorCategoria,
  categoriaEfectiva,
  filtrarCatalogo,
  ItemCatalogo,
  ordenarCatalogo,
  textoParaCopiar,
  type FiltroCatalogo,
} from "./item";

function item(overrides: Partial<ItemCatalogo>): ItemCatalogo {
  return ItemCatalogo.parse({
    id: overrides.id ?? "id-1",
    tipo: "piscinas",
    clave: "clave",
    descripcion: "Un ítem",
    precio: 1000,
    categoria: null,
    unidad: null,
    activo: true,
    orden: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  });
}

describe("ItemCatalogo · schema", () => {
  it("acepta precio null como 'a cotizar', distinto de 0", () => {
    const aCotizar = item({ precio: null });
    const cero = item({ precio: 0 });
    expect(aCotizar.precio).toBeNull();
    expect(cero.precio).toBe(0);
  });

  it("rechaza una categoría que no es una de las 9", () => {
    expect(() => item({ categoria: "Climatización" as never })).toThrow();
  });

  it("acepta categoria null (sin clasificar)", () => {
    expect(item({ categoria: null }).categoria).toBeNull();
  });
});

describe("categoriaEfectiva", () => {
  it("una categoría sin clasificar cae en Otros", () => {
    expect(categoriaEfectiva({ categoria: null })).toBe("Otros");
  });

  it("una categoría asignada se respeta", () => {
    expect(categoriaEfectiva({ categoria: "Piscinas" })).toBe("Piscinas");
  });
});

describe("ordenarCatalogo", () => {
  it("agrupa por categoría en el orden acordado de Fase 2", () => {
    const items = [
      item({ id: "a", categoria: "Otros" }),
      item({ id: "b", categoria: "Piscinas" }),
      item({ id: "c", categoria: "Cercos" }),
    ];
    const ordenado = ordenarCatalogo(items).map((i) => i.id);
    // Piscinas (0) < Cercos (5) < Otros (8)
    expect(ordenado).toEqual(["b", "c", "a"]);
  });

  it("dentro de la misma categoría, por `orden` manual y los null al final", () => {
    const items = [
      item({ id: "sin-orden", categoria: "Piscinas", orden: null, descripcion: "Z" }),
      item({ id: "segundo", categoria: "Piscinas", orden: 2 }),
      item({ id: "primero", categoria: "Piscinas", orden: 1 }),
    ];
    const ordenado = ordenarCatalogo(items).map((i) => i.id);
    expect(ordenado).toEqual(["primero", "segundo", "sin-orden"]);
  });

  it("sin `orden`, cae a alfabético por descripción", () => {
    const items = [
      item({ id: "b", categoria: "Piscinas", descripcion: "Bomba" }),
      item({ id: "a", categoria: "Piscinas", descripcion: "Alarma" }),
    ];
    expect(ordenarCatalogo(items).map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("no muta el array original", () => {
    const items = [item({ id: "a" })];
    const copia = [...items];
    ordenarCatalogo(items);
    expect(items).toEqual(copia);
  });

  it("cubre las 9 categorías sin excepciones", () => {
    const items = CATEGORIAS.map((c, i) => item({ id: String(i), categoria: c }));
    const barajado = [...items].reverse();
    expect(ordenarCatalogo(barajado).map((i) => i.categoria)).toEqual([...CATEGORIAS]);
  });
});

describe("filtrarCatalogo", () => {
  const items = [
    item({ id: "activo-piscinas", categoria: "Piscinas", activo: true, descripcion: "Luces LED", clave: "luces" }),
    item({ id: "inactivo-piscinas", categoria: "Piscinas", activo: false, descripcion: "Descontinuado" }),
    item({ id: "activo-cercos", categoria: "Cercos", activo: true, descripcion: "Portón reforzado" }),
  ];

  it("por default deja afuera los inactivos", () => {
    const resultado = filtrarCatalogo(items, {});
    expect(resultado.map((i) => i.id)).toEqual(["activo-piscinas", "activo-cercos"]);
  });

  it("incluirInactivos:true los trae de vuelta", () => {
    const resultado = filtrarCatalogo(items, { incluirInactivos: true });
    expect(resultado).toHaveLength(3);
  });

  it("filtra por categoría", () => {
    const resultado = filtrarCatalogo(items, { categoria: "Cercos", incluirInactivos: true });
    expect(resultado.map((i) => i.id)).toEqual(["activo-cercos"]);
  });

  it("busca en la descripción, sin importar mayúsculas", () => {
    const resultado = filtrarCatalogo(items, { busqueda: "led" });
    expect(resultado.map((i) => i.id)).toEqual(["activo-piscinas"]);
  });

  it("busca también en la clave, para ítems sin descripción legible", () => {
    const resultado = filtrarCatalogo(items, { busqueda: "luces" });
    expect(resultado.map((i) => i.id)).toEqual(["activo-piscinas"]);
  });

  it("combina búsqueda + categoría + inactivos en un solo paso", () => {
    const filtro: FiltroCatalogo = { categoria: "Piscinas", busqueda: "descontinuado", incluirInactivos: true };
    expect(filtrarCatalogo(items, filtro).map((i) => i.id)).toEqual(["inactivo-piscinas"]);
  });
});

const $ = (n: number) => `$${n.toLocaleString("es-AR")}`;

describe("agruparPorCategoria", () => {
  it("agrupa bloques consecutivos de la misma categoría, en el orden en que vienen", () => {
    const lista = [
      item({ id: "1", categoria: "Cercos" }),
      item({ id: "2", categoria: "Cercos" }),
      item({ id: "3", categoria: "Piscinas" }),
    ];
    const grupos = agruparPorCategoria(lista);
    expect(grupos).toEqual([
      { categoria: "Cercos", items: [lista[0], lista[1]] },
      { categoria: "Piscinas", items: [lista[2]] },
    ]);
  });

  it("un ítem sin categoría cae en la categoría por defecto (Otros)", () => {
    const grupos = agruparPorCategoria([item({ id: "1", categoria: null })]);
    expect(grupos).toEqual([{ categoria: "Otros", items: expect.any(Array) }]);
  });

  it("lista vacía da grupos vacíos", () => {
    expect(agruparPorCategoria([])).toEqual([]);
  });

  it("combinado con ordenarCatalogo: agrupa TODOS los ítems de una categoría en un solo bloque, aunque no vinieran contiguos", () => {
    const lista = [
      item({ id: "1", categoria: "Piscinas", descripcion: "B" }),
      item({ id: "2", categoria: "Cercos", descripcion: "A" }),
      item({ id: "3", categoria: "Piscinas", descripcion: "A" }),
    ];
    const grupos = agruparPorCategoria(ordenarCatalogo(lista));
    expect(grupos.map((g) => g.categoria)).toEqual(["Piscinas", "Cercos"]);
    expect(grupos[0].items.map((i) => i.id)).toEqual(["3", "1"]); // "A" antes que "B"
  });
});

describe("textoParaCopiar", () => {
  it("nombre: precio/unidad, listo para pegar en WhatsApp", () => {
    const i = item({ descripcion: "Cerco perimetral con instalación", precio: 79500, unidad: "ml" });
    expect(textoParaCopiar(i, $)).toBe("Cerco perimetral con instalación: $79.500/ml");
  });

  it("sin unidad, no agrega la barra", () => {
    const i = item({ descripcion: "Kit de limpieza", precio: 45000, unidad: null });
    expect(textoParaCopiar(i, $)).toBe("Kit de limpieza: $45.000");
  });

  it("precio null: 'a cotizar'", () => {
    const i = item({ descripcion: "Baño químico", precio: null, unidad: null });
    expect(textoParaCopiar(i, $)).toBe("Baño químico: a cotizar");
  });

  it("sin descripción, usa la clave", () => {
    const i = item({ descripcion: null, clave: "luces", precio: 240000, unidad: null });
    expect(textoParaCopiar(i, $)).toBe("luces: $240.000");
  });
});
