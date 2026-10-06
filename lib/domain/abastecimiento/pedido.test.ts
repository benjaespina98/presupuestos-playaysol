import { describe, expect, it } from "vitest";
import type { Material } from "./material";
import type { Proveedor } from "./proveedor";
import {
  PARAMETROS_POR_DEFECTO,
  armarPedido,
  cantidadDePedido,
  csvPedido,
  factorDeAplica,
  mensajeDeGrupo,
  mensajeWhatsApp,
  type ParametrosPedido,
} from "./pedido";

// Datos inventados: el repo es público y los costos reales no van acá.
const proveedor = (o: Partial<Proveedor>): Proveedor => ({
  id: "p1",
  nombre: "Corralón Uno",
  rubro: null,
  contacto: null,
  telefono: "+54 9 111 111",
  forma_pago: null,
  plazo: null,
  notas: null,
  activo: true,
  orden: 1,
  updated_at: "2026-01-01T00:00:00.000Z",
  ...o,
});

const material = (o: Partial<Material>): Material => ({
  id: "m1",
  nombre: "Material",
  proveedor_id: "p1",
  unidad: "unidad",
  precio: 100,
  precio_actualizado: null,
  rubro: "Materiales",
  aplica: "Siempre",
  usd_ref: null,
  notas: null,
  cantidades: { "8x4": 10 },
  activo: true,
  orden: 1,
  updated_at: "2026-01-01T00:00:00.000Z",
  ...o,
});

const params = (o: Partial<ParametrosPedido> = {}): ParametrosPedido => ({ ...PARAMETROS_POR_DEFECTO, ...o });

describe("factorDeAplica", () => {
  it("Siempre y cualquier valor desconocido (o vacío) van en todas las obras", () => {
    expect(factorDeAplica("Siempre", params())).toBe(1);
    expect(factorDeAplica(null, params())).toBe(1);
    expect(factorDeAplica("algo raro", params())).toBe(1);
  });

  it("Losetas y Deck dependen del borde elegido", () => {
    expect(factorDeAplica("Losetas", params({ borde: "Losetas" }))).toBe(1);
    expect(factorDeAplica("Losetas", params({ borde: "Deck" }))).toBe(0);
    expect(factorDeAplica("Deck", params({ borde: "Deck" }))).toBe(1);
    expect(factorDeAplica("Deck", params({ borde: "Losetas" }))).toBe(0);
  });

  it("Luz es una por cada luz; Luz (fija) es una sola si hay luces", () => {
    expect(factorDeAplica("Luz", params({ luces: 3 }))).toBe(3);
    expect(factorDeAplica("Luz", params({ luces: 0 }))).toBe(0);
    expect(factorDeAplica("Luz (fija)", params({ luces: 3 }))).toBe(1);
    expect(factorDeAplica("Luz (fija)", params({ luces: 0 }))).toBe(0);
  });

  it("la luz de la cama de agua y el baño químico son opcionales", () => {
    expect(factorDeAplica("Luz cama de agua", params({ luzCamaAgua: true }))).toBe(1);
    expect(factorDeAplica("Luz cama de agua", params())).toBe(0);
    expect(factorDeAplica("Baño químico", params({ banoQuimico: true }))).toBe(1);
    expect(factorDeAplica("Baño químico", params())).toBe(0);
  });

  it("la luz fija NO depende de la luz de la cama de agua (como en la planilla)", () => {
    expect(factorDeAplica("Luz (fija)", params({ luces: 0, luzCamaAgua: true }))).toBe(0);
  });

  it("una cantidad de luces inválida no rompe: cuenta como 0", () => {
    expect(factorDeAplica("Luz", params({ luces: Number.NaN }))).toBe(0);
    expect(factorDeAplica("Luz", params({ luces: -2 }))).toBe(0);
  });
});

