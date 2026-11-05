import { describe, expect, it } from "vitest";
import type { ItemCatalogo } from "@/lib/domain/catalogo/item";
import type { Material } from "@/lib/domain/abastecimiento/material";
import type { Proveedor } from "@/lib/domain/abastecimiento/proveedor";
import { buscarEnTodo, nombreDeItem, type FuentesBusqueda } from "./general";

const item = (o: Partial<ItemCatalogo>): ItemCatalogo =>
  ({
    id: "i1",
    tipo: "piscinas",
    clave: "solarium",
    descripcion: "Solárium seco",
    precio: 1000,
    unidad: "m²",
    categoria: null,
    activo: true,
    stock: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    ...o,
  }) as ItemCatalogo;

const proveedor = (o: Partial<Proveedor>): Proveedor => ({
  id: "p1",
  nombre: "Corralón Norte",
  rubro: null,
  contacto: null,
  telefono: null,
  forma_pago: null,
  plazo: null,
  notas: null,
  activo: true,
  orden: 1,
  updated_at: "2026-01-01T00:00:00.000Z",
  ...o,
});

const material = (o: Partial<Material>): Material => ({
  id: "m1",
  nombre: "Ladrillo común",
  proveedor_id: "p1",
  unidad: "unidad",
  precio: 100,
  precio_actualizado: null,
  rubro: "Materiales",
  aplica: null,
  usd_ref: null,
  notas: null,
  cantidades: {},
  activo: true,
  orden: 1,
  updated_at: "2026-01-01T00:00:00.000Z",
  ...o,
});

const fuentes = (o: Partial<FuentesBusqueda> = {}): FuentesBusqueda => ({
  items: [item({})],
  materiales: [material({})],
  proveedores: [proveedor({})],
  presupuestos: [{ id: "b1", tipo: "piscinas", cliente_nombre: "Familia García", created_at: "2026-01-01T00:00:00.000Z" }],
  ...o,
});

describe("buscarEnTodo", () => {
  it("con menos de dos letras no busca", () => {
    expect(buscarEnTodo(fuentes(), "").total).toBe(0);
    expect(buscarEnTodo(fuentes(), " s ").total).toBe(0);
  });

  it("encuentra cada cosa en su grupo, sin importar tildes", () => {
    expect(buscarEnTodo(fuentes(), "solarium").items).toHaveLength(1);
    expect(buscarEnTodo(fuentes(), "ladrillo comun").materiales).toHaveLength(1);
    expect(buscarEnTodo(fuentes(), "garcia").presupuestos).toHaveLength(1);
  });

  it("buscar a un proveedor muestra también lo que se le compra", () => {
    const r = buscarEnTodo(fuentes(), "corralon");
    expect(r.proveedores).toHaveLength(1);
    expect(r.materiales).toHaveLength(1);
    expect(r.total).toBe(2);
  });

  it("lo desactivado no aparece", () => {
    const f = fuentes({
      items: [item({ activo: false })],
      materiales: [material({ activo: false })],
      proveedores: [proveedor({ activo: false })],
    });
    expect(buscarEnTodo(f, "solarium").total).toBe(0);
    expect(buscarEnTodo(f, "ladrillo").total).toBe(0);
    expect(buscarEnTodo(f, "corralon").total).toBe(0);
  });

  it("sin coincidencias, todo vacío", () => {
    expect(buscarEnTodo(fuentes(), "zzz").total).toBe(0);
  });
});

describe("nombreDeItem", () => {
  it("usa la descripción y, si no hay, la clave", () => {
    expect(nombreDeItem({ clave: "x", descripcion: "Algo" })).toBe("Algo");
    expect(nombreDeItem({ clave: "x", descripcion: "" })).toBe("x");
  });
});
