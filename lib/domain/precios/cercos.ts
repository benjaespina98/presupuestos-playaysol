import { z } from "zod";
import { Adicional } from "./tipos";

/**
 * Cercos perimetrales.
 *
 *   total sin instalación = metros lineales × precio/ml sin instalación + Σ adicionales
 *   total con instalación = metros lineales × precio/ml con instalación + Σ adicionales
 *
 * Los opcionales del catálogo NO suman al total: salen en el documento como
 * anexo informativo. Ver punto 3 de docs/reglas-de-negocio.md.
 *
 * Transcrito de `buildDocumentBody()` en public/cercos-calc.js y verificado
 * contra tests/oracle/fixtures/cercos.json.
 */

export const EntradaCercos = z.object({
  metrosLineales: z.number().min(0),
  precioPorMlSinInstalacion: z.number().min(0),
  precioPorMlConInstalacion: z.number().min(0),
  adicionales: z.array(Adicional).default([]),
});
export type EntradaCercos = z.input<typeof EntradaCercos>;

export interface ResultadoCercos {
  /** metros × precio, sin los adicionales. */
  baseSinInstalacion: number;
  baseConInstalacion: number;
  adicionales: number;
  totalSinInstalacion: number;
  totalConInstalacion: number;
}

export function calcularCerco(entrada: EntradaCercos): ResultadoCercos {
  const e = EntradaCercos.parse(entrada);

  const adicionales = e.adicionales.reduce((s, a) => s + a.precio, 0);
  const baseSinInstalacion = e.metrosLineales * e.precioPorMlSinInstalacion;
  const baseConInstalacion = e.metrosLineales * e.precioPorMlConInstalacion;

  return {
    baseSinInstalacion,
    baseConInstalacion,
    adicionales,
    totalSinInstalacion: baseSinInstalacion + adicionales,
    totalConInstalacion: baseConInstalacion + adicionales,
  };
}

/** Qué totales muestra el documento, según lo elegido en el formulario. */
export type ModoPrecio = "sin" | "con" | "ambos";

export function totalesAMostrar(
  r: ResultadoCercos,
  modo: ModoPrecio
): number[] {
  if (modo === "sin") return [r.totalSinInstalacion];
  if (modo === "con") return [r.totalConInstalacion];
  return [r.totalSinInstalacion, r.totalConInstalacion];
}
