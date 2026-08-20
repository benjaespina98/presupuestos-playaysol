import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { abrirCalculadora, montoDeLinea, type TipoLegacy } from "../oracle/harness";
import { CASOS } from "../oracle/casos";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LA RED DE SEGURIDAD DE LA MIGRACIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Para cada calculadora legacy y cada caso, levanta la calculadora REAL, le
 * carga los datos por sus propios campos y compara el total contra la foto
 * guardada en tests/oracle/fixtures/.
 *
 * Sirve para dos cosas, en este orden:
 *
 *   1. HOY — que nadie toque una fórmula del legacy sin que salte.
 *   2. EN LA MIGRACIÓN — cuando una calculadora se reescriba en React, el motor
 *      de precios nuevo tiene que reproducir exactamente estos mismos números
 *      para los mismos datos. Las fixtures son el árbitro.
 *
 * Si un número cambia y NO tocaste una fórmula a propósito, eso es el hallazgo:
 * no regeneres la fixture, averiguá qué pasó.
 *
 * Para regenerar a propósito (agregaste un caso, o cambiaste una fórmula con
 * intención y ya lo documentaste):
 *
 *     npm run oraculo:grabar
 */

const DIR = path.join(__dirname, "..", "oracle", "fixtures");
const GRABANDO = process.env.ORACULO_GRABAR === "1";

interface ResultadoCaso {
  nombre: string;
  totales: string[];
  montos: number[];
  calculados?: Record<string, string>;
}

interface Fixture {
  tipo: TipoLegacy;
  grabadoDesde: string;
  casos: ResultadoCaso[];
}

/** Corre un caso contra la calculadora legacy, en una instancia limpia. */
async function ejecutar(tipo: TipoLegacy, indice: number): Promise<ResultadoCaso> {
  const caso = CASOS[tipo][indice];
  const calc = await abrirCalculadora(tipo);
  try {
    await caso.preparar(calc);
    await calc.asentar();

    if (calc.errores.length) {
      throw new Error(
        `${tipo} / "${caso.nombre}": la calculadora tiró errores\n${calc.errores.join("\n")}`
      );
    }

    const totales = calc.totales();
    const resultado: ResultadoCaso = {
      nombre: caso.nombre,
      totales,
      montos: totales.map(montoDeLinea),
    };
    if (caso.leerAdemas?.length) {
      resultado.calculados = Object.fromEntries(
        caso.leerAdemas.map((id) => [id, calc.leer(id)])
      );
    }
    return resultado;
  } finally {
    calc.cerrar();
  }
}

const tipos = Object.keys(CASOS) as TipoLegacy[];

for (const tipo of tipos) {
  describe(`oráculo · ${tipo}`, () => {
    const archivo = path.join(DIR, `${tipo}.json`);

    if (GRABANDO) {
      it(`graba las fixtures de ${tipo}`, async () => {
        const casos: ResultadoCaso[] = [];
        for (let i = 0; i < CASOS[tipo].length; i++) casos.push(await ejecutar(tipo, i));
        const fixture: Fixture = {
          tipo,
          grabadoDesde: `public/${tipo}-calc.js`,
          casos,
        };
        fs.mkdirSync(DIR, { recursive: true });
        fs.writeFileSync(archivo, JSON.stringify(fixture, null, 2) + "\n");
        expect(casos.length).toBe(CASOS[tipo].length);
      }, 60_000);
      return;
    }

    it("tiene fixtures grabadas", () => {
      expect(
        fs.existsSync(archivo),
        `Falta tests/oracle/fixtures/${tipo}.json. Generalo con: npm run oraculo:grabar`
      ).toBe(true);
    });

    if (!fs.existsSync(archivo)) return;

    const fixture: Fixture = JSON.parse(fs.readFileSync(archivo, "utf8"));

    it("la lista de casos no se desincronizó de las fixtures", () => {
      expect(
        fixture.casos.map((c) => c.nombre),
        "agregaste o sacaste un caso sin regrabar: npm run oraculo:grabar"
      ).toEqual(CASOS[tipo].map((c) => c.nombre));
    });

    CASOS[tipo].forEach((caso, i) => {
      it(`${caso.nombre}`, async () => {
        const esperado = fixture.casos[i];
        if (!esperado) return; // ya lo reporta el test de sincronización
        const obtenido = await ejecutar(tipo, i);

        expect(obtenido.montos, "cambió un TOTAL respecto de la foto del legacy").toEqual(
          esperado.montos
        );
        expect(obtenido.totales, "cambió el texto de una línea de total").toEqual(
          esperado.totales
        );
        if (esperado.calculados) {
          expect(obtenido.calculados, "cambió un campo calculado (m², etc.)").toEqual(
            esperado.calculados
          );
        }
      }, 30_000);
    });
  });
}
