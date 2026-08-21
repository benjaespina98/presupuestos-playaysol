import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { calcularCerco, totalesAMostrar as totalesCerco, type ModoPrecio } from "./cercos";
import { calcularCobertor, totalesAMostrar as totalesCobertor } from "./cobertores";
import { calcularPiscina, importesAMostrar as importesPiscina } from "./piscinas";
import {
  calcularRevestimiento,
  importesAMostrar as importesRevestimiento,
} from "./revestimientos";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EL MOTOR NUEVO CONTRA LA FOTO DEL LEGACY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cada escenario de acá corresponde, POR NOMBRE, a un caso grabado en
 * tests/oracle/fixtures/. El oráculo grabó qué contesta la calculadora vieja;
 * este test verifica que la función pura nueva contesta exactamente lo mismo.
 *
 * Es la puerta de salida de la Fase 2: mientras un escenario no reproduzca su
 * fixture al peso, esa calculadora no se migra.
 *
 * Los nombres se comparan explícitamente: si alguien renombra un caso en
 * casos.ts sin tocar acá, el test avisa en vez de saltearlo en silencio.
 */

const FIXTURES = path.join(__dirname, "..", "..", "..", "tests", "oracle", "fixtures");

interface CasoFixture {
  nombre: string;
  montos: number[];
  calculados?: Record<string, string>;
}

function leerFixture(tipo: string): CasoFixture[] {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, `${tipo}.json`), "utf8")).casos;
}

/**
 * Compara importes a la precisión del dinero, no a la del punto flotante.
 *
 * Las fixtures guardan el número IMPRESO en el documento, que ya pasó por el
 * formateador. El motor devuelve el float crudo. Para 15,3 m² × 9.902 eso es
 * 151500.59999999998 contra 151500.6: la misma plata, distinta representación.
 *
 * Comparar con toEqual haría fallar la migración por un error de redondeo en el
 * decimal once, que no le cambia el precio a nadie. Se compara al centavo, que
 * es lo que efectivamente ve el cliente en el presupuesto.
 */
function esperarMontos(obtenidos: number[], esperados: number[], caso: string) {
  expect(obtenidos.length, `${caso}: cantidad de líneas de total`).toBe(esperados.length);
  obtenidos.forEach((monto, i) => {
    expect(monto, `${caso}: total #${i + 1}`).toBeCloseTo(esperados[i], 2);
  });
}

/** Precios por defecto que trae hardcodeado cada -calc.js. El oráculo graba con
 *  estos, porque corre sin el puente al catálogo compartido. */
const PRECIOS_CERCOS = {
  precioPorMlSinInstalacion: 63500,
  precioPorMlConInstalacion: 79500,
};
const PRECIOS_COBERTORES = {
  precioPorM2HastaUmbral: 10903,
  precioPorM2SobreUmbral: 9902,
  precioInstalacion: 100000,
};

/* ═══════════════════════════════ CERCOS ═══════════════════════════════ */

describe("calcularCerco reproduce el legacy", () => {
  const fixture = leerFixture("cercos");

  const ESCENARIOS: Record<string, { metrosLineales: number; modo: ModoPrecio }> = {
    "24 ml, ambos precios": { metrosLineales: 24, modo: "ambos" },
    "24 ml, solo sin instalación": { metrosLineales: 24, modo: "sin" },
    "24 ml, solo con instalación": { metrosLineales: 24, modo: "con" },
    "cero metros": { metrosLineales: 0, modo: "ambos" },
    "metros con decimales (18,5)": { metrosLineales: 18.5, modo: "ambos" },
    // Los opcionales no suman al total (punto 3 de reglas-de-negocio.md), así
    // que este caso tiene que dar exactamente lo mismo que el primero.
    "24 ml con un opcional incluido": { metrosLineales: 24, modo: "ambos" },
  };

  it("hay un escenario por cada caso grabado", () => {
    expect(Object.keys(ESCENARIOS).sort()).toEqual(fixture.map((c) => c.nombre).sort());
  });

  for (const caso of fixture) {
    it(caso.nombre, () => {
      const esc = ESCENARIOS[caso.nombre];
      expect(esc, `falta el escenario "${caso.nombre}"`).toBeDefined();

      const r = calcularCerco({
        metrosLineales: esc.metrosLineales,
        ...PRECIOS_CERCOS,
        adicionales: [],
      });

      esperarMontos(totalesCerco(r, esc.modo), caso.montos, caso.nombre);
    });
  }
});

/* ═════════════════════════════ COBERTORES ═════════════════════════════ */

