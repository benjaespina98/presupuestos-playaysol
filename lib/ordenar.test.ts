import { describe, expect, it } from "vitest";
import { etiquetaCortaDeOrden, opcionesDeOrden, ordenarPor } from "./ordenar";

const datos = [
  { id: "a", nombre: "Bomba", precio: 300 as number | null, stock: 2 as number | null },
  { id: "b", nombre: "árido", precio: null, stock: null },
  { id: "c", nombre: "Cemento", precio: 100, stock: -1 },
  { id: "d", nombre: "Arena", precio: 200, stock: 0 },
];
const v = { nombre: (x: (typeof datos)[number]) => x.nombre, precio: (x: (typeof datos)[number]) => x.precio, stock: (x: (typeof datos)[number]) => x.stock };

describe("ordenarPor", () => {
  it("'defecto' deja el orden como venía (sin tocar la lista original)", () => {
    const r = ordenarPor(datos, "defecto", v);
    expect(r.map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
    expect(r).not.toBe(datos);
  });

  it("por nombre, sin distinguir tildes ni mayúsculas", () => {
    expect(ordenarPor(datos, "nombre-asc", v).map((x) => x.id)).toEqual(["d", "b", "a", "c"]);
    expect(ordenarPor(datos, "nombre-desc", v).map((x) => x.id)).toEqual(["c", "a", "b", "d"]);
  });

  it("por precio: los que no tienen precio van siempre al final", () => {
    expect(ordenarPor(datos, "precio-asc", v).map((x) => x.id)).toEqual(["c", "d", "a", "b"]);
    expect(ordenarPor(datos, "precio-desc", v).map((x) => x.id)).toEqual(["a", "d", "c", "b"]);
  });

  it("por stock: los negativos van primero al subir, los que no llevan stock al final", () => {
    expect(ordenarPor(datos, "stock-asc", v).map((x) => x.id)).toEqual(["c", "d", "a", "b"]);
    expect(ordenarPor(datos, "stock-desc", v).map((x) => x.id)).toEqual(["a", "d", "c", "b"]);
  });

  it("un campo que la pantalla no tiene no cambia nada", () => {
    expect(ordenarPor(datos, "actualizado-asc", v).map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("opciones de orden", () => {
  it("empiezan por el orden actual y siguen con ascendente y descendente de cada campo", () => {
    const o = opcionesDeOrden(["nombre", "precio"]);
    expect(o.map((x) => x.id)).toEqual(["defecto", "nombre-asc", "nombre-desc", "precio-asc", "precio-desc"]);
    expect(etiquetaCortaDeOrden("precio-desc")).toBe("Precio ↓");
    expect(etiquetaCortaDeOrden("defecto")).toBe("Orden");
  });
});
