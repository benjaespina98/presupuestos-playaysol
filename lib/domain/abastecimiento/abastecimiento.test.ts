import { describe, expect, it } from "vitest";
import {
  filtrarProveedores,
  ordenarProveedores,
  sinTelefono,
  Proveedor,
} from "./proveedor";
import {
  contarMaterialesPorRubro,
  filtrarMateriales,
  limpiarCantidades,
  Material,
  materialesPorProveedor,
  ordenarMateriales,
} from "./material";

function proveedor(o: Partial<Proveedor> = {}): Proveedor {
  return {
    id: "p1",
    nombre: "Proveedor",
    rubro: null,
    contacto: null,
    telefono: "123",
    forma_pago: null,
    plazo: null,
    notas: null,
    activo: true,
    orden: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    ...o,
  };
}

function material(o: Partial<Material> = {}): Material {
  return {
    id: "m1",
    nombre: "Cemento",
    proveedor_id: null,
    unidad: "bolsa",
    precio: 100,
    precio_actualizado: null,
    rubro: "Materiales",
    aplica: "Siempre",
    usd_ref: null,
    notas: null,
    cantidades: {},
    activo: true,
    orden: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    ...o,
  };
}

describe("proveedores", () => {
  it("sinTelefono: vacío, espacios y '—' cuentan como sin teléfono", () => {
    expect(sinTelefono({ telefono: null })).toBe(true);
    expect(sinTelefono({ telefono: "  " })).toBe(true);
    expect(sinTelefono({ telefono: "—" })).toBe(true);
    expect(sinTelefono({ telefono: "+54 9 3534 00-0000" })).toBe(false);
  });

  it("filtra por búsqueda (nombre, rubro, contacto, notas), baja y sin teléfono", () => {
    const items = [
      proveedor({ id: "a", nombre: "Ranco", rubro: "Corralón" }),
      proveedor({ id: "b", nombre: "Vulcano", telefono: null }),
      proveedor({ id: "c", nombre: "Viejo", activo: false }),
    ];
    expect(filtrarProveedores(items, {}).map((p) => p.id)).toEqual(["a", "b"]);
    expect(filtrarProveedores(items, { incluirInactivos: true })).toHaveLength(3);
    expect(filtrarProveedores(items, { busqueda: "corral" }).map((p) => p.id)).toEqual(["a"]);
    expect(filtrarProveedores(items, { soloSinTelefono: true }).map((p) => p.id)).toEqual(["b"]);
  });

  it("ordena por `orden` manual primero y después alfabético", () => {
    const items = [
      proveedor({ id: "z", nombre: "Zeta", orden: null }),
      proveedor({ id: "b", nombre: "Beta", orden: 2 }),
      proveedor({ id: "a", nombre: "Alfa", orden: 1 }),
      proveedor({ id: "c", nombre: "Ceta", orden: null }),
    ];
    expect(ordenarProveedores(items).map((p) => p.id)).toEqual(["a", "b", "c", "z"]);
  });
});

describe("materiales", () => {
  const items = [
    material({ id: "a", nombre: "Hierro", rubro: "Materiales", proveedor_id: "p1" }),
    material({ id: "b", nombre: "Filtro", rubro: "Hidráulica", proveedor_id: "p2", precio: null }),
    material({ id: "c", nombre: "Piedra", rubro: "Áridos", proveedor_id: "p1", activo: false }),
    material({ id: "d", nombre: "Raro", rubro: null }),
  ];

  it("filtra por rubro, proveedor, sin precio, búsqueda y baja", () => {
    expect(filtrarMateriales(items, {}).map((m) => m.id)).toEqual(["a", "b", "d"]);
    expect(filtrarMateriales(items, { incluirInactivos: true })).toHaveLength(4);
    expect(filtrarMateriales(items, { rubro: "Hidráulica" }).map((m) => m.id)).toEqual(["b"]);
    expect(filtrarMateriales(items, { proveedorId: "p1" }).map((m) => m.id)).toEqual(["a"]);
    expect(filtrarMateriales(items, { soloSinPrecio: true }).map((m) => m.id)).toEqual(["b"]);
    expect(filtrarMateriales(items, { busqueda: "hier" }).map((m) => m.id)).toEqual(["a"]);
  });

  it("ordena por rubro (el de la planilla), sin rubro al final, y alfabético adentro", () => {
    const orden = ordenarMateriales(items).map((m) => m.id);
    // Materiales, Áridos, Hidráulica, (sin rubro)
    expect(orden).toEqual(["a", "c", "b", "d"]);
  });

  it("cuenta por rubro ignorando el filtro de rubro y agrupando 'Sin rubro'", () => {
    const { total, porRubro } = contarMaterialesPorRubro(items, {});
    expect(total).toBe(3);
    expect(porRubro).toEqual({ Materiales: 1, Hidráulica: 1, "Sin rubro": 1 });
  });

  it("cuenta cuántos materiales tiene cada proveedor", () => {
    expect(materialesPorProveedor(items)).toEqual({ p1: 2, p2: 1 });
  });

  it("limpiarCantidades descarta lo vacío y lo inválido, pero conserva el 0", () => {
    expect(limpiarCantidades({ "5x3": 50, "6x3": null, "7x3": undefined, "8x4": 0, "9x4": -1, "10x4": NaN })).toEqual({
      "5x3": 50,
      "8x4": 0,
    });
  });
});