describe("calcularCobertor reproduce el legacy", () => {
  const fixture = leerFixture("cobertores");

  const ESCENARIOS: Record<
    string,
    { largo: number; ancho: number; adicionalM2?: number }
  > = {
    "borde: exactamente 15 m² (3 × 5)": { largo: 3, ancho: 5 },
    "borde: apenas debajo de 15 m² (3 × 4,9)": { largo: 3, ancho: 4.9 },
    "borde: apenas encima de 15 m² (3 × 5,1)": { largo: 3, ancho: 5.1 },
    "pileta grande 8 × 4": { largo: 8, ancho: 4 },
    "el adicional de m² cruza el umbral (3 × 4,5 = 13,5 + 2 = 15,5)": {
      largo: 3,
      ancho: 4.5,
      adicionalM2: 2,
    },
    "el adicional de m² NO alcanza a cruzarlo (13,5 + 1 = 14,5)": {
      largo: 3,
      ancho: 4.5,
      adicionalM2: 1,
    },
    "sin medidas": { largo: 0, ancho: 0 },
  };

  it("hay un escenario por cada caso grabado", () => {
    expect(Object.keys(ESCENARIOS).sort()).toEqual(fixture.map((c) => c.nombre).sort());
  });

  for (const caso of fixture) {
    it(caso.nombre, () => {
      const esc = ESCENARIOS[caso.nombre];
      expect(esc, `falta el escenario "${caso.nombre}"`).toBeDefined();

      const r = calcularCobertor({
        largo: esc.largo,
        ancho: esc.ancho,
        adicionalM2: esc.adicionalM2 ?? 0,
        ...PRECIOS_COBERTORES,
        adicionales: [],
      });

      esperarMontos(totalesCobertor(r, "ambos"), caso.montos, caso.nombre);

      // El legacy también muestra los m² en un campo de sólo lectura; el
      // oráculo los grabó. Se comparan como número para no depender del
      // formateador.
      if (caso.calculados?.["f-m2"] !== undefined) {
        const m2Legacy = Number(caso.calculados["f-m2"].replace(/\./g, "").replace(",", "."));
        expect(r.m2).toBeCloseTo(m2Legacy, 6);
      }
    });
  }
});

/* ═══════════════ El escalón, aislado y explícito ═══════════════ */

describe("el umbral de los 15 m², documentado en un test", () => {
  const cotizar = (m2: number) =>
    calcularCobertor({
      largo: m2,
      ancho: 1,
      ...PRECIOS_COBERTORES,
      adicionales: [],
    });

  it("15 m² exactos pagan el precio caro: el corte es > 15, no >= 15", () => {
    expect(cotizar(15).bajoUmbral).toBe(true);
    expect(cotizar(15).precioPorM2Aplicado).toBe(10903);
    expect(cotizar(15.0001).bajoUmbral).toBe(false);
    expect(cotizar(15.0001).precioPorM2Aplicado).toBe(9902);
  });

  it("un cobertor más grande puede salir más barato (punto 1 a revisar)", () => {
    const chico = cotizar(15).totalSinInstalacion;
    const grande = cotizar(15.5).totalSinInstalacion;
    expect(grande).toBeLessThan(chico);
    // No se corrige acá: la migración preserva el comportamiento.
    expect(chico - grande).toBeCloseTo(10064, 0);
  });
});

/* ═════════════════════════════ PISCINAS ═════════════════════════════ */

describe("calcularPiscina reproduce el legacy", () => {
  const fixture = leerFixture("piscinas");

  const ESCENARIOS: Record<
    string,
    { subtotal: number; adicionales?: { descripcion: string; precio: number }[] }
  > = {
    // Los opcionales tildados NO suman: los tres primeros escenarios difieren
    // sólo en cuántos se tildaron, y los tres tienen que dar lo mismo.
    "subtotal a mano, sin opcionales": { subtotal: 18500000 },
    "subtotal con un opcional tildado": { subtotal: 18500000 },
    "subtotal con tres opcionales tildados": { subtotal: 18500000 },
    "sin subtotal cargado": { subtotal: 0 },
    "subtotal + un adicional (aparece la línea TOTAL)": {
      subtotal: 18500000,
      adicionales: [{ descripcion: "Traslado de equipos", precio: 350000 }],
    },
    "subtotal + dos adicionales": {
      subtotal: 18500000,
      adicionales: [
        { descripcion: "Traslado de equipos", precio: 350000 },
        { descripcion: "Retiro de tierra", precio: 420000 },
      ],
    },
  };

  it("hay un escenario por cada caso grabado", () => {
    expect(Object.keys(ESCENARIOS).sort()).toEqual(fixture.map((c) => c.nombre).sort());
  });

  for (const caso of fixture) {
    it(caso.nombre, () => {
      const esc = ESCENARIOS[caso.nombre];
      expect(esc, `falta el escenario "${caso.nombre}"`).toBeDefined();

      const r = calcularPiscina({
        subtotal: esc.subtotal,
        adicionales: esc.adicionales ?? [],
      });

      esperarMontos(importesPiscina(r), caso.montos, caso.nombre);
    });
  }

  it("tildar opcionales no mueve el total (punto 3 de reglas-de-negocio)", () => {
    const sinOpcionales = calcularPiscina({ subtotal: 18500000, adicionales: [] });
    // No hay forma de "pasarle" opcionales al motor porque no participan del
    // cálculo. Eso ES el modelo: son líneas informativas, no entradas de precio.
    expect(sinOpcionales.total).toBe(18500000);
  });

  it("sin adicionales el documento no dibuja la línea TOTAL", () => {
    expect(calcularPiscina({ subtotal: 18500000, adicionales: [] }).muestraTotal).toBe(false);
    expect(
      calcularPiscina({
        subtotal: 18500000,
        adicionales: [{ descripcion: "x", precio: 1 }],
      }).muestraTotal
    ).toBe(true);
  });
});