describe("cantidadDePedido", () => {
  it("toma la cantidad del tamaño elegido y la multiplica por las obras", () => {
    const m = material({ cantidades: { "8x4": 90, "5x3": 50 } });
    expect(cantidadDePedido(m, params({ tamano: "8x4" }))).toBe(90);
    expect(cantidadDePedido(m, params({ tamano: "5x3" }))).toBe(50);
    expect(cantidadDePedido(m, params({ tamano: "8x4", obras: 3 }))).toBe(270);
  });

  it("menos de 1 obra (o inválido) cuenta como 1, igual que la planilla", () => {
    const m = material({ cantidades: { "8x4": 10 } });
    expect(cantidadDePedido(m, params({ obras: 0 }))).toBe(10);
    expect(cantidadDePedido(m, params({ obras: Number.NaN }))).toBe(10);
  });

  it("multiplica por el factor de 'Aplica'", () => {
    const luz = material({ aplica: "Luz", cantidades: { "8x4": 1 } });
    expect(cantidadDePedido(luz, params({ luces: 3 }))).toBe(3);
    expect(cantidadDePedido(luz, params({ luces: 3, obras: 2 }))).toBe(6);
  });

  it("0 si el tamaño no tiene cantidad cargada, es 0, o no es un tamaño conocido", () => {
    const m = material({ cantidades: { "8x4": 10, "5x3": 0 } });
    expect(cantidadDePedido(m, params({ tamano: "9x4" }))).toBe(0);
    expect(cantidadDePedido(m, params({ tamano: "5x3" }))).toBe(0);
    expect(cantidadDePedido(m, params({ tamano: "12x12" }))).toBe(0);
  });

  it("redondea a 2 decimales", () => {
    expect(cantidadDePedido(material({ cantidades: { "8x4": 0.333 } }), params({ obras: 3 }))).toBe(1);
    expect(cantidadDePedido(material({ cantidades: { "8x4": 2.456 } }), params())).toBe(2.46);
  });
});

