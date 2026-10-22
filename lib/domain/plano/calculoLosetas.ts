/**
 * Calculadora de losetas del borde de una pileta — HERRAMIENTA INTERNA.
 *
 * Calcula CANTIDADES de piezas (no precios): cuántas losetas de borde y cuántas planas hay que pedir.
 * No suma al total de ningún presupuesto ni aparece en los documentos que se le entregan al cliente.
 *
 * Lógica adoptada (ver docs/calculador-losetas.md):
 *
 *   área del borde  = (largo + 2·vereda) × (ancho + 2·vereda) − largo × ancho
 *   losetas de borde = ⌈ área del borde ÷ área de una loseta × (1 + desperdicio) ⌉
 *   losetas planas   = valor fijo editable (escalera/accesos; 6 en la hoja "Artículos")
 *   total            = losetas de borde + losetas planas
 *
 * Con loseta de 0,50 × 0,50 y vereda de 0,50 m (hormigón), da exactamente las cantidades de la hoja
 * "Artículos" de la planilla para 7×3 (44), 7×3,50 (46) y 10×4 (60); en los otros tamaños la hoja trae
 * 1 o 2 losetas menos (son estimaciones; ver las diferencias en docs/calculador-losetas.md).
 *
 * Es una función pura: sin red, sin base de datos, sin estado.
 */

export type TipoPileta = "hormigon" | "fibra";

export interface EntradaCalculoLosetas {
  /** Largo exterior de la pileta (m). Para fibra, la medida real del modelo. */
  largo: number;
  /** Ancho exterior de la pileta (m). Para fibra, la medida real del modelo. */
  ancho: number;
  /** Profundidad (m). Sólo informativa: no cambia la cantidad de losetas del borde. */
  profundidad?: number;
  tipo: TipoPileta;
  /** Lado largo de la loseta (m). Por defecto 0,50. */
  losetaLargo: number;
  /** Lado corto de la loseta (m). Por defecto 0,50. */
  losetaAncho: number;
  /** Ancho de la vereda de losetas alrededor de la pileta (m). Por defecto 0,50. */
  vereda: number;
  /** Desperdicio en porcentaje (0 a 100). Por defecto 0. */
  desperdicioPct: number;
  /** Losetas planas (escalera/accesos). Por defecto 6, como en la hoja "Artículos". */
  planas: number;
}

export interface ResultadoCalculoLosetas {
  /** m² que cubre la vereda de losetas alrededor de la pileta. */
  areaBorde: number;
  /** m² de una loseta. */
  areaLoseta: number;
  /** Losetas de borde sin desperdicio, con decimales (para mostrar el detalle). */
  bordeExacto: number;
  bordeSinDesperdicio: number;
  /** Losetas de borde a pedir (con desperdicio, redondeado hacia arriba). */
  borde: number;
  planas: number;
  total: number;
  /** Los pasos del cálculo, en texto, para mostrarlos a la vista. */
  detalle: string[];
  /** Por qué no se pudo calcular (null si salió bien). */
  error: string | null;
}

/** Valores por defecto de cada tipo de pileta (sólo cambia la vereda sugerida; ambos son editables). */
export function entradaPorDefecto(tipo: TipoPileta = "hormigon"): EntradaCalculoLosetas {
  return { largo: 0, ancho: 0, profundidad: undefined, tipo, losetaLargo: 0.5, losetaAncho: 0.5, vereda: 0.5, desperdicioPct: 0, planas: 6 };
}

const fmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 2 });

