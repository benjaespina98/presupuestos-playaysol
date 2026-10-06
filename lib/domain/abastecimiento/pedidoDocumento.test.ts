import { describe, expect, it } from "vitest";
import type { Material } from "./material";
import type { Proveedor } from "./proveedor";
import { PARAMETROS_POR_DEFECTO, armarPedido } from "./pedido";
import {
  LineaGuardada,
  PedidoGuardado,
  armarDocumento,
  condicionesDeObra,
  fechaDocumento,
  lineasDePedido,
  nombreArchivoPedido,
  numeroFormateado,
  paraArchivo,
  separarPorProveedor,
  type LineaGuardada as Linea,
} from "./pedidoDocumento";

// Datos inventados (el repo es público).
const proveedor = (o: Partial<Proveedor>): Proveedor => ({
  id: "p1", nombre: "Corralón Uno", rubro: null, contacto: "Juan", telefono: "+54 9 111 111", forma_pago: null,
  plazo: null, notas: null, activo: true, orden: 1, updated_at: "", ...o,
});
const material = (o: Partial<Material>): Material => ({
  id: "m1", nombre: "Hierro", proveedor_id: "p1", unidad: "unidad", precio: 100, precio_actualizado: null,
  rubro: null, aplica: "Siempre", usd_ref: null, notas: null, cantidades: { "8x4": 10 }, activo: true, orden: 1,
  updated_at: "", ...o,
});

const linea = (o: Partial<Linea>): Linea => ({
  material_id: "m1", nombre: "Hierro", unidad: "unidad", cantidad: 10, precio: 100, subtotal: 1000,
  proveedor_id: "p1", proveedor: "Corralón Uno", contacto: "Juan", telefono: "+54 9 111 111", ...o,
});

const datos = (o = {}) => ({
  numero: 7, fecha: new Date(2026, 9, 5), obra: "Familia Pérez", solicitante: "Benja",
  parametros: PARAMETROS_POR_DEFECTO, ...o,
});

describe("numeroFormateado", () => {
  it("PED-0007 con ceros; sin número es BORRADOR", () => {
    expect(numeroFormateado(7)).toBe("PED-0007");
    expect(numeroFormateado(12345)).toBe("PED-12345");
    expect(numeroFormateado(null)).toBe("BORRADOR");
    expect(numeroFormateado(undefined)).toBe("BORRADOR");
    expect(numeroFormateado(Number.NaN)).toBe("BORRADOR");
  });
});

describe("fechaDocumento", () => {
  it("dd/mm/aaaa con ceros", () => {
    expect(fechaDocumento(new Date(2026, 0, 5))).toBe("05/01/2026");
    expect(fechaDocumento(new Date(2026, 9, 25))).toBe("25/10/2026");
  });
});

describe("condicionesDeObra", () => {
  it("siempre pileta y borde; el resto sólo si se eligió", () => {
    expect(condicionesDeObra(PARAMETROS_POR_DEFECTO)).toEqual(["Pileta 8x4", "Borde: Losetas"]);
    expect(
      condicionesDeObra({ ...PARAMETROS_POR_DEFECTO, obras: 2, luces: 3, luzCamaAgua: true, banoQuimico: true, borde: "Deck" })
    ).toEqual(["Pileta 8x4 · 2 obras", "Borde: Deck", "Luces: 3", "Luz en la cama de agua", "Baño químico"]);
  });
});

describe("lineasDePedido", () => {
  const proveedores = [proveedor({}), proveedor({ id: "p2", nombre: "Filtros SA", contacto: null, telefono: null, orden: 2 })];
  const pedido = armarPedido(
    [
      material({ id: "a", nombre: "Hierro", cantidades: { "8x4": 10 } }),
      material({ id: "b", nombre: "Filtro", proveedor_id: "p2", precio: null, orden: 2, cantidades: { "8x4": 1 } }),
      material({ id: "c", nombre: "Suelto", proveedor_id: null, orden: 3, cantidades: { "8x4": 2 } }),
    ],
    proveedores,
    PARAMETROS_POR_DEFECTO
  );

  it("aplana el pedido con los datos del proveedor adentro", () => {
    const l = lineasDePedido(pedido);
    expect(l.map((x) => [x.nombre, x.proveedor, x.cantidad])).toEqual([
      ["Hierro", "Corralón Uno", 10],
      ["Filtro", "Filtros SA", 1],
      ["Suelto", "Sin proveedor", 2],
    ]);
    expect(l[0]).toMatchObject({ contacto: "Juan", telefono: "+54 9 111 111", proveedor_id: "p1", subtotal: 1000 });
    expect(l[1]).toMatchObject({ precio: null, telefono: null, contacto: null });
    expect(l[2].proveedor_id).toBeNull();
  });

  it("cada línea guardada valida contra el esquema (es lo que viaja a la base)", () => {
    for (const l of lineasDePedido(pedido)) expect(LineaGuardada.safeParse(l).success).toBe(true);
  });
});

