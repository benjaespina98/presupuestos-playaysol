import { z } from "zod";
import { Adicional } from "./tipos";

/**
 * Construcción de piscina.
 *
 *   total = subtotal + Σ adicionales
 *
 * El `subtotal` NO se calcula: lo escribe una persona a mano en el formulario.
 * Esta calculadora no deriva precios de medidas — su complejidad está en el
 * documento y el catálogo de opcionales, no en la aritmética.
 *
 * ⚠️ DOS COMPORTAMIENTOS QUE SE PRESERVAN A PROPÓSITO:
 *
 * 1. Los opcionales NO suman al total, ni siquiera los tildados con precio.
 *    Salen todos en el documento como anexo de cotización. Modelados como
 *    líneas `informativa` (ver tipos.ts). Punto 3 de reglas-de-negocio.md.
 *
 * 2. La línea TOTAL sólo existe si hay al menos un adicional cargado. Sin
 *    adicionales el documento muestra únicamente SUBTOTAL. Punto 2 de
 *    reglas-de-negocio.md: confirmado que se conserva el cálculo; la
 *    presentación se mejora después.
 *
 * Transcrito de `buildDocumentBody()` en public/piscinas-calc.js y verificado
 * contra tests/oracle/fixtures/piscinas.json.
 */

export const EntradaPiscinas = z.object({
  /** Lo que el vendedor escribió a mano. */
  subtotal: z.number(),
  adicionales: z.array(Adicional).default([]),
});
export type EntradaPiscinas = z.input<typeof EntradaPiscinas>;

export interface ResultadoPiscinas {
  subtotal: number;
  adicionales: number;
  total: number;
  /** Si el documento dibuja la línea TOTAL. false cuando no hay adicionales. */
  muestraTotal: boolean;
}

export function calcularPiscina(entrada: EntradaPiscinas): ResultadoPiscinas {
  const e = EntradaPiscinas.parse(entrada);

  const adicionales = e.adicionales.reduce((s, a) => s + a.precio, 0);

  return {
    subtotal: e.subtotal,
    adicionales,
    total: e.subtotal + adicionales,
    muestraTotal: e.adicionales.length > 0,
  };
}

/**
 * Los importes que el documento imprime, en orden: primero SUBTOTAL, después
 * TOTAL si corresponde. Reproduce exactamente lo que arma `incluidosRows`.
 */
export function importesAMostrar(r: ResultadoPiscinas): number[] {
  return r.muestraTotal ? [r.subtotal, r.total] : [r.subtotal];
}

/**
 * Cómo se imprime el precio de un opcional en el documento.
 * Tildado y con precio → el importe. Si no → "No incluye".
 */
export function precioDeOpcional(
  opcional: { incluida: boolean; precioUnitario: number | null }
): number | null {
  if (!opcional.incluida) return null;
  return opcional.precioUnitario;
}
