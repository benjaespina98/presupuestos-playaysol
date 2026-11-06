import { describe, expect, it } from "vitest";
import { agotadosAhora, delPeriodo, resumirMovimientos, type MovimientoConItem } from "./resumen";

let n = 0;
function mov(o: Partial<MovimientoConItem>): MovimientoConItem {
  n++;
  return {
    id: `m${n}`,
    item_id: "a",
    itemNombre: "Caribe 550",
    tipo: "venta",
    cantidad: -1,
    stock_resultante: 0,
    motivo: null,
    referencia: null,
    anula_a: null,
    creado_por: "u1",
    creado_at: "2026-11-05T12:00:00.000Z",
    anulado: false,
    creadorNombre: "Ana",
    ...o,
  };
}

describe("resumirMovimientos", () => {
  it("cuenta ventas, ingresos y ajustes, por persona y por modelo; lo anulado no cuenta", () => {
    const r = resumirMovimientos([
      mov({ tipo: "venta", cantidad: -2 }),
      mov({ tipo: "venta", cantidad: -1, anulado: true }),
      mov({ tipo: "anulacion", cantidad: 1, anula_a: "x" }),
      mov({ tipo: "ingreso", cantidad: 5, creadorNombre: "Beto" }),
      mov({ tipo: "ajuste", cantidad: 1, creadorNombre: "Beto" }),
    ]);
    expect(r.vendidas).toBe(2);
    expect(r.ingresadas).toBe(5);
    expect(r.ajustes).toBe(1);
    expect(r.movimientos).toBe(5);
    expect(r.porPersona[0]).toEqual({ nombre: "Ana", cantidad: 3 });
    expect(r.masVendidos).toEqual([{ nombre: "Caribe 550", unidades: 2 }]);
  });
});

describe("agotadosAhora", () => {
  it("dice cuándo y quién dejó el modelo sin stock, sólo si hoy está en 0 o menos", () => {
    const movs = [
      mov({ item_id: "a", cantidad: -1, stock_resultante: 0, creado_at: "2026-11-05T10:00:00.000Z", creadorNombre: "Beto" }),
      mov({ item_id: "a", cantidad: -1, stock_resultante: 1, creado_at: "2026-11-04T10:00:00.000Z" }),
      mov({ item_id: "a", tipo: "ingreso", cantidad: 2, stock_resultante: 2, creado_at: "2026-11-01T10:00:00.000Z" }),
      mov({ item_id: "b", itemNombre: "Racionalista 400", cantidad: -1, stock_resultante: 3, creado_at: "2026-11-05T09:00:00.000Z" }),
    ];
    const r = agotadosAhora(movs);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ itemId: "a", fecha: "2026-11-05T10:00:00.000Z", quien: "Beto", stockActual: 0 });
  });
});

describe("delPeriodo", () => {
  const ahora = new Date("2026-11-05T15:00:00");
  const movs = [{ creado_at: new Date("2026-11-05T08:00:00").toISOString() }, { creado_at: new Date("2026-10-31T08:00:00").toISOString() }, { creado_at: new Date("2026-09-01T08:00:00").toISOString() }];
  it("filtra por hoy, 7 días, 30 días o todo", () => {
    expect(delPeriodo(movs, "hoy", ahora)).toHaveLength(1);
    expect(delPeriodo(movs, "7", ahora)).toHaveLength(2);
    expect(delPeriodo(movs, "30", ahora)).toHaveLength(2);
    expect(delPeriodo(movs, "todo", ahora)).toHaveLength(3);
  });
});
