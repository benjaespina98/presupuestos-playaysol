import { describe, expect, it } from "vitest";
import { abrirCalculadora, montoDeLinea } from "../oracle/harness";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FORMATO NUMÉRICO ARGENTINO — comportamiento ACTUAL, no el deseado
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El sistema MUESTRA los importes en formato argentino ($ 2.650.000) pero no los
 * ACEPTA de vuelta: si alguien tipea ese mismo texto en un campo de precio, lo
 * interpreta como 2,65 pesos.
 *
 * Este archivo congela ese comportamiento. No lo arregla.
 *
 * Los casos marcados ROTO están mal a propósito: son la foto de lo que hace hoy
 * el sistema. Si alguno cambia, el test falla y hay que preguntarse por qué —
 * porque el arreglo tiene que ser una decisión explícita, no un efecto colateral
 * de la migración.
 *
 * El arreglo va DESPUÉS de la Fase 4, cuando exista `parseARS` y la calculadora
 * migrada lo use. Ahí estos casos se mueven a la columna "correcto" de a uno.
 *
 * ── Qué número se mide exactamente ─────────────────────────────────────────
 * Se lee el importe IMPRESO en el documento, no el que quedó en memoria. El
 * formateador redondea a 3 decimales, así que "1.500,50" —que parseNum
 * convierte en 1.5005— aparece impreso como 1,501. Se congela el valor impreso
 * a propósito: es lo que termina viendo el cliente en el presupuesto.
 *
 * ── Por qué se prueba a través de la calculadora ───────────────────────────
 * `parseNum()` vive dentro de la IIFE de cada -calc.js y no se exporta. En vez de
 * transcribir la función (y arriesgarnos a transcribirla mal), se le tipea al
 * campo real y se lee el total que sale del documento. Eso mide lo que le pasa
 * de verdad a un usuario.
 */

/** Con 1 metro lineal, el TOTAL SIN INSTALACIÓN es exactamente el precio /ml
 *  tipeado. Así el total leído es el número que el sistema entendió. */
async function precioQueEntendio(loTipeado: string): Promise<number> {
  const calc = await abrirCalculadora("cercos");
  try {
    calc.set("f-ml", "1");
    calc.set("f-modo-precio", "sin");
    calc.set("f-precio-sin", loTipeado);
    await calc.asentar();
    const total = calc.totales().find((t) => t.includes("TOTAL"));
    return montoDeLinea(total ?? "");
  } finally {
    calc.cerrar();
  }
}

describe("cómo interpreta hoy el sistema un precio tipeado", () => {
  /* [lo que tipea el usuario, lo que entiende el sistema, veredicto] */
  const CASOS: [string, number, "ok" | "ROTO"][] = [
    ["1500", 1500, "ok"],
    ["1.500", 1.5, "ROTO"],
    ["15.000", 15, "ROTO"],
    ["1500,50", 150050, "ROTO"],
    ["1.500,50", 1.501, "ROTO"],   // parseNum da 1.5005; el documento imprime 1,501
    ["$ 1.500", 1.5, "ROTO"],
    ["$ 2.650.000", 2.65, "ROTO"],
  ];

  for (const [tipeado, entendido, veredicto] of CASOS) {
    const etiqueta =
      veredicto === "ok"
        ? `"${tipeado}" → ${entendido}`
        : `"${tipeado}" → ${entendido}  ← ROTO, congelado a propósito`;

    it(etiqueta, async () => {
      expect(await precioQueEntendio(tipeado)).toBeCloseTo(entendido, 4);
    }, 30_000);
  }

  it("el único formato que hoy funciona es el número pelado, sin separadores", async () => {
    expect(await precioQueEntendio("2650000")).toBe(2650000);
  }, 30_000);
});

describe("la asimetría, en un solo test", () => {
  it("lo que el sistema imprime no es lo que el sistema acepta", async () => {
    // El documento muestra este texto para 2.650.000...
    const impreso = (2650000).toLocaleString("es-AR");
    expect(impreso).toBe("2.650.000");

    // ...pero si se lo tipean de vuelta, entiende otra cosa.
    const releido = await precioQueEntendio(impreso);
    expect(releido).not.toBe(2650000);
    expect(releido).toBeCloseTo(2.65, 4);
  }, 30_000);
});
