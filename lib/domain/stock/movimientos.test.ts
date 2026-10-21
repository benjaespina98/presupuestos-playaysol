import { describe, expect, it } from "vitest";
import {
  CANTIDAD_MAX,
  cantidadConSigno,
  diferenciaDeConteo,
  esAnulable,
  marcarAnulados,
  mensajeErrorStock,
  motivoNoAnulable,
  nuevaClaveIdempotencia,
  parsearCantidad,
  parsearConteo,
  validarMotivo,
  validarReferencia,
  ventaDejaNegativo,
  type MovimientoStock,
} from "./movimientos";

const mov = (o: Partial<MovimientoStock>): MovimientoStock => ({
  id: "m", item_id: "i", tipo: "ingreso", cantidad: 1, stock_resultante: 1, motivo: null, referencia: null,
  anula_a: null, creado_por: null, creado_at: "2026-10-22T10:00:00Z", ...o,
});

describe("parsearCantidad", () => {
  it.each([["1", 1], [" 12 ", 12], ["10000", CANTIDAD_MAX]])("acepta %j", (texto, valor) => {
    expect(parsearCantidad(texto)).toEqual({ valor, error: null });
  });

  it.each([
    ["", /Escribí/],
    ["   ", /Escribí/],
    ["0", /al menos 1/],
    ["-3", /entero/],
    ["+3", /entero/],
    ["1.5", /entero/],
    ["1,5", /entero/],
    ["abc", /entero/],
    ["10001", /no puede pasar/],
  ])("rechaza %j", (texto, mensaje) => {
    const r = parsearCantidad(texto);
    expect(r.valor).toBeNull();
    expect(r.error).toMatch(mensaje);
  });
});

describe("parsearConteo", () => {
  it("acepta 0 en adelante", () => {
    expect(parsearConteo("0")).toEqual({ valor: 0, error: null });
    expect(parsearConteo("25")).toEqual({ valor: 25, error: null });
  });

  it.each(["", "-1", "2.5", "x", "1000001"])("rechaza %j", (texto) => {
    expect(parsearConteo(texto).valor).toBeNull();
  });
});

describe("venta y negativos", () => {
  it("ventaDejaNegativo", () => {
    expect(ventaDejaNegativo(5, 5)).toBe(false); // llega justo a 0
    expect(ventaDejaNegativo(5, 6)).toBe(true);
    expect(ventaDejaNegativo(0, 1)).toBe(true);
    expect(ventaDejaNegativo(-2, 1)).toBe(true); // ya estaba en negativo
  });

  it("diferenciaDeConteo y cantidadConSigno", () => {
    expect(diferenciaDeConteo(-8, 25)).toBe(33);
    expect(diferenciaDeConteo(10, 4)).toBe(-6);
    expect(diferenciaDeConteo(3, 3)).toBe(0);
    expect(cantidadConSigno(3)).toBe("+3");
    expect(cantidadConSigno(-2)).toBe("−2");
    expect(cantidadConSigno(0)).toBe("0");
  });
});

describe("motivo y referencia", () => {
  it("el motivo se recorta y tiene 3 a 500 caracteres", () => {
    expect(validarMotivo("  Conteo físico ")).toEqual({ motivo: "Conteo físico", error: null });
    expect(validarMotivo("ab").motivo).toBeNull();
    expect(validarMotivo("   ").motivo).toBeNull();
    expect(validarMotivo("a".repeat(500)).error).toBeNull();
    expect(validarMotivo("a".repeat(501)).motivo).toBeNull();
  });

  it("la referencia es opcional y de hasta 200 caracteres", () => {
    expect(validarReferencia("")).toEqual({ referencia: null, error: null });
    expect(validarReferencia("  Remito 7 ")).toEqual({ referencia: "Remito 7", error: null });
    expect(validarReferencia("x".repeat(200)).error).toBeNull();
    expect(validarReferencia("x".repeat(201)).referencia).toBeNull();
  });
});

describe("historial: anulados y contra-asientos", () => {
  const movimientos = [
    mov({ id: "a", tipo: "apertura", cantidad: 5, stock_resultante: 5, creado_por: "u1" }),
    mov({ id: "b", tipo: "venta", cantidad: -2, stock_resultante: 3, creado_por: "u2" }),
    mov({ id: "c", tipo: "anulacion", cantidad: 2, stock_resultante: 5, motivo: "Error", anula_a: "b" }),
    mov({ id: "d", tipo: "ajuste", cantidad: -1, stock_resultante: 4, motivo: "Conteo" }),
  ];
  const vistas = marcarAnulados(movimientos, new Map([["u1", "Ana"], ["u2", "Benja"]]));
  const por = (id: string) => vistas.find((v) => v.id === id)!;

  it("marca como anulado lo que tiene una anulación apuntándole, y nada más", () => {
    expect(por("b").anulado).toBe(true);
    expect(["a", "c", "d"].map((id) => por(id).anulado)).toEqual([false, false, false]);
  });

  it("resuelve quién hizo cada uno", () => {
    expect(por("a").creadorNombre).toBe("Ana");
    expect(por("b").creadorNombre).toBe("Benja");
    expect(por("c").creadorNombre).toBeNull();
  });

  it("sólo se pueden anular ingreso, venta y ajuste que no estén anulados", () => {
    expect(esAnulable(por("d"))).toBe(true); // ajuste
    expect(esAnulable(por("b"))).toBe(false); // ya anulado
    expect(esAnulable(por("c"))).toBe(false); // una anulación no se anula
    expect(esAnulable(por("a"))).toBe(false); // una apertura se corrige con un ajuste
    expect(motivoNoAnulable(por("b"))).toBe("Ya anulado");
    expect(motivoNoAnulable(por("c"))).toBe("Es una anulación");
    expect(motivoNoAnulable(por("a"))).toBe("Se corrige con un ajuste");
    expect(motivoNoAnulable(por("d"))).toBeNull();
  });
});

describe("mensajeErrorStock", () => {
  it.each([
    ["ST002", /ya no existe/],
    ["ST003", /no lleva stock/],
    ["ST005", /otros datos/],
    ["ST006", /Ajustar conteo/],
    ["ST007", /ya fue anulado/],
    ["ST010", /no se cambia directamente/],
    ["ST011", /Ingreso/],
    ["42501", /sesión/],
    ["PGRST202", /actualización de la base/],
  ])("traduce %s", (code, mensaje) => {
    expect(mensajeErrorStock({ code, message: "texto interno" })).toMatch(mensaje);
  });

  it("nunca devuelve texto interno de Postgres", () => {
    const interno = 'duplicate key value violates unique constraint "movimientos_stock_idempotency_key_key"';
    expect(mensajeErrorStock({ code: "23505", message: interno })).not.toMatch(/duplicate|constraint|movimientos_stock/);
    expect(mensajeErrorStock({ code: "XX000", message: "internal error at line 12" })).toBe("No se pudo registrar el movimiento. Probá de nuevo.");
    expect(mensajeErrorStock(null)).toMatch(/No se pudo registrar/);
  });

  it("un corte de red se explica como tal", () => {
    expect(mensajeErrorStock({ message: "TypeError: Failed to fetch" })).toMatch(/conectar/);
  });
});

describe("nuevaClaveIdempotencia", () => {
  it("cada llamada da una clave distinta, que entra en el rango que acepta la base (8 a 100)", () => {
    const a = nuevaClaveIdempotencia();
    const b = nuevaClaveIdempotencia();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(8);
    expect(a.length).toBeLessThanOrEqual(100);
  });
});
