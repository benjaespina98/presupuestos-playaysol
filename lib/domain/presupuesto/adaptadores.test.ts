import { describe, expect, it } from "vitest";
import { leerPresupuesto, paraDuplicar } from "./adaptadores";
import { PresupuestoV1, tienePreciosCongelados, versionDe } from "./v1";
import { crearLinea } from "../precios/tipos";

/**
 * Tests de contrato de los adaptadores.
 *
 * Los objetos v0 de acá están copiados de la forma que produce
 * `quoteToPlainState()` en cada -calc.js — verificada archivo por archivo, no
 * inventada. Si alguno deja de leerse, es que un presupuesto real dejaría de
 * abrirse, que es el riesgo más caro de toda la migración.
 */

/* Forma real de un presupuesto de cercos guardado hoy. */
const V0_CERCOS = {
  fecha: "20/08/2026",
  cliente: "Pérez, María José",
  domicilio: "Av. Siempreviva 742",
  localidad: "Villa María",
  tel: "353 400-0000",
  email: "maria@ejemplo.com",
  dimension: "Perímetro completo de la piscina.",
  validez: "7",
  subtotal: 0,
  ml: 24,
  modoPrecio: "ambos",
  items: [{ id: "iabc123", desc: "Traslado", price: 350000 }],
  opcionalesIncluidos: ["porton_reforzado"],
  fotos: [
    {
      id: "ifoto01",
      caption: "Frente",
      width: 1200,
      height: 900,
      storageUrl: "https://x.supabase.co/storage/v1/object/public/presupuestos/cercos/a.jpg",
    },
  ],
  headerVariant: "navy",
};

/* Revestimientos guardado por una versión vieja de la pantalla: tiene
   `profundidad` (el promedio) pero todavía no profMin/profMax. */
const V0_REVESTIMIENTOS_VIEJO = {
  fecha: "01/03/2026",
  cliente: "Gómez",
  domicilio: "",
  localidad: "",
  tel: "",
  email: "",
  dimension: "",
  validez: "7",
  largo: 8,
  ancho: 4,
  profundidad: 1.5,
  escalera: 3,
  desperdicio: 2,
  m2Items: [{ label: "Escalón extra", m2: 1.5 }],
  items: [],
  opcionalesIncluidos: ["revestimiento_ceramico_bali"],
  fotos: [],
  headerVariant: "teal",
};