describe("armarPedido", () => {
  const proveedores = [
    proveedor({ id: "p2", nombre: "Filtros SA", telefono: null, orden: 2 }),
    proveedor({ id: "p1", nombre: "Corralón Uno", orden: 1 }),
  ];

  it("agrupa por proveedor en el orden de la lista de proveedores, y los sin proveedor al final", () => {
    const pedido = armarPedido(
      [
        material({ id: "a", nombre: "Filtro", proveedor_id: "p2", orden: 1 }),
        material({ id: "b", nombre: "Cemento", proveedor_id: "p1", orden: 2 }),
        material({ id: "c", nombre: "Suelto", proveedor_id: null, orden: 3 }),
        material({ id: "d", nombre: "Hierro", proveedor_id: "p1", orden: 1 }),
      ],
      proveedores,
      params()
    );

    expect(pedido.grupos.map((g) => g.nombre)).toEqual(["Corralón Uno", "Filtros SA", "Sin proveedor"]);
    expect(pedido.grupos[0].lineas.map((l) => l.material.nombre)).toEqual(["Hierro", "Cemento"]);
  });

  it("suma el costo y cuenta artículos y proveedores a contactar (sin contar 'Sin proveedor')", () => {
    const pedido = armarPedido(
      [
        material({ id: "a", proveedor_id: "p1", precio: 100, cantidades: { "8x4": 10 } }),
        material({ id: "b", proveedor_id: "p2", precio: 2.5, cantidades: { "8x4": 4 }, orden: 2 }),
        material({ id: "c", proveedor_id: null, precio: 1, cantidades: { "8x4": 1 }, orden: 3 }),
      ],
      proveedores,
      params()
    );

    expect(pedido.costo).toBe(1011); // 1000 + 10 + 1
    expect(pedido.articulos).toBe(3);
    expect(pedido.proveedores).toBe(2);
    expect(pedido.grupos[0].subtotal).toBe(1000);
  });

  it("un precio a confirmar no suma, pero se cuenta aparte", () => {
    const pedido = armarPedido(
      [material({ id: "a", precio: null }), material({ id: "b", precio: 50, cantidades: { "8x4": 2 }, orden: 2 })],
      proveedores,
      params()
    );
    expect(pedido.costo).toBe(100);
    expect(pedido.sinPrecio).toBe(1);
    expect(pedido.articulos).toBe(2);
  });

  it("deja afuera lo dado de baja y lo que no va en este pedido (otro borde, sin luces)", () => {
    const pedido = armarPedido(
      [
        material({ id: "a", nombre: "Siempre" }),
        material({ id: "b", nombre: "De baja", activo: false, orden: 2 }),
        material({ id: "c", nombre: "Deck", aplica: "Deck", orden: 3 }),
        material({ id: "d", nombre: "Losetas", aplica: "Losetas", orden: 4 }),
        material({ id: "e", nombre: "Luz", aplica: "Luz", orden: 5 }),
      ],
      proveedores,
      params({ borde: "Losetas", luces: 0 })
    );
    expect(pedido.grupos.flatMap((g) => g.lineas.map((l) => l.material.nombre))).toEqual(["Siempre", "Losetas"]);
  });

  it("cambiar el borde cambia qué se pide", () => {
    const mats = [
      material({ id: "c", nombre: "Deck", aplica: "Deck" }),
      material({ id: "d", nombre: "Losetas", aplica: "Losetas", orden: 2 }),
    ];
    const nombres = (b: "Losetas" | "Deck") =>
      armarPedido(mats, proveedores, params({ borde: b })).grupos.flatMap((g) => g.lineas.map((l) => l.material.nombre));
    expect(nombres("Losetas")).toEqual(["Losetas"]);
    expect(nombres("Deck")).toEqual(["Deck"]);
  });

  it("un ajuste a mano cambia la cantidad (y el subtotal) pero conserva la calculada", () => {
    const pedido = armarPedido([material({ id: "a", precio: 10, cantidades: { "8x4": 5 } })], proveedores, params(), {
      a: { cantidad: 8 },
    });
    const l = pedido.grupos[0].lineas[0];
    expect(l.cantidad).toBe(8);
    expect(l.calculada).toBe(5);
    expect(l.subtotal).toBe(80);
    expect(pedido.costo).toBe(80);
  });

  it("un material excluido a mano sale del pedido; una cantidad inválida se ignora", () => {
    const mats = [material({ id: "a" }), material({ id: "b", nombre: "Otro", orden: 2 })];
    expect(armarPedido(mats, proveedores, params(), { a: { excluido: true } }).articulos).toBe(1);
    const invalido = armarPedido(mats, proveedores, params(), { a: { cantidad: Number.NaN } });
    expect(invalido.grupos[0].lineas[0].cantidad).toBe(10);
  });

  it("un proveedor sin teléfono (o con '—') sale sin teléfono; un proveedor dado de baja igual agrupa", () => {
    const pedido = armarPedido(
      [material({ id: "a", proveedor_id: "p2" })],
      [proveedor({ id: "p2", nombre: "Viejo", telefono: "—", activo: false })],
      params()
    );
    expect(pedido.grupos[0].nombre).toBe("Viejo");
    expect(pedido.grupos[0].telefono).toBeNull();
  });

  it("sin materiales o sin cantidades para ese tamaño, el pedido queda vacío", () => {
    const vacio = armarPedido([], proveedores, params());
    expect(vacio).toEqual({ grupos: [], articulos: 0, proveedores: 0, costo: 0, sinPrecio: 0 });
    expect(armarPedido([material({})], proveedores, params({ tamano: "10x4" })).articulos).toBe(0);
  });
});

