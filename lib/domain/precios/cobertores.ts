import { z } from "zod";
import { Adicional } from "./tipos";
import type { ModoPrecio } from "./cercos";

/**
 * Cobertores de pileta.
 *
 *   m²    = largo × ancho + adicional de m²
 *   precio por m² = m² > 15 ? precio para más de 15 : precio hasta 15
 *   total sin instalación = m² × precio + Σ adicionales
 *   total con instalación = m² × precio + costo fijo de instalación + Σ adicionales
 *
 * ⚠️ EL CORTE ES `> 15`, NO `>= 15`: exactamente 15 m² paga el precio caro.
 *
 * ⚠️ El escalón genera una discontinuidad: un cobertor de 15,5 m² sale más
 *    barato que uno de 15,0 m². Está documentado en el punto 1 de
 *    docs/reglas-de-negocio.md y NO se corrige acá. Migración es paridad; la
 *    corrección, si se decide, es un cambio aparte y explícito.
 *
 * Transcrito de `buildDocumentBody()` en public/cobertores-calc.js y verificado
 * contra tests/oracle/fixtures/cobertores.json.
 */

/** El umbral vive acá con nombre, y no como un 15 suelto en medio de la cuenta. */
export const UMBRAL_M2 = 15;

export const EntradaCobertores = z.object({
  largo: z.number().min(0),
  ancho: z.number().min(0),
  adicionalM2: z.number().min(0).default(0),
  precioPorM2HastaUmbral: z.number().min(0),
  precioPorM2SobreUmbral: z.number().min(0),
  precioInstalacion: z.number().min(0),
  adicionales: z.array(Adicional).default([]),
});
export type EntradaCobertores = z.input<typeof EntradaCobertores>;

export interface ResultadoCobertores {
  /** largo × ancho, sin el adicional. */
  espejoM2: number;
  /** Lo que efectivamente se cotiza. */
  m2: number;
  /** El precio por m² que quedó aplicado, ya resuelto el escalón. */
  precioPorM2Aplicado: number;
  /** true si cayó del lado caro del umbral. */
  bajoUmbral: boolean;
  base: number;
  adicionales: number;
  totalSinInstalacion: number;
  totalConInstalacion: number;
}

export function calcularCobertor(entrada: EntradaCobertores): ResultadoCobertores {
  const e = EntradaCobertores.parse(entrada);

  const espejoM2 = e.largo * e.ancho;
  const m2 = espejoM2 + e.adicionalM2;

  const bajoUmbral = !(m2 > UMBRAL_M2);
  const precioPorM2Aplicado = bajoUmbral
    ? e.precioPorM2HastaUmbral
    : e.precioPorM2SobreUmbral;

  const adicionales = e.adicionales.reduce((s, a) => s + a.precio, 0);
  const base = m2 * precioPorM2Aplicado;

  return {
    espejoM2,
    m2,
    precioPorM2Aplicado,
    bajoUmbral,
    base,
    adicionales,
    totalSinInstalacion: base + adicionales,
    totalConInstalacion: base + e.precioInstalacion + adicionales,
  };
}

export function totalesAMostrar(
  r: ResultadoCobertores,
  modo: ModoPrecio
): number[] {
  if (modo === "sin") return [r.totalSinInstalacion];
  if (modo === "con") return [r.totalConInstalacion];
  return [r.totalSinInstalacion, r.totalConInstalacion];
}
