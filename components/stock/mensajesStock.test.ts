import { describe, expect, it } from "vitest";
import type { ResultadoStock } from "@/lib/domain/stock/movimientos";
import { mensajeDeStock } from "./mensajesStock";

const r = (o: Partial<ResultadoStock>): ResultadoStock => ({
  movimiento_id: "m1",
  tipo: "ingreso",
  cantidad: 1,
  stock_resultante: 3,
  stock_negativo: false,
  repetido: false,
  ...o,
});

describe("mensajeDeStock", () => {
  it("una operación normal dice cómo quedó el stock", () => {
    expect(mensajeDeStock("Caribe 550", r({}))).toEqual({ exito: 'Stock de "Caribe 550": 3.', aviso: null });
  });

  it("un stock negativo es un aviso, no un éxito", () => {
    const m = mensajeDeStock("Caribe 550", r({ stock_resultante: -3, stock_negativo: true }));
    expect(m.exito).toBeNull();
    expect(m.aviso).toMatch(/quedó en stock negativo \(−3\)/);
  });

  it("un conteo que coincidía avisa que no hubo cambios", () => {
    expect(mensajeDeStock("Caribe 550", r({ movimiento_id: null })).exito).toMatch(/no hubo cambios/);
  });

  it("una operación repetida avisa que no se repitió", () => {
    expect(mensajeDeStock("Caribe 550", r({ repetido: true })).exito).toMatch(/no se repitió/);
  });
});
