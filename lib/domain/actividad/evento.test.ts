import { describe, expect, it } from "vitest";
import { describirAuditoria, describirMovimiento, filtrarEventos, ordenarEventos, type FilaAuditoria } from "./evento";
import type { MovimientoConItem } from "@/lib/domain/stock/resumen";

let n = 0;
function fila(o: Partial<FilaAuditoria>): FilaAuditoria {
  n++;
  return { id: n, tabla: "catalogo_items", registro_id: "r1", accion: "UPDATE", usuario_id: "u1", fecha: "2026-11-05T10:00:00.000Z", columnas_cambiadas: [], valores: null, ...o };
}

describe("describirAuditoria", () => {
  it("un cambio de precio dice de cuánto a cuánto, con el nombre actual del ítem", () => {
    const e = describirAuditoria(fila({ columnas_cambiadas: ["precio"], valores: { antes: { precio: 63500 }, despues: { precio: 70000 } } }), "Ana", () => "Lona premium (mayor gramaje)")!;
    expect(e.titulo).toBe("Cambió el precio de «Lona premium»");
    expect(e.detalle).toContain("→");
    expect(e.quien).toBe("Ana");
    expect(e.sistema).toBe(false);
    expect(e.area).toBe("precios");
  });

  it("sin usuario figura como Sistema", () => {
    const e = describirAuditoria(fila({ usuario_id: null, columnas_cambiadas: ["activo"], valores: { antes: { activo: true }, despues: { activo: false } } }), "Sistema", () => "Cerco")!;
    expect(e.sistema).toBe(true);
    expect(e.titulo).toBe("Desactivó «Cerco»");
  });

  it("de un proveedor dice qué cambió pero nunca el valor de lo sensible", () => {
    const e = describirAuditoria(fila({ tabla: "proveedores", columnas_cambiadas: ["telefono", "contacto"], valores: null }), "Ana", () => "Corralón Sur")!;
    expect(e.titulo).toBe("Editó el proveedor «Corralón Sur»");
    expect(e.detalle).toBe("Cambió el teléfono y el contacto");
    expect(JSON.stringify(e)).not.toMatch(/\d{6}/);
  });

  it("pedidos: número y nuevo estado; presupuestos: tipo y anulación", () => {
    expect(describirAuditoria(fila({ tabla: "pedidos", columnas_cambiadas: ["estado"], valores: { antes: { estado: "borrador", numero: 5 }, despues: { estado: "enviado", numero: 5 } } }), "Ana")!.titulo).toBe("Pasó el pedido PED-0005 a Enviado");
    expect(describirAuditoria(fila({ tabla: "presupuestos", columnas_cambiadas: ["anulado_at", "anulado_por"] }), "Ana", () => "cercos")!.titulo).toBe("Anuló un presupuesto de cercos");
  });

  it("una tabla que no se muestra se omite", () => {
    expect(describirAuditoria(fila({ tabla: "otra" }), "Ana")).toBeNull();
  });
});

describe("describirMovimiento y filtros", () => {
  const mov = (o: Partial<MovimientoConItem>): MovimientoConItem => ({
    id: "m1", item_id: "a", itemNombre: "Caribe 550", tipo: "venta", cantidad: -1, stock_resultante: 2, motivo: null, referencia: null, anula_a: null,
    creado_por: "u1", creado_at: "2026-11-06T10:00:00.000Z", anulado: false, creadorNombre: "Beto", ...o,
  });

  it("una venta dice quién, cuánto y cómo quedó el stock", () => {
    const e = describirMovimiento(mov({}));
    expect(e.titulo).toBe("Vendió Caribe 550 (−1)");
    expect(e.detalle).toContain("Quedó en 2");
    expect(e.quien).toBe("Beto");
  });

  it("un movimiento sin usuario es del Sistema", () => {
    const e = describirMovimiento(mov({ creado_por: null, creadorNombre: null, tipo: "apertura" }));
    expect(e.sistema).toBe(true);
    expect(e.quien).toBe("Sistema");
  });

  it("ordena del más nuevo al más viejo y filtra por área y por persona o sistema", () => {
    const a = describirMovimiento(mov({ id: "1", creado_at: "2026-11-01T00:00:00.000Z" }));
    const b = describirMovimiento(mov({ id: "2", creado_at: "2026-11-02T00:00:00.000Z", creado_por: null, creadorNombre: null }));
    const todos = ordenarEventos([a, b]);
    expect(todos.map((e) => e.id)).toEqual(["m2", "m1"]);
    expect(filtrarEventos(todos, { area: "", quien: "sistema" }).map((e) => e.id)).toEqual(["m2"]);
    expect(filtrarEventos(todos, { area: "", quien: "personas" }).map((e) => e.id)).toEqual(["m1"]);
    expect(filtrarEventos(todos, { area: "precios", quien: "todos" })).toHaveLength(0);
  });
});