/* ═══════════════════════════ REVESTIMIENTOS ═══════════════════════════ */

describe("calcularRevestimiento reproduce el legacy", () => {
  const fixture = leerFixture("revestimientos");

  // Precios por defecto de los dos primeros materiales del catálogo legacy.
  const CERAMICO = {
    clave: "revestimiento_ceramico_bali",
    descripcion: "Cerámico Bali Brasil (por m² instalado)",
    precio: 112000,
    porM2: true,
  };
  const VENECITAS = {
    clave: "venecitas_premium_espana",
    descripcion: "Venecitas Premium España (por m² instalado)",
    precio: 140000,
    porM2: true,
  };

  const ESCENARIOS: Record<string, Parameters<typeof calcularRevestimiento>[0]> = {
    "profundidad pareja (solo desde)": { largo: 8, ancho: 4, profMin: 1.5 },
    "profundidad de menor a mayor (usa el promedio)": {
      largo: 8,
      ancho: 4,
      profMin: 1,
      profMax: 1.6,
    },
    "con escalera y desperdicio": {
      largo: 8,
      ancho: 4,
      profMin: 1.5,
      escalera: 3,
      desperdicio: 2,
    },
    "un revestimiento incluido, cobrado por m²": {
      largo: 8,
      ancho: 4,
      profMin: 1.5,
      materiales: [{ ...CERAMICO, incluida: true }],
    },
    "dos revestimientos incluidos": {
      largo: 8,
      ancho: 4,
      profMin: 1.5,
      materiales: [
        { ...CERAMICO, incluida: true },
        { ...VENECITAS, incluida: true },
      ],
    },
    "sin medidas": { largo: 0, ancho: 0, profMin: 0 },
  };

  it("hay un escenario por cada caso grabado", () => {
    expect(Object.keys(ESCENARIOS).sort()).toEqual(fixture.map((c) => c.nombre).sort());
  });

  for (const caso of fixture) {
    it(caso.nombre, () => {
      const esc = ESCENARIOS[caso.nombre];
      expect(esc, `falta el escenario "${caso.nombre}"`).toBeDefined();

      const r = calcularRevestimiento(esc);
      esperarMontos(importesRevestimiento(r), caso.montos, caso.nombre);

      // Los m² que el legacy muestra en sus campos de sólo lectura.
      const leer = (id: string) => {
        const v = caso.calculados?.[id];
        return v === undefined ? null : Number(v.replace(/\./g, "").replace(",", "."));
      };
      const piso = leer("f-m2-fondo");
      const paredes = leer("f-m2-paredes");
      const total = leer("f-m2-total");
      if (piso !== null) expect(r.m2Piso).toBeCloseTo(piso, 6);
      if (paredes !== null) expect(r.m2Paredes).toBeCloseTo(paredes, 6);
      if (total !== null) expect(r.m2Total).toBeCloseTo(total, 6);
    });
  }

  it("dos materiales dan dos totales, no su suma (punto 5)", () => {
    const r = calcularRevestimiento({
      largo: 8,
      ancho: 4,
      profMin: 1.5,
      materiales: [
        { ...CERAMICO, incluida: true },
        { ...VENECITAS, incluida: true },
      ],
    });
    const importes = importesRevestimiento(r);
    expect(importes).toHaveLength(2);
    expect(importes[0]).toBeCloseTo(7616000, 2);
    expect(importes[1]).toBeCloseTo(9520000, 2);
    // La suma NO es un importe que el documento muestre en ningún lado.
    expect(importes).not.toContain(17136000);
  });

  it("un material cobrado por obra no multiplica por m²", () => {
    const r = calcularRevestimiento({
      largo: 8,
      ancho: 4,
      profMin: 1.5,
      materiales: [
        {
          clave: "disqueado",
          descripcion: "Disqueado / remoción de revestimiento previo",
          precio: 800000,
          porM2: false,
          incluida: true,
        },
      ],
    });
    expect(r.alternativas[0].total).toBe(800000);
  });
});