describe("leerPresupuesto · formato viejo (v0)", () => {
  it("abre un presupuesto de cercos guardado hoy", () => {
    const r = leerPresupuesto("cercos", V0_CERCOS);

    expect(r.preciosCongelados).toBe(false);
    expect(r.presupuesto.v).toBe(1);
    expect(r.presupuesto.tipo).toBe("cercos");
    expect(r.presupuesto.cliente.nombre).toBe("Pérez, María José");
    expect(r.presupuesto.cliente.telefono).toBe("353 400-0000");
    expect(r.presupuesto.medidas).toEqual({ metrosLineales: 24 });
    expect(r.presupuesto.detalle).toBe("Perímetro completo de la piscina.");
    expect(r.presupuesto.modoPrecio).toBe("ambos");
    expect(r.presupuesto.variacionEncabezado).toBe("navy");
  });

  it("conserva las fotos con su referencia a Storage", () => {
    const r = leerPresupuesto("cercos", V0_CERCOS);
    expect(r.presupuesto.fotos).toHaveLength(1);
    expect(r.presupuesto.fotos[0].storageUrl).toContain("/presupuestos/cercos/a.jpg");
    expect(r.presupuesto.fotos[0].caption).toBe("Frente");
  });

  it("rescata qué opcionales estaban marcados, que es lo único que v0 guardó", () => {
    const r = leerPresupuesto("cercos", V0_CERCOS);
    expect(r.clavesIncluidas).toEqual(["porton_reforzado"]);
  });

  it("no inventa precios: los deja vacíos para que el llamador los rehidrate", () => {
    const r = leerPresupuesto("cercos", V0_CERCOS);
    expect(r.presupuesto.lineas).toEqual([]);
    expect(r.presupuesto.preciosBase).toEqual({});
    expect(r.presupuesto.totales).toEqual([]);
  });

  it("usa `profundidad` como profundidad pareja si no hay profMin/profMax", () => {
    const r = leerPresupuesto("revestimientos", V0_REVESTIMIENTOS_VIEJO);
    expect(r.presupuesto.medidas).toMatchObject({
      largo: 8,
      ancho: 4,
      profMin: 1.5,
      profMax: 0,
      escalera: 3,
      desperdicio: 2,
      adicionalesM2: [1.5],
    });
  });

  it("traduce las medidas de losetas a los nombres del motor nuevo", () => {
    const r = leerPresupuesto("losetas", {
      largo: 8,
      ancho: 4,
      inc: 0.5,
      solar: 1,
      opuesto: 1,
      lateral1: 1,
      lateral2: 1,
    });
    expect(r.presupuesto.medidas).toEqual({
      largo: 8,
      ancho: 4,
      bordeIncluido: 0.5,
      solar: 1,
      opuesto: 1,
      lateral1: 1,
      lateral2: 1,
      solarHumedo: false,
      solarHumedoAncho: 0,
      escalera: false,
      escaleraPos: "solar",
      tipoPileta: "hormigon",
      labios: 0.2,
      luces: false,
      cantLuces: 0,
      lucesPos: [],
      revestimiento: "",
      revestimientoOtro: "",
      colorAgua: "#A6D1EC",
      colorLoseta: "#F7E6D3",
      lblSolar: "Solar",
      lblOpuesto: "Opuesto",
      lblLateral1: "Lateral 1",
      lblLateral2: "Lateral 2",
    });
  });

  it("losetas: rescata el resto del plano guardado (colores, luces, escalera, revestimiento)", () => {
    const r = leerPresupuesto("losetas", {
      nombre: "Gómez",
      largo: 8,
      ancho: 4,
      inc: 0.5,
      solar: 1,
      opuesto: 1,
      lateral1: 1,
      lateral2: 1,
      solarHumedo: true,
      solarHumedoAncho: 1.2,
      escalera: true,
      escaleraPos: "opuesto",
      tipoPileta: "fibra",
      labios: 0.25,
      luces: true,
      cantLuces: 2,
      lucesPos: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }],
      revestimiento: "travertino",
      colorAgua: "#123456",
      colorLoseta: "#abcdef",
      lblSolar: "Frente",
    });
    expect(r.presupuesto.cliente.nombre).toBe("Gómez");
    expect(r.presupuesto.medidas).toMatchObject({
      solarHumedo: true,
      solarHumedoAncho: 1.2,
      escalera: true,
      escaleraPos: "opuesto",
      tipoPileta: "fibra",
      labios: 0.25,
      luces: true,
      cantLuces: 2,
      lucesPos: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }],
      revestimiento: "travertino",
      colorAgua: "#123456",
      colorLoseta: "#abcdef",
      lblSolar: "Frente",
    });
  });

  it("losetas: el cliente usa `nombre`, no `cliente` — y no arrastra campos que losetas nunca tuvo", () => {
    // Único caso entre las 5: las otras calculadoras guardan el nombre en
    // `cliente`. Si algún día alguien confunde las claves acá, el nombre del
    // cliente desaparece silenciosamente al reabrir un plano viejo.
    const r = leerPresupuesto("losetas", {
      nombre: "Pérez, María José",
      cliente: "esto no debería leerse para losetas",
      domicilio: "Rivadavia 123",
      tel: "3534000000",
    });
    expect(r.presupuesto.cliente).toEqual({
      nombre: "Pérez, María José",
      domicilio: "",
      localidad: "",
      telefono: "",
      email: "",
    });
  });

  it("losetas: revestimientoOtro y las etiquetas de los cuatro lados se recuperan completas", () => {
    const r = leerPresupuesto("losetas", {
      revestimiento: "otro",
      revestimientoOtro: "Gresite azul",
      lblSolar: "Frente",
      lblOpuesto: "Fondo",
      lblLateral1: "Izquierda",
      lblLateral2: "Derecha",
    });
    expect(r.presupuesto.medidas).toMatchObject({
      revestimiento: "otro",
      revestimientoOtro: "Gresite azul",
      lblSolar: "Frente",
      lblOpuesto: "Fondo",
      lblLateral1: "Izquierda",
      lblLateral2: "Derecha",
    });
  });

  it("losetas: un valor de enum corrupto/desconocido cae al default en vez de colarse tal cual", () => {
    const r = leerPresupuesto("losetas", {
      escaleraPos: "un-valor-que-no-existe",
      tipoPileta: "un-valor-que-no-existe",
      revestimiento: "un-valor-que-no-existe",
    });
    expect(r.presupuesto.medidas).toMatchObject({
      escaleraPos: "solar",
      tipoPileta: "hormigon",
      revestimiento: "",
    });
  });

  it("losetas: lucesPos con elementos corruptos no rompe la lectura", () => {
    const r = leerPresupuesto("losetas", {
      luces: true,
      cantLuces: 2,
      lucesPos: [{ x: "no es un número", y: null }, "esto ni siquiera es un objeto", { x: 0.4, y: 0.5 }],
    });
    expect(r.presupuesto.medidas.lucesPos).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0.4, y: 0.5 },
    ]);
  });

  it("aguanta un presupuesto incompleto sin romperse", () => {
    // Filas viejas, guardadas antes de que existieran algunos campos.
    for (const datos of [{}, null, { cliente: "X" }, { fotos: "no es un array" }]) {
      const r = leerPresupuesto("piscinas", datos);
      expect(r.presupuesto.v).toBe(1);
      expect(r.preciosCongelados).toBe(false);
      expect(r.presupuesto.fotos).toEqual([]);
    }
  });
});

