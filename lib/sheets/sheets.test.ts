import { describe, expect, it } from "vitest";
import type { Material } from "@/lib/domain/abastecimiento/material";
import type { Proveedor } from "@/lib/domain/abastecimiento/proveedor";
import { tokenDeEncabezado, tokenValido } from "./autorizacion";
import { armarExportacion, fechaParaPlanilla } from "./exportar";

const proveedor = (o: Partial<Proveedor>): Proveedor => ({
  id: "p1",
  nombre: "Ranco",
  rubro: "Corralón",
  contacto: "Juan",
  telefono: "123",
  forma_pago: null,
  plazo: null,
  notas: "una nota",
  activo: true,
  orden: 1,
  updated_at: "2026-01-01T00:00:00.000Z",
  ...o,
});

const material = (o: Partial<Material>): Material => ({
  id: "m1",
  nombre: "Cemento",
  proveedor_id: "p1",
  unidad: "bolsa",
  precio: 6461.17,
  precio_actualizado: "2026-06-18",
  rubro: "Materiales",
  aplica: "Siempre",
  usd_ref: null,
  notas: null,
  cantidades: { "5x3": 110, "8x4": 180 },
  activo: true,
  orden: 1,
  updated_at: "2026-01-01T00:00:00.000Z",
  ...o,
});

describe("fechaParaPlanilla", () => {
  it("pasa de ISO a dd/mm/aaaa y tolera vacío", () => {
    expect(fechaParaPlanilla("2026-06-18")).toBe("18/06/2026");
    expect(fechaParaPlanilla(null)).toBe("");
  });
});

describe("armarExportacion · proveedores", () => {
  it("arma las filas con las 7 columnas de la hoja, vacío donde no hay dato", () => {
    const e = armarExportacion({ proveedores: [proveedor({})], materiales: [], items: [] });
    expect(e.proveedores).toEqual([["Ranco", "Corralón", "Juan", "123", "", "", "una nota"]]);
  });

  it("deja afuera a los dados de baja y respeta el orden de la planilla", () => {
    const e = armarExportacion({
      proveedores: [
        proveedor({ id: "c", nombre: "Zeta", orden: null }),
        proveedor({ id: "b", nombre: "Beta", orden: 2 }),
        proveedor({ id: "x", nombre: "Baja", orden: 3, activo: false }),
        proveedor({ id: "a", nombre: "Alfa", orden: 1 }),
      ],
      materiales: [],
      items: [],
    });
    expect(e.proveedores.map((f) => f[0])).toEqual(["Alfa", "Beta", "Zeta"]);
  });
});