export function calcularLosetas(e: EntradaCalculoLosetas): ResultadoCalculoLosetas {
  const vacio = (error: string): ResultadoCalculoLosetas => ({
    areaBorde: 0,
    areaLoseta: 0,
    bordeExacto: 0,
    bordeSinDesperdicio: 0,
    borde: 0,
    planas: 0,
    total: 0,
    detalle: [],
    error,
  });

  const numeros = [e.largo, e.ancho, e.losetaLargo, e.losetaAncho, e.vereda, e.desperdicioPct, e.planas];
  if (numeros.some((n) => !Number.isFinite(n))) return vacio("Hay un valor que no es un número.");
  if (e.largo <= 0 || e.ancho <= 0) return vacio("Ingresá el largo y el ancho de la pileta.");
  if (e.losetaLargo <= 0 || e.losetaAncho <= 0) return vacio("La medida de la loseta tiene que ser mayor que cero.");
  if (e.vereda < 0) return vacio("El ancho de la vereda no puede ser negativo.");
  if (e.desperdicioPct < 0 || e.desperdicioPct > 100) return vacio("El desperdicio tiene que estar entre 0 y 100 %.");
  if (e.planas < 0 || !Number.isInteger(e.planas)) return vacio("Las losetas planas tienen que ser un número entero, cero o más.");

  const areaBorde = (e.largo + 2 * e.vereda) * (e.ancho + 2 * e.vereda) - e.largo * e.ancho;
  const areaLoseta = e.losetaLargo * e.losetaAncho;
  // Se redondea a 6 decimales antes del techo: 11 ÷ 0,25 da 43,99999999 en coma flotante y no tiene que subir a 45.
  const bordeExacto = Math.round((areaBorde / areaLoseta) * 1e6) / 1e6;
  const bordeSinDesperdicio = Math.ceil(bordeExacto);
  const borde = Math.ceil(Math.round(bordeExacto * (1 + e.desperdicioPct / 100) * 1e6) / 1e6);
  const total = borde + e.planas;

  const detalle = [
    `Área del borde = (${fmt(e.largo)} + 2×${fmt(e.vereda)}) × (${fmt(e.ancho)} + 2×${fmt(e.vereda)}) − ${fmt(e.largo)} × ${fmt(e.ancho)} = ${fmt(areaBorde)} m²`,
    `Área de una loseta = ${fmt(e.losetaLargo)} × ${fmt(e.losetaAncho)} = ${fmt(areaLoseta)} m²`,
    `Losetas de borde = ${fmt(areaBorde)} ÷ ${fmt(areaLoseta)} = ${fmt(bordeExacto)}`,
    e.desperdicioPct > 0
      ? `Con ${fmt(e.desperdicioPct)} % de desperdicio, redondeado hacia arriba = ${borde}`
      : `Sin desperdicio, redondeado hacia arriba = ${borde}`,
    `Losetas planas (escalera y accesos) = ${e.planas}`,
    `Total = ${borde} + ${e.planas} = ${total}`,
  ];

  return { areaBorde, areaLoseta, bordeExacto, bordeSinDesperdicio, borde, planas: e.planas, total, detalle, error: null };
}

/**
 * Las cantidades de la hoja "Artículos" de la planilla de costos (borde / planas) por tamaño de
 * hormigón. Algunas son estimaciones a validar. Sólo se usan para comparar, nunca para calcular.
 */
export const TABLA_PLANILLA_LOSETAS: ReadonlyArray<{ largo: number; ancho: number; borde: number; planas: number }> = [
  { largo: 5, ancho: 3, borde: 38, planas: 6 },
  { largo: 6, ancho: 3, borde: 38, planas: 6 },
  { largo: 7, ancho: 3, borde: 44, planas: 6 },
  { largo: 7, ancho: 3.5, borde: 46, planas: 6 },
  { largo: 7, ancho: 4, borde: 47, planas: 6 },
  { largo: 8, ancho: 3, borde: 47, planas: 6 },
  { largo: 8, ancho: 4, borde: 50, planas: 6 },
  { largo: 9, ancho: 3, borde: 50, planas: 6 },
  { largo: 9, ancho: 4, borde: 54, planas: 6 },
  { largo: 10, ancho: 4, borde: 60, planas: 6 },
  { largo: 6.5, ancho: 2.5, borde: 38, planas: 6 },
];