describe("mensajeWhatsApp", () => {
  const proveedores = [proveedor({ id: "p1", nombre: "Corralón Uno", telefono: "+54 9 111 111" })];
  const materiales = [
    material({ id: "a", nombre: "Hierro del 6", cantidades: { "8x4": 90 } }),
    material({ id: "b", nombre: "Cemento 25 kg", unidad: "bolsa", cantidades: { "8x4": 180 }, orden: 2 }),
  ];

  it("arma el mensaje con el formato de la planilla: la unidad 'unidad' se omite", () => {
    const p = params();
    const msg = mensajeWhatsApp(armarPedido(materiales, proveedores, p), p, { obra: "Familia Pérez", pide: "Benja" });

    expect(msg).toBe(
      [
        "*PEDIDO DE MATERIALES — Playa & Sol*",
        "Obra: Familia Pérez · Pileta 8x4",
        "Borde: Losetas",
        "Pide: Benja",
        "",
        "*Corralón Uno* · +54 9 111 111",
        "- Hierro del 6: 90",
        "- Cemento 25 kg: 180 bolsa",
      ].join("\n")
    );
  });

  it("sin obra ni quien pide: 'Pileta 8x4' y 'Pide: ________'", () => {
    const p = params();
    const msg = mensajeWhatsApp(armarPedido(materiales, proveedores, p), p, { obra: "  ", pide: "" });
    expect(msg).toContain("Obra: Pileta 8x4\n");
    expect(msg).toContain("Pide: ________");
  });

  it("incluye las obras, las luces y los opcionales elegidos", () => {
    const p = params({ obras: 2, luces: 3, luzCamaAgua: true, banoQuimico: true, borde: "Deck" });
    const msg = mensajeWhatsApp(armarPedido(materiales, proveedores, p), p, { obra: "", pide: "" });
    expect(msg).toContain("Pileta 8x4 · 2 obras");
    expect(msg).toContain("Borde: Deck");
    expect(msg).toContain("Luces: 3 · Luz en la cama de agua · Baño químico");
  });

  it("los decimales van con coma", () => {
    const p = params();
    const g = armarPedido([material({ unidad: "m³", cantidades: { "8x4": 2.5 } })], proveedores, p).grupos[0];
    expect(mensajeDeGrupo(g)).toContain("- Material: 2,5 m³");
  });

  it("sin teléfono no pone el ' · '", () => {
    const p = params();
    const g = armarPedido([material({ proveedor_id: null })], proveedores, p).grupos[0];
    expect(mensajeDeGrupo(g).split("\n")[0]).toBe("*Sin proveedor*");
  });
});

describe("csvPedido", () => {
  const proveedores = [proveedor({ id: "p1", nombre: "Corralón; Uno", telefono: "+54 9 111 111" })];

  it("empieza con BOM, separa con ';', usa coma decimal y cierra con el costo estimado", () => {
    const csv = csvPedido(
      armarPedido([material({ id: "a", nombre: 'Cemento "25 kg"', unidad: "bolsa", precio: 6461.17, cantidades: { "8x4": 2 } })], proveedores, params())
    );
    const filas = csv.slice(1).split("\r\n");

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(filas[0]).toBe("Proveedor;Teléfono;Artículo;Cantidad;Unidad;Precio unitario;Subtotal");
    expect(filas[1]).toBe('"Corralón; Uno";+54 9 111 111;"Cemento ""25 kg""";2;bolsa;6461,17;12922,34');
    expect(filas[2]).toBe(";;;;;COSTO ESTIMADO;12922,34");
  });

  it("un precio a confirmar sale como 'A confirmar' y sin subtotal", () => {
    const csv = csvPedido(armarPedido([material({ precio: null })], proveedores, params()));
    expect(csv.split("\r\n")[1]).toContain(";A confirmar;");
  });
});

describe("csvPedido · sin precios", () => {
  it("deja sólo proveedor, teléfono, artículo, cantidad y unidad (sin precio, subtotal ni costo)", () => {
    const pedido = armarPedido(
      [material({ id: "a", nombre: "Hierro", precio: 100, cantidades: { "8x4": 10 } })],
      [proveedor({ id: "p1", nombre: "Corralón", telefono: "123" })],
      params()
    );
    const csv = csvPedido(pedido, false);
    expect(csv).not.toMatch(/Precio|Subtotal|COSTO/);
    expect(csv).toMatch(/Proveedor;Teléfono;Artículo;Cantidad;Unidad/);
    expect(csvPedido(pedido)).toMatch(/Precio unitario/);
  });
});
