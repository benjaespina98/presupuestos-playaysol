import { describe, expect, it } from "vitest";
import {
  armarDocumento,
  separarPorProveedor,
  type LineaGuardada,
} from "@/lib/domain/abastecimiento/pedidoDocumento";
import { PARAMETROS_POR_DEFECTO } from "@/lib/domain/abastecimiento/pedido";
import { generarPdfPedido } from "./pdf";

/**
 * Smoke test del PDF del pedido: confirma que el pipeline documento → react-pdf
 * produce un PDF real (no vacío y con la firma correcta), sin navegador. No
 * reemplaza revisarlo a ojo, pero protege contra que se rompa en silencio.
 */

const linea = (o: Partial<LineaGuardada>): LineaGuardada => ({
  material_id: "m1", nombre: "Hierro", unidad: "unidad", cantidad: 10, precio: 100, subtotal: 1000,
  proveedor_id: "p1", proveedor: "Corralón Uno", contacto: "Juan", telefono: "+54 9 111 111", ...o,
});

const datos = (o = {}) => ({
  numero: 7, fecha: new Date(2026, 9, 5), obra: "Familia Pérez", solicitante: "Benja",
  parametros: PARAMETROS_POR_DEFECTO, observaciones: "Entregar temprano", ...o,
});

const firma = async (blob: Blob) => String.fromCharCode(...new Uint8Array(await blob.slice(0, 5).arrayBuffer()));

describe("generarPdfPedido", () => {
  const lineas = [
    linea({ material_id: "a", nombre: "Hierro del 6", cantidad: 90, precio: 5340, subtotal: 480600 }),
    linea({ material_id: "b", nombre: "Cemento 25 kg", unidad: "bolsa", cantidad: 180, precio: 6461.17, subtotal: 1163010.6 }),
    linea({ material_id: "c", nombre: "Filtro", proveedor_id: "p2", proveedor: "Filtros SA", contacto: null, telefono: null, cantidad: 1, precio: null, subtotal: 0 }),
  ];

  it("genera un PDF válido de un pedido de varios proveedores (todo junto)", async () => {
    const blob = await generarPdfPedido(armarDocumento(lineas, datos()), { logoUrl: null });
    expect(await firma(blob)).toBe("%PDF-");
    expect(blob.size).toBeGreaterThan(2000);
  });

  it("genera un PDF válido de un solo proveedor", async () => {
    const [uno] = separarPorProveedor(armarDocumento(lineas, datos()));
    const blob = await generarPdfPedido(uno, { logoUrl: null });
    expect(await firma(blob)).toBe("%PDF-");
  });

  it("un pedido sin guardar (BORRADOR) y sin observaciones también sale", async () => {
    const blob = await generarPdfPedido(armarDocumento(lineas, datos({ numero: null, observaciones: "", obra: "" })), { logoUrl: null });
    expect(await firma(blob)).toBe("%PDF-");
  });

  it("un pedido largo (varias páginas) sale completo", async () => {
    const muchas = Array.from({ length: 120 }, (_, i) =>
      linea({ material_id: `m${i}`, nombre: `Material de prueba número ${i + 1}`, cantidad: i + 1, precio: 10, subtotal: (i + 1) * 10 })
    );
    const una = await generarPdfPedido(armarDocumento(lineas.slice(0, 1), datos()), { logoUrl: null });
    const largo = await generarPdfPedido(armarDocumento(muchas, datos()), { logoUrl: null });
    expect(await firma(largo)).toBe("%PDF-");
    expect(largo.size).toBeGreaterThan(una.size);
  });

  it("un pedido vacío no rompe", async () => {
    const blob = await generarPdfPedido(armarDocumento([], datos()), { logoUrl: null });
    expect(await firma(blob)).toBe("%PDF-");
  });
});

describe("generarPdfPedido · sin precios", () => {
  it("sale igual (más corto: sin columnas de precio, subtotales, total ni firmas)", async () => {
    const doc = armarDocumento(
      [linea({ material_id: "a", nombre: "Hierro del 6" }), linea({ material_id: "b", nombre: "Filtro", precio: null, subtotal: 0 })],
      datos()
    );
    const con = await generarPdfPedido(doc, { logoUrl: null, conPrecios: true });
    const sin = await generarPdfPedido(doc, { logoUrl: null, conPrecios: false });
    expect(await firma(sin)).toBe("%PDF-");
    expect(sin.size).toBeLessThan(con.size);
  });
});
