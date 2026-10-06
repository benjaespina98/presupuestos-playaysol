import { describe, expect, it } from "vitest";
import { PARAMETROS_POR_DEFECTO } from "./pedido";
import { type LineaGuardada, type PedidoGuardado } from "./pedidoDocumento";
import { contarPorEstado, filtrarPedidos, proveedoresDePedido } from "./pedidosLista";

const linea = (proveedor: string): LineaGuardada => ({
  material_id: proveedor, nombre: "x", unidad: null, cantidad: 1, precio: 1, subtotal: 1,
  proveedor_id: proveedor, proveedor, contacto: null, telefono: null,
});

const pedido = (o: Partial<PedidoGuardado>): PedidoGuardado => ({
  id: "x", numero: 1, obra: "", solicitante: "", parametros: PARAMETROS_POR_DEFECTO, lineas: [], costo: 0,
  estado: "borrador", notas: null, created_at: "2026-10-05T00:00:00Z", updated_at: "2026-10-05T00:00:00Z", ...o,
});

const PEDIDOS = [
  pedido({ id: "a", numero: 1, obra: "Familia Pérez", estado: "recibido", lineas: [linea("Ranco"), linea("Vulcano")] }),
  pedido({ id: "b", numero: 2, obra: "Familia Gómez", solicitante: "Benja", estado: "enviado", lineas: [linea("Ranco")] }),
  pedido({ id: "c", numero: 12, obra: "Club", estado: "borrador", parametros: { ...PARAMETROS_POR_DEFECTO, tamano: "9x4" } }),
  pedido({ id: "d", numero: 3, obra: "Viejo", estado: "cancelado" }),
];

describe("proveedoresDePedido", () => {
  it("los nombres distintos, en el orden en que se piden", () => {
    expect(proveedoresDePedido(pedido({ lineas: [linea("Ranco"), linea("Vulcano"), linea("Ranco")] }))).toEqual(["Ranco", "Vulcano"]);
    expect(proveedoresDePedido(pedido({}))).toEqual([]);
  });
});

describe("filtrarPedidos", () => {
  it("sin filtros devuelve todos, los más nuevos primero", () => {
    expect(filtrarPedidos(PEDIDOS, {}).map((p) => p.numero)).toEqual([12, 3, 2, 1]);
  });

  it("filtra por estado", () => {
    expect(filtrarPedidos(PEDIDOS, { estado: "enviado" }).map((p) => p.id)).toEqual(["b"]);
    expect(filtrarPedidos(PEDIDOS, { estado: null })).toHaveLength(4);
  });

  it("busca por obra, solicitante, tamaño y proveedor, sin distinguir mayúsculas ni espacios de más", () => {
    expect(filtrarPedidos(PEDIDOS, { busqueda: "  pérez " }).map((p) => p.id)).toEqual(["a"]);
    expect(filtrarPedidos(PEDIDOS, { busqueda: "benja" }).map((p) => p.id)).toEqual(["b"]);
    expect(filtrarPedidos(PEDIDOS, { busqueda: "9x4" }).map((p) => p.id)).toEqual(["c"]);
    expect(filtrarPedidos(PEDIDOS, { busqueda: "vulcano" }).map((p) => p.id)).toEqual(["a"]);
    expect(filtrarPedidos(PEDIDOS, { busqueda: "ranco" }).map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("busca por número, con o sin el prefijo", () => {
    expect(filtrarPedidos(PEDIDOS, { busqueda: "PED-0012" }).map((p) => p.id)).toEqual(["c"]);
    expect(filtrarPedidos(PEDIDOS, { busqueda: "ped-0002" }).map((p) => p.id)).toEqual(["b"]);
  });

  it("combina búsqueda y estado", () => {
    expect(filtrarPedidos(PEDIDOS, { busqueda: "ranco", estado: "recibido" }).map((p) => p.id)).toEqual(["a"]);
    expect(filtrarPedidos(PEDIDOS, { busqueda: "ranco", estado: "borrador" })).toEqual([]);
  });

  it("no modifica la lista original", () => {
    const copia = [...PEDIDOS];
    filtrarPedidos(PEDIDOS, {});
    expect(PEDIDOS).toEqual(copia);
  });
});

describe("contarPorEstado", () => {
  it("cuenta por estado, con todos los estados presentes aunque estén en 0", () => {
    expect(contarPorEstado(PEDIDOS, "")).toEqual({
      total: 4,
      porEstado: { borrador: 1, enviado: 1, recibido: 1, cancelado: 1 },
    });
    expect(contarPorEstado([], "").porEstado).toEqual({ borrador: 0, enviado: 0, recibido: 0, cancelado: 0 });
  });

  it("respeta la búsqueda", () => {
    expect(contarPorEstado(PEDIDOS, "ranco")).toEqual({
      total: 2,
      porEstado: { borrador: 0, enviado: 1, recibido: 1, cancelado: 0 },
    });
  });
});