describe("leerPresupuesto · formato nuevo (v1)", () => {
  const v1 = PresupuestoV1.parse({
    v: 1,
    tipo: "cercos",
    fecha: "20/08/2026",
    validezDias: "7",
    cliente: { nombre: "Pérez", domicilio: "", localidad: "", telefono: "", email: "" },
    medidas: { metrosLineales: 24 },
    lineas: [
      crearLinea({
        clave: "precioSin",
        descripcion: "Cerco sin instalación",
        unidad: "ml",
        cantidad: 24,
        precioUnitario: 63500,
        naturaleza: "cotiza",
        incluida: true,
        origen: "catalogo",
      }),
    ],
    preciosBase: { precioSin: 63500, precioCon: 79500 },
    totales: [1524000, 1908000],
    detalle: "",
  });

  it("devuelve los precios congelados tal cual", () => {
    const r = leerPresupuesto("cercos", v1);
    expect(r.preciosCongelados).toBe(true);
    expect(r.presupuesto.totales).toEqual([1524000, 1908000]);
    expect(r.presupuesto.lineas[0].precioUnitario).toBe(63500);
    expect(r.presupuesto.lineas[0].total).toBe(1524000);
  });

  it("un cambio posterior en el catálogo no lo toca", () => {
    // Se simula que el catálogo subió el precio del metro a 80.000.
    const catalogoHoy = { precioSin: 80000 };
    const r = leerPresupuesto("cercos", v1);
    expect(r.presupuesto.preciosBase.precioSin).toBe(63500);
    expect(r.presupuesto.preciosBase.precioSin).not.toBe(catalogoHoy.precioSin);
  });
});

describe("duplicar toma los precios de hoy", () => {
  it("descarta preciosBase/totales, conserva cliente, medidas y lineas", () => {
    const original = leerPresupuesto("cercos", V0_CERCOS).presupuesto;
    const linea = crearLinea({
      clave: "x",
      descripcion: "algo",
      unidad: null,
      cantidad: 1,
      precioUnitario: 100,
      naturaleza: "cotiza",
      incluida: true,
      origen: "catalogo",
    });
    const conPrecios = PresupuestoV1.parse({
      ...original,
      preciosBase: { precioSin: 63500 },
      totales: [1524000],
      lineas: [linea],
    });

    const copia = paraDuplicar(conPrecios);

    expect(copia.preciosBase).toEqual({});
    expect(copia.totales).toEqual([]);
    // Lo que sí se conserva: cliente, medidas, detalle, y las líneas — para
    // que el vendedor arranque con los mismos adicionales/opcionales
    // tildados en vez de una hoja en blanco (ver comentario en
    // `paraDuplicar`). Los PRECIOS de esas líneas se recalculan solos
    // porque el llamador siempre trata un duplicado como "no congelado".
    expect(copia.cliente.nombre).toBe("Pérez, María José");
    expect(copia.medidas).toEqual({ metrosLineales: 24 });
    expect(copia.detalle).toBe("Perímetro completo de la piscina.");
    expect(copia.lineas).toEqual([linea]);
  });
});

describe("versionDe / tienePreciosCongelados", () => {
  it("distingue las dos versiones", () => {
    expect(versionDe({ v: 1 })).toBe(1);
    expect(versionDe({ ml: 24 })).toBe(0);
    expect(versionDe(null)).toBe(0);
    expect(versionDe(undefined)).toBe(0);
  });

  it("la interfaz puede saber si tiene que avisar que se recalculó", () => {
    expect(tienePreciosCongelados({ v: 1 })).toBe(true);
    expect(tienePreciosCongelados(V0_CERCOS)).toBe(false);
  });
});
