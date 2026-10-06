import { describe, expect, it } from "vitest";
import type { ItemCatalogo } from "@/lib/domain/catalogo/item";
import { aCambios, aFormulario, EditarItemSchema } from "./editar-item.schema";

function item(overrides: Partial<ItemCatalogo>): ItemCatalogo {
  return {
    id: "id",
    tipo: "piscinas",
    clave: "clave",
    descripcion: "Un ítem",
    precio: 1000,
    categoria: null,
    unidad: null,
    activo: true,
    orden: null,
    stock: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("aFormulario", () => {
  it("una categoría/unidad sin clasificar se ve como '' en el form", () => {
    const form = aFormulario(item({ categoria: null, unidad: null }));
    expect(form.categoria).toBe("");
    expect(form.unidad).toBe("");
  });

  it("una unidad legacy fuera del enum cae a '' en vez de romper el <select>", () => {
    const form = aFormulario(item({ unidad: "kg" }));
    expect(form.unidad).toBe("");
  });

  it("precio null (a cotizar) se mantiene null, no se convierte en 0", () => {
    expect(aFormulario(item({ precio: null })).precio).toBeNull();
  });

  it("precio 0 se mantiene 0, no se confunde con 'a cotizar'", () => {
    expect(aFormulario(item({ precio: 0 })).precio).toBe(0);
  });

  it("descripcion null se ve como '' editable", () => {
    expect(aFormulario(item({ descripcion: null })).descripcion).toBe("");
  });
});

describe("aCambios", () => {
  it("'' vuelve a ser null para categoría y unidad", () => {
    const cambios = aCambios({ descripcion: "x", precio: 1, categoria: "", unidad: "", activo: true, llevaStock: false, stock: null });
    expect(cambios.categoria).toBeNull();
    expect(cambios.unidad).toBeNull();
  });

  it("precio null se preserva como 'a cotizar', no se convierte en 0", () => {
    const cambios = aCambios({ descripcion: "x", precio: null, categoria: "", unidad: "", activo: true, llevaStock: false, stock: null });
    expect(cambios.precio).toBeNull();
  });

  it("precio 0 se preserva como 0, no como null", () => {
    const cambios = aCambios({ descripcion: "x", precio: 0, categoria: "", unidad: "", activo: true, llevaStock: false, stock: null });
    expect(cambios.precio).toBe(0);
  });

  it("una descripción sólo con espacios se guarda como null", () => {
    const cambios = aCambios({ descripcion: "   ", precio: 1, categoria: "", unidad: "", activo: true, llevaStock: false, stock: null });
    expect(cambios.descripcion).toBeNull();
  });

  it("ida y vuelta: aCambios(aFormulario(item)) reproduce los mismos valores editables", () => {
    const original = item({ categoria: "Piscinas", unidad: "m²", precio: 1500, activo: false });
    const cambios = aCambios(aFormulario(original));
    expect(cambios).toEqual({
      descripcion: original.descripcion,
      precio: original.precio,
      categoria: original.categoria,
      unidad: original.unidad,
      activo: original.activo,
      stock: null,
    });
  });
});

describe("EditarItemSchema", () => {
  it("acepta categoria/unidad vacías ('sin elegir')", () => {
    const r = EditarItemSchema.safeParse({
      descripcion: "x",
      precio: null,
      categoria: "",
      unidad: "",
      activo: true,
      llevaStock: false,
      stock: null,
    });
    expect(r.success).toBe(true);
  });

  it("rechaza una categoría que no es una de las 9 ni ''", () => {
    const r = EditarItemSchema.safeParse({
      descripcion: "x",
      precio: null,
      categoria: "Climatización",
      unidad: "",
      activo: true,
      llevaStock: false,
      stock: null,
    });
    expect(r.success).toBe(false);
  });

  it("rechaza un precio negativo", () => {
    const r = EditarItemSchema.safeParse({
      descripcion: "x",
      precio: -100,
      categoria: "",
      unidad: "",
      activo: true,
      llevaStock: false,
      stock: null,
    });
    expect(r.success).toBe(false);
  });

  it("precio null (a cotizar) y 0 siguen siendo válidos", () => {
    for (const precio of [null, 0]) {
      const r = EditarItemSchema.safeParse({
        descripcion: "x",
        precio,
        categoria: "",
        unidad: "",
        activo: true,
      llevaStock: false,
      stock: null,
      });
      expect(r.success).toBe(true);
    }
  });
});

describe("stock en el formulario", () => {
  const base = { descripcion: "x", precio: 1, categoria: "" as const, unidad: "" as const, activo: true };

  it("sin tildar 'Llevar stock' el ítem no lleva stock (null), aunque quede un número", () => {
    expect(aCambios({ ...base, llevaStock: false, stock: 5 }).stock).toBeNull();
  });

  it("tildado, guarda la cantidad; sin cantidad arranca en 0 (no null)", () => {
    expect(aCambios({ ...base, llevaStock: true, stock: 4 }).stock).toBe(4);
    expect(aCambios({ ...base, llevaStock: true, stock: null }).stock).toBe(0);
  });

  it("el formulario distingue 'sin stock' (null) de 'agotado' (0)", () => {
    expect(aFormulario(item({ stock: null }))).toMatchObject({ llevaStock: false, stock: null });
    expect(aFormulario(item({ stock: 0 }))).toMatchObject({ llevaStock: true, stock: 0 });
  });

  it("rechaza stock negativo o con decimales", () => {
    const f = { ...base, llevaStock: true };
    expect(EditarItemSchema.safeParse({ ...f, stock: -1 }).success).toBe(false);
    expect(EditarItemSchema.safeParse({ ...f, stock: 1.5 }).success).toBe(false);
    expect(EditarItemSchema.safeParse({ ...f, stock: 2 }).success).toBe(true);
  });
});
