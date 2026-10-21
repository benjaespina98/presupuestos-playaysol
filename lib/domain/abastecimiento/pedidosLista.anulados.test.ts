import { describe, expect, it } from "vitest";
import { PARAMETROS_POR_DEFECTO } from "./pedido";
import { type PedidoGuardado } from "./pedidoDocumento";
import { contarPorEstado, filtrarPedidos } from "./pedidosLista";

const pedido = (o: Partial<PedidoGuardado>): PedidoGuardado => ({
  id: "x", numero: 1, obra: "", solicitante: "", parametros: PARAMETROS_POR_DEFECTO, lineas: [], costo: 0,
  estado: "borrador", notas: null, created_at: "2026-10-05T00:00:00Z", updated_at: "2026-10-05T00:00:00Z", ...o,
});

const PEDIDOS = [
  pedido({ id: "a", numero: 1, obra: "Pérez", estado: "enviado" }),
  pedido({ id: "b", numero: 2, obra: "Gómez", estado: "enviado", anulado_at: "2026-10-06T00:00:00Z", anulado_motivo: "Duplicado" }),
  pedido({ id: "c", numero: 3, obra: "Club", estado: "borrador", anulado_at: null }),
];

describe("pedidos anulados en la lista", () => {
  it("por defecto no figuran", () => {
    expect(filtrarPedidos(PEDIDOS, {}).map((p) => p.id)).toEqual(["c", "a"]);
  });

  it("con incluirAnulados aparecen, en su lugar", () => {
    expect(filtrarPedidos(PEDIDOS, { incluirAnulados: true }).map((p) => p.id)).toEqual(["c", "b", "a"]);
  });

  it("la búsqueda y el estado se aplican igual", () => {
    expect(filtrarPedidos(PEDIDOS, { busqueda: "gómez" })).toEqual([]);
    expect(filtrarPedidos(PEDIDOS, { busqueda: "gómez", incluirAnulados: true }).map((p) => p.id)).toEqual(["b"]);
  });

  it("los contadores de estado no cuentan los anulados salvo que se muestren", () => {
    expect(contarPorEstado(PEDIDOS, "").porEstado.enviado).toBe(1);
    expect(contarPorEstado(PEDIDOS, "", true).porEstado.enviado).toBe(2);
    expect(contarPorEstado(PEDIDOS, "").total).toBe(2);
  });
});