describe("armarExportacion · artículos", () => {
  it("arma las 20 columnas A..T con el proveedor por nombre y las cantidades en el orden de los tamaños", () => {
    const e = armarExportacion({ proveedores: [proveedor({})], materiales: [material({})], items: [] });
    const { fila, usd } = e.articulos[0];

    expect(usd).toBe(false);
    expect(fila).toHaveLength(20);
    expect(fila.slice(0, 7)).toEqual(["Cemento", "Ranco", "bolsa", 6461.17, "18/06/2026", "Materiales", "Siempre"]);
    // H..R: 5x3, 6x3, 7x3, 7x3.50, 7x4, 8x3, 8x4, ...
    expect(fila.slice(7, 18)).toEqual([110, "", "", "", "", "", 180, "", "", "", ""]);
    expect(fila[18]).toBeNull(); // S: USD ref
    expect(fila[19]).toBe(""); // T: notas
  });

  it("si el precio está en dólares, no manda el precio en pesos: en la planilla es una fórmula", () => {
    const e = armarExportacion({
      proveedores: [proveedor({})],
      materiales: [material({ precio: 166286, usd_ref: 114.68 })],
      items: [],
    });
    expect(e.articulos[0].usd).toBe(true);
    expect(e.articulos[0].fila[3]).toBeNull();
    expect(e.articulos[0].fila[18]).toBe(114.68);
  });

  it("REGRESIÓN: un USD de referencia en 0 NO es una cotización en dólares: el precio en pesos viaja igual", () => {
    // Antes la planilla mostraba $0 (=USD × tipo de cambio) para un material con USD en 0.
    const e = armarExportacion({ proveedores: [proveedor({})], materiales: [material({ precio: 5345, usd_ref: 0 })], items: [] });
    expect(e.articulos[0].usd).toBe(false);
    expect(e.articulos[0].fila[3]).toBe(5345);
    expect(e.articulos[0].fila[18]).toBeNull();
  });

  it("un precio a confirmar (null) viaja null, y una cantidad en 0 se conserva como 0", () => {
    const e = armarExportacion({
      proveedores: [],
      materiales: [material({ precio: null, cantidades: { "5x3": 0 } })],
      items: [],
    });
    expect(e.articulos[0].fila[3]).toBeNull();
    expect(e.articulos[0].fila[7]).toBe(0);
  });

  it("un material sin proveedor, o con un proveedor que ya no existe, sale con la celda vacía", () => {
    const e = armarExportacion({
      proveedores: [],
      materiales: [material({ proveedor_id: null }), material({ id: "m2", nombre: "Otro", proveedor_id: "fantasma", orden: 2 })],
      items: [],
    });
    expect(e.articulos.map((a) => a.fila[1])).toEqual(["", ""]);
  });

  it("deja afuera los dados de baja y ordena como la planilla", () => {
    const e = armarExportacion({
      proveedores: [],
      materiales: [
        material({ id: "c", nombre: "Zeta", orden: null }),
        material({ id: "b", nombre: "Beta", orden: 2 }),
        material({ id: "x", nombre: "Baja", orden: 3, activo: false }),
        material({ id: "a", nombre: "Alfa", orden: 1 }),
      ],
      items: [],
    });
    expect(e.articulos.map((a) => a.fila[0])).toEqual(["Alfa", "Beta", "Zeta"]);
  });
});

describe("armarExportacion · precios de venta", () => {
  it("indexa por tipo:clave, con null para 'a cotizar', y salta bajas y textos compartidos", () => {
    const e = armarExportacion({
      proveedores: [],
      materiales: [],
      items: [
        { tipo: "piscinas", clave: "luces", precio: 240000 },
        { tipo: "piscinas", clave: "cascada", precio: null },
        { tipo: "piscinas", clave: "viejo", precio: 5, activo: false },
        { tipo: "piscinas", clave: "__legal", precio: null },
      ],
    });
    expect(e.precios).toEqual({ "piscinas:luces": 240000, "piscinas:cascada": null });
  });
});

describe("armarExportacion · versión", () => {
  const entrada = () => ({ proveedores: [proveedor({})], materiales: [material({})], items: [] });

  it("es igual si el contenido es igual (aunque cambie la hora) y cambia si cambia un dato", () => {
    const a = armarExportacion(entrada(), new Date("2026-01-01T00:00:00Z"));
    const b = armarExportacion(entrada(), new Date("2026-02-02T00:00:00Z"));
    expect(a.version).toBe(b.version);
    expect(a.generado).not.toBe(b.generado);

    const c = armarExportacion({ ...entrada(), materiales: [material({ precio: 7000 })] });
    expect(c.version).not.toBe(a.version);
  });

  it("incluye los tamaños en el orden de las columnas de la hoja", () => {
    expect(armarExportacion(entrada()).tamanos).toEqual([
      "5x3", "6x3", "7x3", "7x3.50", "7x4", "8x3", "8x4", "9x3", "9x4", "10x4", "6.5x2.5",
    ]);
  });
});

describe("autorización", () => {
  it("el token correcto pasa; uno distinto, vacío o de otro largo no", () => {
    expect(tokenValido("secreto-largo-123", "secreto-largo-123")).toBe(true);
    expect(tokenValido("secreto-largo-124", "secreto-largo-123")).toBe(false);
    expect(tokenValido("corto", "secreto-largo-123")).toBe(false);
    expect(tokenValido("", "secreto-largo-123")).toBe(false);
    expect(tokenValido("algo", "")).toBe(false);
  });

  it("saca el token del encabezado Bearer", () => {
    expect(tokenDeEncabezado("Bearer abc123")).toBe("abc123");
    expect(tokenDeEncabezado("bearer   abc123 ")).toBe("abc123");
    expect(tokenDeEncabezado("Basic abc123")).toBe("");
    expect(tokenDeEncabezado(null)).toBe("");
  });
});