describe("armarDocumento", () => {
  const lineas = [
    linea({ material_id: "a", nombre: "Hierro", cantidad: 10, precio: 100, subtotal: 1000 }),
    linea({ material_id: "b", nombre: "Cemento", unidad: "bolsa", cantidad: 20, precio: 50, subtotal: 1000 }),
    linea({ material_id: "c", nombre: "Filtro", proveedor_id: "p2", proveedor: "Filtros SA", contacto: null, telefono: null, precio: null, subtotal: 0, cantidad: 1 }),
    linea({ material_id: "d", nombre: "Bomba", proveedor_id: "p2", proveedor: "Filtros SA", contacto: null, telefono: null, precio: 300, subtotal: 300, cantidad: 1 }),
  ];

  it("agrupa por proveedor en el orden de aparición, con subtotal por proveedor y total", () => {
    const d = armarDocumento(lineas, datos());
    expect(d.proveedores.map((p) => p.nombre)).toEqual(["Corralón Uno", "Filtros SA"]);
    expect(d.proveedores[0].subtotal).toBe(2000);
    expect(d.proveedores[1].subtotal).toBe(300); // el que no tiene precio no suma
    expect(d.total).toBe(2300);
    expect(d.articulos).toBe(4);
  });

  it("marca lo que está a confirmar (precio y subtotal null) y lo cuenta", () => {
    const d = armarDocumento(lineas, datos());
    const filtro = d.proveedores[1].lineas[0];
    expect(filtro).toMatchObject({ descripcion: "Filtro", precio: null, subtotal: null });
    expect(d.proveedores[1].sinPrecio).toBe(1);
    expect(d.sinPrecio).toBe(1);
  });

  it("lleva número, fecha, obra, solicitante y condiciones", () => {
    const d = armarDocumento(lineas, datos());
    expect(d).toMatchObject({ numero: "PED-0007", fecha: "05/10/2026", obra: "Familia Pérez", solicitante: "Benja" });
    expect(d.condiciones).toEqual(["Pileta 8x4", "Borde: Losetas"]);
  });

  it("sin guardar es BORRADOR; el texto libre se recorta", () => {
    const d = armarDocumento(lineas, datos({ numero: null, obra: "  Pérez  ", observaciones: "  Entregar temprano  " }));
    expect(d.numero).toBe("BORRADOR");
    expect(d.obra).toBe("Pérez");
    expect(d.observaciones).toBe("Entregar temprano");
  });

  it("dos 'sin proveedor' o dos proveedores homónimos no se mezclan por error: se agrupa por id", () => {
    const d = armarDocumento(
      [linea({ proveedor_id: "x1", proveedor: "Igual" }), linea({ material_id: "z", proveedor_id: "x2", proveedor: "Igual" })],
      datos()
    );
    expect(d.proveedores).toHaveLength(2);
  });

  it("un pedido vacío da un documento vacío, sin romper", () => {
    const d = armarDocumento([], datos());
    expect(d).toMatchObject({ proveedores: [], total: 0, articulos: 0, sinPrecio: 0 });
  });
});

describe("separarPorProveedor", () => {
  const d = armarDocumento(
    [
      linea({ nombre: "Hierro", cantidad: 10, precio: 100, subtotal: 1000 }),
      linea({ material_id: "c", nombre: "Filtro", proveedor_id: "p2", proveedor: "Filtros SA", precio: null, subtotal: 0, cantidad: 1 }),
    ],
    datos()
  );

  it("da un documento por proveedor, con el mismo número y sus propios totales", () => {
    const partes = separarPorProveedor(d);
    expect(partes).toHaveLength(2);
    expect(partes.map((p) => p.numero)).toEqual(["PED-0007", "PED-0007"]);
    expect(partes[0]).toMatchObject({ total: 1000, articulos: 1, sinPrecio: 0 });
    expect(partes[0].proveedores.map((p) => p.nombre)).toEqual(["Corralón Uno"]);
    expect(partes[1]).toMatchObject({ total: 0, articulos: 1, sinPrecio: 1 });
  });

  it("no modifica el documento original", () => {
    separarPorProveedor(d);
    expect(d.proveedores).toHaveLength(2);
  });
});

describe("nombres de archivo", () => {
  const d = armarDocumento([linea({})], datos());

  it("paraArchivo saca tildes y símbolos", () => {
    expect(paraArchivo("Áridos y excavación")).toBe("Aridos_y_excavacion");
    expect(paraArchivo('AGUAS línea CEMEX (PVC) / "x"')).toBe("AGUAS_linea_CEMEX_PVC_x");
  });

  it("el del pedido completo lleva el número y la obra; el de un proveedor, el proveedor", () => {
    expect(nombreArchivoPedido(d, "pdf")).toBe("Pedido_PED-0007_Familia_Perez.pdf");
    expect(nombreArchivoPedido(d, "xlsx", "Ranco Materiales")).toBe("Pedido_PED-0007_Ranco_Materiales.xlsx");
  });

  it("sin obra queda sólo el número", () => {
    expect(nombreArchivoPedido(armarDocumento([linea({})], datos({ obra: "" })), "pdf")).toBe("Pedido_PED-0007.pdf");
  });

  it("un borrador se nota en el nombre", () => {
    expect(nombreArchivoPedido(armarDocumento([linea({})], datos({ numero: null })), "pdf")).toBe("Pedido_BORRADOR_Familia_Perez.pdf");
  });
});

describe("PedidoGuardado", () => {
  it("valida un pedido como lo devuelve la base y rechaza un estado inventado", () => {
    const base = {
      id: "x", numero: 1, obra: "", solicitante: "", parametros: PARAMETROS_POR_DEFECTO, lineas: [linea({})],
      costo: 1000, estado: "borrador", notas: null, created_at: "2026-10-05T00:00:00Z", updated_at: "2026-10-05T00:00:00Z",
    };
    expect(PedidoGuardado.safeParse(base).success).toBe(true);
    expect(PedidoGuardado.safeParse({ ...base, estado: "perdido" }).success).toBe(false);
  });
});
