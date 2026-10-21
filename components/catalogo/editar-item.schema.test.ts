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
    const cambios = aCambios({ descripcion: "x", precio: 1, categoria: "", unidad: "", activo: true, llevaStock: false });
    expect(cambios.categoria).toBeNull();
    expect(cambios.unidad).toBeNull();
  });

  it("precio null se preserva como 'a cotizar', no se convierte en 0", () => {
    const cambios = aCambios({ descripcion: "x", precio: null, categoria: "", unidad: "", activo: true, llevaStock: false });
    expect(cambios.precio).toBeNull();
  });

  it("precio 0 se preserva como 0, no como null", () => {
    const cambios = aCambios({ descripcion: "x", precio: 0, categoria: "", unidad: "", activo: true, llevaStock: false });
    expect(cambios.precio).toBe(0);
  });

  it("una descripción sólo con espacios se guarda como null", () => {
    const cambios = aCambios({ descripcion: "   ", precio: 1, categoria: "", unidad: "", activo: true, llevaStock: false });
    expect(cambios.descripcion).toBeNull();
  });

  it("ida y vuelta: aCambios(aFormulario(item)) reproduce los mismos valores editables", () => {
    const original = item({ categoria: "Piscinas", unidad: "m²", precio: 1500, activo: false });
    const cambios = aCambios(aFormulario(original), original.stock);
    expect(cambios).toEqual({
      descripcion: original.descripcion,
      precio: original.precio,
      categoria: original.categoria,
      unidad: original.unidad,
      activo: original.activo,
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

  it("las unidades NO se mandan: sin cambiar 'Llevar stock' no viaja ningún stock (no pisa un movimiento ajeno)", () => {
    expect(aCambios({ ...base, llevaStock: true }, 7)).not.toHaveProperty("stock");
    expect(aCambios({ ...base, llevaStock: true }, 0)).not.toHaveProperty("stock");
    expect(aCambios({ ...base, llevaStock: false }, null)).not.toHaveProperty("stock");
    expect(aCambios({ ...base, llevaStock: true })).toHaveProperty("stock", 0); // sin dato previo = ítem que no llevaba
  });

  it("tildar 'Llevar stock' en un ítem que no lo llevaba lo arranca en 0", () => {
    expect(aCambios({ ...base, llevaStock: true }, null).stock).toBe(0);
  });

  it("destildarlo en un ítem que lo llevaba manda null (la base lo acepta sólo si está en 0)", () => {
    expect(aCambios({ ...base, llevaStock: false }, 0).stock).toBeNull();
    expect(aCambios({ ...base, llevaStock: false }, 4).stock).toBeNull();
  });

  it("el formulario distingue 'sin stock' (null) de 'agotado' (0) y de negativo", () => {
    expect(aFormulario(item({ stock: null }))).toMatchObject({ llevaStock: false });
    expect(aFormulario(item({ stock: 0 }))).toMatchObject({ llevaStock: true });
    expect(aFormulario(item({ stock: -3 }))).toMatchObject({ llevaStock: true });
  });

  it("el formulario ya no tiene un campo de unidades", () => {
    expect(aFormulario(item({ stock: 5 }))).not.toHaveProperty("stock");
    expect(Object.keys(EditarItemSchema.shape)).not.toContain("stock");
  });
});
