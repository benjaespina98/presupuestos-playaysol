import { z } from "zod";
import { TramoProfundidad, cortesProfundidad, fmtProfundidad, resumenProfundidad, zonasProfundidad } from "./profundidad";
import {
  centroPorDefecto,
  colocarObjeto,
  dibujarBrujula,
  dibujarObjetoUbicado,
  reservaUbicacion,
  separarObjetos,
  type CajaUbicada,
  type TipoUbicacion,
} from "./ubicacion";
import { buscarLugarLibre, cajaDeTexto, trasladarCaja, unirCajas, type Caja } from "./solapes";

/**
 * Geometría del "Plano de Piscina" (losetas).
 *
 * Motor de dominio PURO: recibe el estado del editor y devuelve una lista de
 * primitivas de dibujo (rectángulos, líneas, círculos, textos) en coordenadas
 * de píxel, listas para que un componente React las renderice como JSX de
 * `<svg>`. No genera HTML/SVG en texto ni toca el DOM — eso es justamente lo
 * que se quiso evitar al migrar (ver Lote 2 de la auditoría de Fase 5:
 * "no conviertas el SVG en una caja negra manipulada por querySelector").
 *
 * Transcripción 1:1 de `drawSvg()` en el legacy
 * (app/dashboard/losetas/script.ts, ya borrado), verificada contra
 * losetas.test.ts de esta misma carpeta. La aritmética de m² (no la de
 * dibujo) vive aparte en lib/domain/precios/losetas.ts.
 */

export const LuzPos = z.object({ x: z.number(), y: z.number() });
export type LuzPos = z.infer<typeof LuzPos>;

export const EscaleraPos = z.enum(["solar", "opuesto", "lateral1", "lateral2"]);
export type EscaleraPos = z.infer<typeof EscaleraPos>;

export const TipoPileta = z.enum(["hormigon", "fibra"]);
export type TipoPileta = z.infer<typeof TipoPileta>;

export const Revestimiento = z.enum(["", "ceramicos", "travertino", "pintura", "otro"]);
export type Revestimiento = z.infer<typeof Revestimiento>;

/**
 * Qué va ALREDEDOR de la pileta (el borde/vereda que se mide lado por lado).
 * Es la elección del cliente: losetas, decks o travertino. Cambia el nombre en
 * la leyenda del plano y el color de fábrica del borde; las medidas se cargan y
 * se dibujan igual para los tres.
 */
export const MaterialBorde = z.enum(["losetas", "decks", "travertino"]);
export type MaterialBorde = z.infer<typeof MaterialBorde>;

/** Las losetas y los decks vienen en dos colores: marfil y blanco. El travertino, en uno solo. */
export const TonoBorde = z.enum(["marfil", "blanco"]);
export type TonoBorde = z.infer<typeof TonoBorde>;

export const TONOS_BORDE: Record<TonoBorde, string> = { marfil: "Marfil", blanco: "Blanco" };

export const MATERIALES_BORDE: Record<
  MaterialBorde,
  {
    etiqueta: string;
    singular: string;
    leyenda: string;
    /** true = se elige entre marfil y blanco. */
    conTono: boolean;
    /** Color de fábrica de cada tono (en los de un solo color, los dos valen lo mismo). */
    colores: Record<TonoBorde, string>;
  }
> = {
  // Marfil = un crema claro (ni rosado ni amarillo fuerte); el de los decks, un poco más cálido.
  losetas: { etiqueta: "Losetas", singular: "loseta", leyenda: "Borde de loseta", conTono: true, colores: { marfil: "#F1E7CC", blanco: "#F4F4F1" } },
  decks: { etiqueta: "Decks", singular: "deck", leyenda: "Borde de deck", conTono: true, colores: { marfil: "#E6D7B3", blanco: "#F1F1EE" } },
  travertino: { etiqueta: "Travertino", singular: "travertino", leyenda: "Borde de travertino", conTono: false, colores: { marfil: "#E6DAC3", blanco: "#E6DAC3" } },
};

/** Los colores de fábrica que tuvo el marfil antes de corregirlo (rosado/amarillento): un plano guardado con
 *  alguno de estos no lo eligió a mano, así que se actualiza al marfil de ahora. */
export const MARFILES_ANTERIORES = ["#f7e6d3", "#ebddc0"] as const;

/** El color de fábrica del borde para ese material y tono. */
export function colorDeBorde(material: MaterialBorde, tono: TonoBorde): string {
  const m = MATERIALES_BORDE[material];
  return m.colores[m.conTono ? tono : "marfil"];
}

/** El texto de la leyenda del plano: "Borde de loseta marfil", "Borde de travertino". */
export function leyendaDeBorde(material: MaterialBorde, tono: TonoBorde): string {
  const m = MATERIALES_BORDE[material];
  return m.conTono ? `${m.leyenda} ${tono}` : m.leyenda;
}

/** Cómo se nombra el borde en el formulario: "losetas marfil", "decks blanco", "travertino". */
export function nombreDeBorde(material: MaterialBorde, tono: TonoBorde): string {
  const m = MATERIALES_BORDE[material];
  return m.conTono ? `${m.etiqueta.toLowerCase()} ${tono}` : m.etiqueta.toLowerCase();
}

/** El borde de losetas marfil: el color con el que arranca un plano nuevo. */
export const COLOR_BORDE_POR_DEFECTO = MATERIALES_BORDE.losetas.colores.marfil;

export const PlanoLosetasEntrada = z.object({
  largo: z.number().min(0).default(0),
  ancho: z.number().min(0).default(0),
  solar: z.number().min(0).default(0),
  opuesto: z.number().min(0).default(0),
  lateral1: z.number().min(0).default(0),
  lateral2: z.number().min(0).default(0),
  /** Un lado con desborde infinito no lleva loseta — el agua cae directo a
   *  una canaleta/pileta de compensación, no a un piso caminable. La medida
   *  de ese lado (`solar`/`opuesto`/`lateral1`/`lateral2`) se ignora
   *  mientras su desborde esté activo: no hace falta ponerla en 0 a mano,
   *  el dibujo ya la trata como si lo estuviera. */
  desbordeSolar: z.boolean().default(false),
  desbordeOpuesto: z.boolean().default(false),
  desbordeLateral1: z.boolean().default(false),
  desbordeLateral2: z.boolean().default(false),
  solarHumedo: z.boolean().default(false),
  solarHumedoAncho: z.number().min(0).default(0),
  escalera: z.boolean().default(false),
  escaleraPos: EscaleraPos.default("solar"),
  /** Lado del cuadrado en modo "objeto libre" (metros) — ver
   *  `escaleraMovible`. En modo franja no se usa: la profundidad sale de
   *  `escaleraEscalones × escaleraMedidaEscalon`. */
  escaleraAncho: z.number().min(0).default(0.5),
  /** Modo franja (escaleraMovible=false): cantidad de escalones y la
   *  profundidad de cada uno — la profundidad total de la franja es el
   *  producto de los dos (3 × 0,30 m = 0,90 m), no un ancho suelto: así se
   *  pide en obra ("escalones de 30") y así queda rotulada en el plano. */
  escaleraEscalones: z.number().min(0).default(3),
  escaleraMedidaEscalon: z.number().min(0).default(0.3),
  /** false (default) = franja a todo lo ancho/largo del lado elegido en
   *  `escaleraPos` — así se construye la mayoría de las veces: corrida
   *  completa, a menudo pegada al solar húmedo. true = un objeto chico que
   *  se arrastra a mano en el plano, igual que una luz (`escaleraPosLibre`) —
   *  para escaleras de esquina, tipo "romana", que no ocupan todo el lado. */
  escaleraMovible: z.boolean().default(false),
  escaleraPosLibre: LuzPos.default({ x: 0.5, y: 0.5 }),
  tipoPileta: TipoPileta.default("hormigon"),
  labios: z.number().min(0).default(0.2),
  luces: z.boolean().default(false),
  cantLuces: z.number().min(0).default(0),
  lucesPos: z.array(LuzPos).default([]),
  skimmer: z.boolean().default(false),
  cantSkimmers: z.number().min(0).default(1),
  skimmersPos: z.array(LuzPos).default([]),
  hidromasaje: z.boolean().default(false),
  cantHidromasajes: z.number().min(0).default(2),
  hidromasajesPos: z.array(LuzPos).default([]),
  revestimiento: Revestimiento.default(""),
  revestimientoOtro: z.string().default(""),
  colorAgua: z.string().default("#A6D1EC"),
  colorLoseta: z.string().default(COLOR_BORDE_POR_DEFECTO),
  materialBorde: MaterialBorde.default("losetas"),
  tonoBorde: TonoBorde.default("marfil"),
  /** Profundidad general de la pileta (m); 0 = sin cargar. Si hay tramos, es la
   *  del "resto" (lo que no cae en ningún tramo). */
  profundidad: z.number().min(0).default(0),
  /** Tramos con otra profundidad, medidos desde el lado del solar. */
  tramosProfundidad: z.array(TramoProfundidad).default([]),
  lblSolar: z.string().default("Solar"),
  lblOpuesto: z.string().default("Opuesto"),
  lblLateral1: z.string().default("Lateral 1"),
  lblLateral2: z.string().default("Lateral 2"),
  /** Puntos cardinales: una rosa de los vientos en el plano, con el norte hacia `norteGrados`
   *  (en sentido horario; 0 = el norte está arriba). */
  puntosCardinales: z.boolean().default(false),
  norteGrados: z.number().default(0),
  /** Sala de filtro: un cuadrado gris oscuro FUERA del borde. Se arrastra a mano; `salaPosLibre` es el
   *  centro donde se la soltó, en METROS desde la esquina de arriba a la izquierda del borde
   *  (null = todavía no se la movió: aparece en su lugar de fábrica). */
  salaFiltro: z.boolean().default(false),
  salaPosLibre: LuzPos.nullable().default(null),
  /** Casa (o quincho): para orientar dónde está respecto de la pileta. Mismo criterio que la sala. */
  casa: z.boolean().default(false),
  casaPosLibre: LuzPos.nullable().default(null),
});
export type PlanoLosetasEntrada = z.input<typeof PlanoLosetasEntrada>;
export type PlanoLosetasEstado = z.infer<typeof PlanoLosetasEntrada>;

const REVEST_LABELS: Record<Exclude<Revestimiento, "">, string> = {
  ceramicos: "Cerámicos",
  travertino: "Travertino",
  pintura: "Pintura",
  otro: "Otro",
};

/** Posición por defecto del objeto i-ésimo de n (luz, skimmer o
 *  hidromasaje): contra la pared del solar, repartidos a lo largo.
 *  Normalizada (0..1) dentro del rectángulo de la pileta. El nombre quedó
 *  de cuando sólo existían las luces — la función siempre fue genérica. */
export function posicionLuzPorDefecto(i: number, n: number): LuzPos {
  return { x: 0.06, y: n <= 1 ? 0.5 : (i + 0.5) / n };
}

export type TipoObjetoPlano = "luz" | "skimmer" | "hidromasaje";

/**
 * Dónde nace cada tipo de objeto. Antes los tres nacían en el MISMO lugar (la
 * pared del solar), así que una luz, un skimmer y un hidromasaje agregados sin
 * arrastrar quedaban uno encima del otro. Ahora cada tipo tiene su pared:
 * luces contra el solar (izquierda), hidromasajes contra la pared opuesta
 * (derecha) y skimmers sobre la pared de arriba. Las luces conservan su lugar
 * de siempre.
 */
export function posicionPorDefecto(tipo: TipoObjetoPlano, i: number, n: number): LuzPos {
  const t = n <= 1 ? 0.5 : (i + 0.5) / n;
  if (tipo === "hidromasaje") return { x: 0.94, y: t };
  if (tipo === "skimmer") return { x: t, y: 0.1 };
  return posicionLuzPorDefecto(i, n);
}

/** Ajusta un array de posiciones a la cantidad actual de objetos (luces,
 *  skimmers, hidromasajes — cualquiera con la misma forma "on/cantidad/
 *  posiciones"): conserva las ya elegidas, agrega las que falten en su
 *  posición por defecto y descarta las sobrantes. Pura: devuelve un array
 *  nuevo, nunca muta el que recibe. */
export function ajustarLucesPos(
  lucesPos: LuzPos[],
  on: boolean,
  n: number,
  tipo: TipoObjetoPlano = "luz",
  /** Posiciones de los OTROS objetos del plano: lo nuevo no nace encima de ninguno. */
  ocupadas: LuzPos[] = []
): LuzPos[] {
  if (!on || n <= 0) return [];
  const resultado = lucesPos.slice(0, n);
  for (let i = 0; i < n; i++) {
    if (!resultado[i]) {
      const hechas = resultado.filter((p): p is LuzPos => !!p);
      resultado[i] = evitarChoques(posicionPorDefecto(tipo, i, n), [...ocupadas, ...hechas], tipo === "skimmer" ? "x" : "y");
    }
  }
  return resultado;
}

/** ¿Dos objetos del plano (en posición normalizada) quedan uno encima del otro? */
export function seTocan(a: LuzPos, b: LuzPos): boolean {
  return Math.abs(a.x - b.x) < 0.07 && Math.abs(a.y - b.y) < 0.13;
}

/** Corre una posición candidata, a lo largo de la pared (eje), hasta un lugar donde no pise a ninguna de `ocupadas`. */
export function evitarChoques(candidata: LuzPos, ocupadas: LuzPos[], eje: "x" | "y"): LuzPos {
  if (!ocupadas.some((o) => seTocan(candidata, o))) return candidata;
  for (let paso = 1; paso <= 18; paso++) {
    for (const signo of [1, -1]) {
      const d = signo * paso * 0.05;
      const prueba: LuzPos = eje === "x" ? { x: candidata.x + d, y: candidata.y } : { x: candidata.x, y: candidata.y + d };
      const dentro = eje === "x" ? prueba.x >= 0.04 && prueba.x <= 0.96 : prueba.y >= 0.06 && prueba.y <= 0.94;
      if (dentro && !ocupadas.some((o) => seTocan(prueba, o))) return prueba;
    }
  }
  return candidata;
}

function hexToRgb(h: string): [number, number, number] {
  let hex = String(h || "").replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  const n = parseInt(hex || "000000", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Aclara un color hex mezclándolo con blanco (t=0 sin cambio, t=1 blanco). */
export function aclararHex(hex: string, t: number): string {
  const [r, g, b] = hexToRgb(hex);
  const m = (v: number) => Math.round(v + (255 - v) * t);
  return "#" + [m(r), m(g), m(b)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export function fmtM(n: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);
}

/* ───────────────────────── Primitivas de dibujo ───────────────────────── */

export type PrimRect = {
  t: "rect";
  x: number; y: number; w: number; h: number;
  fill: string; stroke?: string; strokeWidth?: number; rx?: number;
  opacity?: number; dash?: string;
};
export type PrimLine = {
  t: "line";
  x1: number; y1: number; x2: number; y2: number;
  stroke: string; strokeWidth: number; opacity?: number;
};
/** Todo lo que se puede arrastrar en el editor. La escalera libre y el
 *  espejo/etc. tienen un único objeto (`indice` siempre 0); luces/skimmers/
 *  hidromasajes pueden tener varios. */
export type TipoArrastrable = "luz" | "escalera" | "skimmer" | "hidromasaje" | "sala" | "casa";

export type PrimCircle = {
  t: "circle";
  cx: number; cy: number; r: number;
  fill: string; stroke?: string; strokeWidth?: number; opacity?: number;
  /** Presente sólo en el círculo de agarre interactivo de un objeto
   *  arrastrable — nunca en el glow/foco/brillo puramente decorativos. */
  drag?: { tipo: TipoArrastrable; indice: number };
};
export type PrimText = {
  t: "text";
  x: number; y: number; text: string;
  fontSize: number; fill: string;
  anchor?: "start" | "middle" | "end";
  central?: boolean;
  weight?: "bold";
  opacity?: number;
  rotateDeg?: number;
};
/** Un polígono relleno (la flecha del norte). */
export type PrimPoly = {
  t: "poly";
  puntos: [number, number][];
  fill: string; stroke?: string; strokeWidth?: number; opacity?: number;
};
export type Prim = PrimRect | PrimLine | PrimCircle | PrimText | PrimPoly;

export interface LegendItem {
  x: number; y: number;
  kind: "loseta" | "pileta" | "solarhumedo" | "espejo" | "escalera" | "luz" | "skimmer" | "hidromasaje" | "sala" | "casa";
  label: string;
}

export interface GeometriaPlano {
  viewW: number;
  svgH: number;
  /** Rectángulo de la pileta en píxeles — lo usa el editor para convertir
   *  coordenadas de puntero a posición normalizada al arrastrar una luz. */
  pool: { x: number; y: number; w: number; h: number };
  /** El borde (el rectángulo grande de loseta) en píxeles y la escala: el editor lo usa para
   *  convertir el puntero a metros al arrastrar la sala de filtro o la casa. */
  caja: { x: number; y: number; w: number; h: number; pxPerM: number };
  colores: { aguaTop: string; aguaBottom: string; losetaFill: string };
  fondo: Prim; // el rectángulo grande de loseta
  grid: PrimLine[];
  /** Las 4 aristas de la pileta (línea normal o gruesa + resalte blanco
   *  interior si no tiene desborde infinito, etiqueta si lo tiene) — se
   *  pintan encima del relleno de agua, que va sin stroke propio. */
  borde: Prim[];
  extras: Prim[]; // solar húmedo, escalera, espejo, luces
  dims: Prim[]; // título, cotas, etiquetas de lado
  legend: LegendItem[];
}

export interface OpcionesPlano {
  viewW: number;
  viewHmax: number;
  /** true = plano completo (imagen del cliente): grilla, cotas, leyenda.
   *  false = plano compacto (editor): sólo lo esencial. */
  showDims: boolean;
  /** true = plano del editor: dibuja el círculo de agarre de cada luz. */
  interactive: boolean;
}

function tick(x: number, y: number, color: string): PrimLine {
  return { t: "line", x1: x - 4, y1: y, x2: x + 4, y2: y, stroke: color, strokeWidth: 0.75 };
}
function tickH(x: number, y: number, color: string): PrimLine {
  return { t: "line", x1: x, y1: y - 4, x2: x, y2: y + 4, stroke: color, strokeWidth: 0.75 };
}

/** Un objeto del plano (luz, skimmer, hidromasaje, escalera libre) con la caja
 *  que ocupa: lo que no se puede pisar con otro objeto ni con un texto. */
interface Marcador {
  prims: Prim[];
  caja: Caja;
}

/** El centro (en x) del tramo de agua más ancho que dejan libre las franjas a todo lo alto (solar húmedo, escalera). */
function centroLibreX(x0: number, x1: number, altoPool: number, franjas: Caja[]): number {
  const llenas = franjas.filter((f) => f.y1 - f.y0 >= altoPool * 0.9).sort((a, b) => a.x0 - b.x0);
  let mejor: [number, number] = [x0, x1];
  let ancho = -1;
  let desde = x0;
  for (const f of [...llenas, { x0: x1, y0: 0, x1: x1, y1: 0 }]) {
    const hasta = Math.min(f.x0, x1);
    if (hasta - desde > ancho) { ancho = hasta - desde; mejor = [desde, hasta]; }
    desde = Math.max(desde, f.x1);
  }
  return (mejor[0] + mejor[1]) / 2;
}

/** Un texto (o grupo de textos) que se puede correr de lugar si queda tapado. */
interface Movible {
  /** Todo lo que se mueve junto (p. ej. el cartelito y su texto). */
  todos: Prim[];
  /** La lista de primitivas donde viven, para poder sacarlas si no hay lugar. */
  lista: Prim[];
  caja: Caja;
  /** Hasta dónde puede correrse. */
  region: Caja;
  /** true = si no hay ningún lugar libre se omite (ya figura en la leyenda). */
  ocultable: boolean;
  /** true = además esquiva las franjas de solar húmedo y escalera (carteles de profundidad). */
  esquivaFranjas?: boolean;
}

/** El texto de una franja angosta (solar húmedo, escalera): horizontal si entra a lo ancho
 *  de la franja; si no, y entra a lo alto, de costado (como las medidas de los laterales). */
function etiquetaDeFranja(
  text: string, cx: number, cy: number, franjaW: number, franjaH: number, fontSize: number, fill: string
): { prim: Extract<Prim, { t: "text" }>; caja: Caja } {
  const w = text.length * fontSize * 0.56;
  const h = fontSize * 1.25;
  const vertical = w > franjaW - 4 && w <= franjaH - 8;
  const prim: Extract<Prim, { t: "text" }> = {
    t: "text", x: cx, y: cy, text, fontSize, fill, anchor: "middle", central: true,
    ...(vertical ? { rotateDeg: -90 } : {}),
  };
  const caja: Caja = vertical
    ? { x0: cx - h / 2, y0: cy - w / 2, x1: cx + h / 2, y1: cy + w / 2 }
    : { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
  return { prim, caja };
}

function trasladarPrim(p: Prim, dx: number, dy: number): void {
  if (p.t === "rect") { p.x += dx; p.y += dy; }
  else if (p.t === "circle") { p.cx += dx; p.cy += dy; }
  else if (p.t === "text") { p.x += dx; p.y += dy; }
  else if (p.t === "poly") { p.puntos = p.puntos.map(([x, y]) => [x + dx, y + dy]); }
  else { p.x1 += dx; p.x2 += dx; p.y1 += dy; p.y2 += dy; }
}

/**
 * Calcula la geometría completa del plano. Determinístico y sin efectos: la
 * misma entrada siempre da la misma salida, por eso es fácil de testear
 * (Lote 3 — paridad interactiva) sin levantar ningún DOM.
 */
export function calcularGeometriaPlano(entradaCruda: PlanoLosetasEntrada, opciones: OpcionesPlano): GeometriaPlano {
  const sRaw = PlanoLosetasEntrada.parse(entradaCruda);
  // Un lado con desborde infinito no lleva loseta — su medida se trata como
  // 0 de acá en adelante (todo el resto de la función usa `s`, nunca
  // `sRaw`, así que no hace falta tocar ningún otro cálculo: el lado ya
  // "no está" para el ancho total, la posición de la pileta, la etiqueta de
  // cota de ese lado, etc. `sRaw.desborde*` sigue disponible para decidir
  // el estilo del borde en sí más abajo).
  const s = {
    ...sRaw,
    solar: sRaw.desbordeSolar ? 0 : sRaw.solar,
    opuesto: sRaw.desbordeOpuesto ? 0 : sRaw.opuesto,
    lateral1: sRaw.desbordeLateral1 ? 0 : sRaw.lateral1,
    lateral2: sRaw.desbordeLateral2 ? 0 : sRaw.lateral2,
  };
  const { viewW, viewHmax, showDims, interactive } = opciones;

  const padTop = showDims ? 90 : 30;
  const padSide = showDims ? 130 : 90;
  const padBottom = showDims ? 110 : 60;
  // La sala de filtro y la casa se dibujan afuera del borde: se reserva su lugar en cada lado.
  // Como se arrastran a cualquier lado, se reserva lo mismo en los cuatro.
  const activos: TipoUbicacion[] = [];
  if (s.salaFiltro) activos.push("sala");
  if (s.casa) activos.push("casa");
  const reservaUbic = reservaUbicacion(activos);
  const reserva = { solar: reservaUbic, opuesto: reservaUbic, lateral1: reservaUbic, lateral2: reservaUbic };
  const maxW = viewW - padSide * 2 - reserva.solar - reserva.opuesto;
  const maxH = viewHmax - padTop - padBottom - reserva.lateral1 - reserva.lateral2;
  const totalW = s.largo + s.solar + s.opuesto;
  const totalH = s.ancho + s.lateral1 + s.lateral2;
  const pxPerM = Math.max(1, Math.min(maxW / Math.max(totalW, 0.01), maxH / Math.max(totalH, 0.01)));
  const ox = padSide + reserva.solar;
  const oy = padTop + reserva.lateral1;
  // Los bordes EXTERIORES (contando lo reservado): de ahí en adelante van cotas, títulos y leyenda.
  const arribaFuera = oy - reserva.lateral1;
  const izquierdaFuera = ox - reserva.solar;
  const derechaFuera = ox + totalW * pxPerM + reserva.opuesto;
  const abajoFuera = oy + totalH * pxPerM + reserva.lateral2;

  const poolX = ox + s.solar * pxPerM;
  const poolY = oy + s.lateral1 * pxPerM;
  const poolW = s.largo * pxPerM;
  const poolH = s.ancho * pxPerM;

  // Borde de la pileta: 4 aristas independientes (no un solo <rect> con un
  // stroke uniforme) para que un lado con desborde infinito pueda salir más
  // grueso y sin la pared blanca interior que sí llevan los lados normales.
  // El agua en sí (el <rect> con el degradé) va sin stroke — todo el borde
  // sale de acá. `sRaw.desborde*`, no `s.desborde*`: son lo mismo, pero
  // dejarlo explícito evita cualquier duda de que esto lee la bandera, no
  // una medida ya puesta en 0.
  const borde: Prim[] = [];
  const BORDE_COLOR = "#1B3A5C";
  const INSET = 2;
  function arista(desborde: boolean, x1: number, y1: number, x2: number, y2: number) {
    borde.push({ t: "line", x1, y1, x2, y2, stroke: BORDE_COLOR, strokeWidth: desborde ? 3 : 1 });
  }
  arista(sRaw.desbordeLateral1, poolX, poolY, poolX + poolW, poolY); // arriba
  arista(sRaw.desbordeLateral2, poolX, poolY + poolH, poolX + poolW, poolY + poolH); // abajo
  arista(sRaw.desbordeSolar, poolX, poolY, poolX, poolY + poolH); // izquierda
  arista(sRaw.desbordeOpuesto, poolX + poolW, poolY, poolX + poolW, poolY + poolH); // derecha
  if (!sRaw.desbordeLateral1) {
    borde.push({ t: "line", x1: poolX + INSET, y1: poolY + INSET, x2: poolX + poolW - INSET, y2: poolY + INSET, stroke: "#ffffff", strokeWidth: 1, opacity: 0.35 });
  }
  if (!sRaw.desbordeLateral2) {
    borde.push({ t: "line", x1: poolX + INSET, y1: poolY + poolH - INSET, x2: poolX + poolW - INSET, y2: poolY + poolH - INSET, stroke: "#ffffff", strokeWidth: 1, opacity: 0.35 });
  }
  if (!sRaw.desbordeSolar) {
    borde.push({ t: "line", x1: poolX + INSET, y1: poolY + INSET, x2: poolX + INSET, y2: poolY + poolH - INSET, stroke: "#ffffff", strokeWidth: 1, opacity: 0.35 });
  }
  if (!sRaw.desbordeOpuesto) {
    borde.push({ t: "line", x1: poolX + poolW - INSET, y1: poolY + INSET, x2: poolX + poolW - INSET, y2: poolY + poolH - INSET, stroke: "#ffffff", strokeWidth: 1, opacity: 0.35 });
  }
  const DESBORDE_LABEL = "Desborde infinito";
  if (sRaw.desbordeLateral1 && poolW > 100) {
    borde.push({ t: "text", x: poolX + poolW / 2, y: poolY + 15, text: DESBORDE_LABEL, fontSize: 10, fill: BORDE_COLOR, anchor: "middle", central: true, weight: "bold" });
  }
  if (sRaw.desbordeLateral2 && poolW > 100) {
    borde.push({ t: "text", x: poolX + poolW / 2, y: poolY + poolH - 15, text: DESBORDE_LABEL, fontSize: 10, fill: BORDE_COLOR, anchor: "middle", central: true, weight: "bold" });
  }
  if (sRaw.desbordeSolar && poolH > 100) {
    borde.push({ t: "text", x: poolX + 15, y: poolY + poolH / 2, text: DESBORDE_LABEL, fontSize: 10, fill: BORDE_COLOR, anchor: "middle", central: true, weight: "bold", rotateDeg: -90 });
  }
  if (sRaw.desbordeOpuesto && poolH > 100) {
    borde.push({ t: "text", x: poolX + poolW - 15, y: poolY + poolH / 2, text: DESBORDE_LABEL, fontSize: 10, fill: BORDE_COLOR, anchor: "middle", central: true, weight: "bold", rotateDeg: -90 });
  }

  // Los textos "Desborde infinito" quedan pegados a su pared: no se mueven, pero
  // los objetos y las etiquetas tienen que esquivarlos.
  const fijos: Caja[] = [];
  for (const p of borde) {
    if (p.t !== "text") continue;
    const c = cajaDeTexto(p);
    fijos.push(
      p.rotateDeg
        ? { x0: p.x - (c.y1 - c.y0) / 2, y0: p.y - (c.x1 - c.x0) / 2, x1: p.x + (c.y1 - c.y0) / 2, y1: p.y + (c.x1 - c.x0) / 2 }
        : c
    );
  }

  const grid: PrimLine[] = [];
  if (showDims) {
    for (let gx = 0; gx <= totalW + 0.001; gx++) {
      const x = ox + gx * pxPerM;
      grid.push({ t: "line", x1: x, y1: oy, x2: x, y2: oy + totalH * pxPerM, stroke: "#000", strokeWidth: 0.4, opacity: 0.07 });
    }
    for (let gy = 0; gy <= totalH + 0.001; gy++) {
      const y = oy + gy * pxPerM;
      grid.push({ t: "line", x1: ox, y1: y, x2: ox + totalW * pxPerM, y2: y, stroke: "#000", strokeWidth: 0.4, opacity: 0.07 });
    }
  }

  const extras: Prim[] = [];
  const marcadores: Marcador[] = [];
  const movibles: Movible[] = [];
  /** Las franjas de solar húmedo y escalera: áreas que los carteles de profundidad esquivan. */
  const franjas: Caja[] = [];
  /** Los carteles de profundidad se dibujan DESPUÉS de las franjas, para que no queden tapados. */
  const carteles: Prim[] = [];
  const zonaPool: Caja = { x0: poolX, y0: poolY, x1: poolX + poolW, y1: poolY + poolH };
  // Las etiquetas de franja (solar húmedo, escalera) pueden ser más anchas que su franja: se
  // dibujan centradas y se desbordan un poco. Se les deja correrse sólo en vertical por ahí.
  const zonaEtiquetas: Caja = { x0: poolX - 24, y0: poolY, x1: poolX + poolW + 24, y1: poolY + poolH };

  // Profundidad por tramos: franjas más oscuras cuanto más profundas, cortes
  // entre una y otra, y un cartel por franja con su profundidad y su rango.
  const zonas = zonasProfundidad(s.profundidad, s.tramosProfundidad, s.largo);
  if (zonas.length > 1) {
    const valores = zonas.map((z) => z.prof);
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    for (const z of zonas) {
      const peso = max > min ? (z.prof - min) / (max - min) : 0;
      extras.push({
        t: "rect", x: poolX + z.desde * pxPerM, y: poolY, w: (z.hasta - z.desde) * pxPerM, h: poolH,
        fill: "#1B3A5C", opacity: 0.03 + 0.13 * peso,
      });
    }
    for (const corte of cortesProfundidad(zonas)) {
      const x = poolX + corte * pxPerM;
      extras.push({ t: "line", x1: x, y1: poolY, x2: x, y2: poolY + poolH, stroke: "#1B3A5C", strokeWidth: 0.9, opacity: 0.55 });
    }
    const fz = showDims ? 13 : 11;
    for (const z of zonas) {
      const zx0 = poolX + z.desde * pxPerM;
      const zx1 = poolX + z.hasta * pxPerM;
      const principal = `${fmtProfundidad(z.prof)} m`;
      if (zx1 - zx0 < principal.length * fz * 0.56 + 10) continue; // no entra: el título lo resume
      const cx = (zx0 + zx1) / 2;
      const cy = poolY + poolH * 0.3;
      const titulo: Prim = { t: "text", x: cx, y: cy, text: principal, fontSize: fz, fill: "#1B3A5C", anchor: "middle", central: true, weight: "bold" };
      const rango = `${fmtM(z.desde)} a ${fmtM(z.hasta)} m`;
      const todos: Prim[] = [titulo];
      const cajas = [cajaDeTexto(titulo as Extract<Prim, { t: "text" }>)];
      if (zx1 - zx0 >= rango.length * 10 * 0.56 + 10) {
        const sub: Prim = { t: "text", x: cx, y: cy + fz + 2, text: rango, fontSize: 10, fill: "#1B3A5C", anchor: "middle", central: true, opacity: 0.7 };
        todos.push(sub);
        cajas.push(cajaDeTexto(sub as Extract<Prim, { t: "text" }>));
      }
      carteles.push(...todos);
      movibles.push({
        todos, lista: extras, caja: unirCajas(cajas), region: { x0: zx0, y0: poolY, x1: zx1, y1: poolY + poolH },
        ocultable: false, esquivaFranjas: true,
      });
    }
  }

  if (s.solarHumedo && s.solarHumedoAncho > 0) {
    const shW = Math.min(s.solarHumedoAncho, s.largo) * pxPerM;
    extras.push({ t: "rect", x: poolX, y: poolY, w: shW, h: poolH, fill: "#BFE0EF", opacity: 0.8 });
    franjas.push({ x0: poolX, y0: poolY, x1: poolX + shW, y1: poolY + poolH });
    if (shW > 60) {
      const { prim: etiqueta, caja } = etiquetaDeFranja(
        `Solar húmedo${showDims ? " (" + fmtM(s.solarHumedoAncho) + "m)" : ""}`,
        poolX + shW / 2, poolY + poolH / 2, shW, poolH, 12, "#0C447C"
      );
      extras.push(etiqueta);
      movibles.push({ todos: [etiqueta], lista: extras, caja, region: zonaEtiquetas, ocultable: true });
    }
  }

  if (s.escalera && s.escaleraMovible) {
    // Objeto chico que se arrastra a mano, igual que una luz — para
    // escaleras de esquina que no ocupan todo el lado (tipo "romana").
    const lado = Math.max(20, Math.min(s.escaleraAncho * pxPerM, poolW * 0.4, poolH * 0.4));
    const p = s.escaleraPosLibre;
    const centroX = poolX + Math.max(0, Math.min(1, p.x)) * poolW;
    const centroY = poolY + Math.max(0, Math.min(1, p.y)) * poolH;
    const ex = centroX - lado / 2;
    const ey = centroY - lado / 2;
    const primsEscalera: Prim[] = [
      { t: "rect", x: ex, y: ey, w: lado, h: lado, fill: "#fff", stroke: "#1B3A5C", strokeWidth: 1.2, dash: "3 2" },
    ];
    if (lado > 30) {
      primsEscalera.push({ t: "text", x: centroX, y: centroY, text: "Escalera", fontSize: 9, fill: "#1B3A5C", anchor: "middle", central: true });
    }
    extras.push(...primsEscalera);
    marcadores.push({ prims: primsEscalera, caja: { x0: ex, y0: ey, x1: ex + lado, y1: ey + lado } });
    if (interactive) {
      extras.push({ t: "circle", cx: centroX, cy: centroY, r: 28, fill: "transparent", drag: { tipo: "escalera", indice: 0 } });
    }
  } else if (s.escalera && s.escaleraEscalones > 0 && s.escaleraMedidaEscalon > 0) {
    // Franja completa a lo ancho/largo del lado elegido — no un cuadrado en
    // una esquina (así se construye en la práctica: la escalera suele correr
    // toda la pared, a menudo pegada al solar húmedo). Cuando comparte el
    // lado del solar con un solar húmedo activo, arranca justo después de
    // ese, en fila, en vez de superponerse.
    //
    // La profundidad SALE de escalones × medida de escalón (no es un ancho
    // suelto): así se pide en obra ("3 escalones de 30") y así queda
    // rotulada — "Escalera (0,9m)" para 3 × 0,30.
    const profundidad = s.escaleraEscalones * s.escaleraMedidaEscalon;
    const horizontal = s.escaleraPos === "solar" || s.escaleraPos === "opuesto";
    const anchoDisponible = horizontal ? s.largo : s.ancho;
    const anchoPx = Math.min(profundidad, anchoDisponible) * pxPerM;
    const medidaEscalonPx = s.escaleraMedidaEscalon * pxPerM;
    let ex: number, ey: number, ew: number, eh: number;
    if (horizontal) {
      ew = anchoPx;
      eh = poolH;
      ey = poolY;
      if (s.escaleraPos === "opuesto") {
        ex = poolX + poolW - anchoPx;
      } else {
        const offsetSolarHumedo = s.solarHumedo ? Math.min(s.solarHumedoAncho, s.largo) * pxPerM : 0;
        ex = poolX + offsetSolarHumedo;
      }
    } else {
      ew = poolW;
      eh = anchoPx;
      ex = poolX;
      ey = s.escaleraPos === "lateral2" ? poolY + poolH - anchoPx : poolY;
    }
    extras.push({ t: "rect", x: ex, y: ey, w: ew, h: eh, fill: "#fff", stroke: "#1B3A5C", strokeWidth: 1.2, dash: "3 2" });

    // Líneas divisorias entre escalones — sólo si entran holgados (si no,
    // queda un enrejado ilegible en vez de una ayuda visual).
    if (medidaEscalonPx > 6) {
      for (let i = 1; i < s.escaleraEscalones; i++) {
        if (horizontal) {
          const lx = ex + i * medidaEscalonPx;
          extras.push({ t: "line", x1: lx, y1: ey, x2: lx, y2: ey + eh, stroke: "#1B3A5C", strokeWidth: 0.75, opacity: 0.5 });
        } else {
          const ly = ey + i * medidaEscalonPx;
          extras.push({ t: "line", x1: ex, y1: ly, x2: ex + ew, y2: ly, stroke: "#1B3A5C", strokeWidth: 0.75, opacity: 0.5 });
        }
      }
    }

    franjas.push({ x0: ex, y0: ey, x1: ex + ew, y1: ey + eh });
    const cabe = horizontal ? ew > 46 : eh > 32;
    if (cabe) {
      const { prim: etiqueta, caja } = etiquetaDeFranja(
        `Escalera${showDims ? " (" + fmtM(profundidad) + "m)" : ""}`,
        ex + ew / 2, ey + eh / 2, ew, eh, 11, "#1B3A5C"
      );
      extras.push(etiqueta);
      movibles.push({ todos: [etiqueta], lista: extras, caja, region: zonaEtiquetas, ocultable: true });
    }
  }

  let espejoW = s.largo;
  let espejoH = s.ancho;
  if (s.tipoPileta === "fibra" && s.labios > 0) {
    const labiosPx = s.labios * pxPerM;
    espejoW = Math.max(0, s.largo - 2 * s.labios);
    espejoH = Math.max(0, s.ancho - 2 * s.labios);
    extras.push({
      t: "rect", x: poolX + labiosPx, y: poolY + labiosPx,
      w: Math.max(0, poolW - 2 * labiosPx), h: Math.max(0, poolH - 2 * labiosPx),
      rx: 3, fill: "none", stroke: "#1B3A5C", strokeWidth: 1, dash: "4 3", opacity: 0.6,
    });
    if (showDims && poolW - 2 * labiosPx > 90) {
      const etiqueta: Extract<Prim, { t: "text" }> = {
        t: "text", x: poolX + poolW / 2, y: poolY + labiosPx + 14,
        text: `Espejo de agua ${fmtM(espejoW)} x ${fmtM(espejoH)} m`,
        fontSize: 11, fill: "#1B3A5C", anchor: "middle", opacity: 0.75,
      };
      extras.push(etiqueta);
      movibles.push({ todos: [etiqueta], lista: extras, caja: cajaDeTexto(etiqueta), region: zonaPool, ocultable: true });
    }
  }

  extras.push(...carteles);

  if (s.luces && s.cantLuces > 0) {
    const n = s.cantLuces;
    const glowR = showDims ? 16 : 13;
    const bulbR = showDims ? 6 : 5;
    for (let i = 0; i < n; i++) {
      const p = s.lucesPos[i] || posicionPorDefecto("luz", i, n);
      const cx = poolX + Math.max(0, Math.min(1, p.x)) * poolW;
      const cy = poolY + Math.max(0, Math.min(1, p.y)) * poolH;
      const prims: Prim[] = [
        { t: "circle", cx, cy, r: glowR, fill: "url(#luzGlow)" },
        { t: "circle", cx, cy, r: bulbR, fill: "#FFEFA8", stroke: "#C99A2E", strokeWidth: 1.2 },
        { t: "circle", cx: cx - bulbR * 0.32, cy: cy - bulbR * 0.32, r: bulbR * 0.32, fill: "#FFFDF3" },
      ];
      extras.push(...prims);
      marcadores.push({ prims, caja: { x0: cx - bulbR - 5, y0: cy - bulbR - 5, x1: cx + bulbR + 5, y1: cy + bulbR + 5 } });
      if (interactive) {
        // r=28 (no 16): en un celular, el viewBox de 680 se ve achicado a
        // ~340px de pantalla — un radio de agarre chico ahí es casi
        // imposible de tocar con el dedo sin fallar. Con varias luces cerca,
        // además, un número al lado de cada una ayuda a saber cuál es cuál
        // mientras se arrastra (no hay cursor que la resalte en touch).
        extras.push({ t: "circle", cx, cy, r: 28, fill: "transparent", drag: { tipo: "luz", indice: i } });
        if (n > 1) {
          extras.push({ t: "text", x: cx, y: cy - glowR - 9, text: String(i + 1), fontSize: 10, fill: "#7a4a2e", anchor: "middle", central: true, weight: "bold" });
        }
      }
    }
  }

  if (s.skimmer && s.cantSkimmers > 0) {
    // Caja de pared chica y fija en pantalla (no escala con pxPerM, igual
    // que el foco de las luces) — a esta escala un skimmer "a tamaño real"
    // sería un punto invisible. La ranura oscura en el medio es lo que lo
    // distingue (y en la leyenda) de cualquier otro cuadradito del plano.
    const n = s.cantSkimmers;
    const sw = showDims ? 24 : 20;
    const sh = showDims ? 15 : 13;
    for (let i = 0; i < n; i++) {
      const p = s.skimmersPos[i] || posicionPorDefecto("skimmer", i, n);
      const cx = poolX + Math.max(0, Math.min(1, p.x)) * poolW;
      const cy = poolY + Math.max(0, Math.min(1, p.y)) * poolH;
      const prims: Prim[] = [
        { t: "rect", x: cx - sw / 2, y: cy - sh / 2, w: sw, h: sh, rx: 2, fill: "#EAF0F3", stroke: "#1B3A5C", strokeWidth: 1 },
        { t: "rect", x: cx - sw / 2 + 3, y: cy - 2, w: sw - 6, h: 4, rx: 1, fill: "#1B3A5C", opacity: 0.55 },
      ];
      extras.push(...prims);
      marcadores.push({ prims, caja: { x0: cx - sw / 2, y0: cy - sh / 2, x1: cx + sw / 2, y1: cy + sh / 2 } });
      if (interactive) {
        extras.push({ t: "circle", cx, cy, r: 28, fill: "transparent", drag: { tipo: "skimmer", indice: i } });
        if (n > 1) {
          extras.push({ t: "text", x: cx, y: cy - sh / 2 - 9, text: String(i + 1), fontSize: 10, fill: "#3D5A6B", anchor: "middle", central: true, weight: "bold" });
        }
      }
    }
  }

  if (s.hidromasaje && s.cantHidromasajes > 0) {
    // Boquilla/jet: dos círculos concéntricos en tonos celeste-teal — a
    // propósito bien distinto del amarillo de una luz, para no confundirlos
    // de un vistazo en un plano con varios objetos chicos.
    const n = s.cantHidromasajes;
    const rExt = showDims ? 10 : 8;
    const rInt = showDims ? 4.5 : 4;
    for (let i = 0; i < n; i++) {
      const p = s.hidromasajesPos[i] || posicionPorDefecto("hidromasaje", i, n);
      const cx = poolX + Math.max(0, Math.min(1, p.x)) * poolW;
      const cy = poolY + Math.max(0, Math.min(1, p.y)) * poolH;
      const prims: Prim[] = [
        { t: "circle", cx, cy, r: rExt, fill: "#ffffff", stroke: "#0C7A8C", strokeWidth: 1.4 },
        { t: "circle", cx, cy, r: rInt, fill: "#4FC7D9", stroke: "#0C7A8C", strokeWidth: 1 },
      ];
      extras.push(...prims);
      marcadores.push({ prims, caja: { x0: cx - rExt - 1, y0: cy - rExt - 1, x1: cx + rExt + 1, y1: cy + rExt + 1 } });
      if (interactive) {
        extras.push({ t: "circle", cx, cy, r: 28, fill: "transparent", drag: { tipo: "hidromasaje", indice: i } });
        if (n > 1) {
          extras.push({ t: "text", x: cx, y: cy - rExt - 9, text: String(i + 1), fontSize: 10, fill: "#0C7A8C", anchor: "middle", central: true, weight: "bold" });
        }
      }
    }
  }

  // Un solo cartel de ayuda para todo lo arrastrable — si hubiera uno por
  // objeto se pisarían en el mismo renglón, debajo del plano.
  if (interactive) {
    const arrastrables: string[] = [];
    if (s.luces && s.cantLuces > 0) arrastrables.push(s.cantLuces > 1 ? "las luces" : "la luz");
    if (s.escalera && s.escaleraMovible) arrastrables.push("la escalera");
    if (s.skimmer && s.cantSkimmers > 0) arrastrables.push(s.cantSkimmers > 1 ? "los skimmers" : "el skimmer");
    if (s.hidromasaje && s.cantHidromasajes > 0) arrastrables.push(s.cantHidromasajes > 1 ? "los hidromasajes" : "el hidromasaje");
    if (s.salaFiltro) arrastrables.push("la sala de filtro");
    if (s.casa) arrastrables.push("la casa");
    if (arrastrables.length > 0) {
      // "Arrastrá X donde quieras" (sin "para ubicarla(s)/lo(s)") a
      // propósito: mezclando luz/escalera (femenino) con skimmer/
      // hidromasaje (masculino) no hay un pronombre que concuerde con
      // todos a la vez — más simple sacarlo que forzar una concordancia.
      const lista =
        arrastrables.length === 1
          ? arrastrables[0]
          : `${arrastrables.slice(0, -1).join(", ")} y ${arrastrables[arrastrables.length - 1]}`;
      extras.push({
        t: "text", x: ox + (totalW * pxPerM) / 2, y: abajoFuera + 34,
        text: `Arrastrá ${lista} donde quieras`,
        fontSize: 11, fill: "#B98A1E", anchor: "middle",
      });
    }
  }

  // Sala de filtro y casa: se arrastran, pero quedan siempre afuera del borde, pegadas a un lado.
  const bordeCaja = { x: ox, y: oy, w: totalW * pxPerM, h: totalH * pxPerM };
  const cajasUbicadas: CajaUbicada[] = [];
  const posLibre: Record<TipoUbicacion, LuzPos | null> = { sala: s.salaPosLibre, casa: s.casaPosLibre };
  for (const tipo of activos) {
    const p = posLibre[tipo];
    const centro = p ? { x: ox + p.x * pxPerM, y: oy + p.y * pxPerM } : centroPorDefecto(tipo, bordeCaja);
    let caja = colocarObjeto(tipo, centro, bordeCaja, reservaUbic);
    // La casa se corre si quedó encima de la sala (la sala se coloca primero).
    const sala = cajasUbicadas.find((c) => c.tipo === "sala");
    if (tipo === "casa" && sala) caja = separarObjetos(sala, caja, bordeCaja, reservaUbic);
    cajasUbicadas.push(caja);
    extras.push(...dibujarObjetoUbicado(caja));
    if (interactive) {
      extras.push({ t: "circle", cx: caja.x + caja.w / 2, cy: caja.y + caja.h / 2, r: Math.min(26, caja.h / 2 + 2), fill: "transparent", drag: { tipo, indice: 0 } });
    }
  }
  // Puntos cardinales: arriba a la derecha, en el margen (nunca encima del plano).
  if (s.puntosCardinales) {
    const r = showDims ? 24 : 17;
    extras.push(...dibujarBrujula(viewW - (showDims ? 66 : 46), showDims ? 66 : 42, r, s.norteGrados, showDims ? 12 : 10));
  }

  const dimColor = "#1B3A5C";
  const labelColor = "#7a4a2e";

  const aguaBottom = s.colorAgua || "#A6D1EC";
  const aguaTop = String(aguaBottom).toLowerCase() === "#a6d1ec" ? "#E7F3FC" : aclararHex(aguaBottom, 0.6);
  const losetaFill = s.colorLoseta || COLOR_BORDE_POR_DEFECTO;

  const revestText = s.revestimiento ? REVEST_LABELS[s.revestimiento] || (s.revestimiento === "otro" ? s.revestimientoOtro || "Otro" : "") : "";
  const revestTextFinal = s.revestimiento === "otro" ? s.revestimientoOtro || "Otro" : revestText;

  const dims: Prim[] = [];

  if (showDims) {
    dims.push({
      t: "text", x: poolX + poolW / 2, y: arribaFuera - 13,
      text: `Pileta ${fmtM(s.largo)} x ${fmtM(s.ancho)} m${resumenProfundidad(zonas) ? " · Prof. " + resumenProfundidad(zonas) : ""}`,
      fontSize: 17, fill: dimColor, anchor: "middle", weight: "bold",
    });

    if (revestTextFinal && poolH > 90 && poolW > 150) {
      const chipLabel = "Revestimiento: " + revestTextFinal;
      const chipW = Math.min(poolW - 16, chipLabel.length * 7.0 + 28);
      const chipH = 26;
      const chipX = poolX + poolW / 2 - chipW / 2;
      const chipY = poolY + poolH - chipH - 16;
      const chipRect: Prim = { t: "rect", x: chipX, y: chipY, w: chipW, h: chipH, rx: 13, fill: "#ffffff", stroke: dimColor, strokeWidth: 0.75, opacity: 0.94 };
      const chipTexto: Prim = { t: "text", x: poolX + poolW / 2, y: chipY + chipH / 2, text: chipLabel, fontSize: 13, fill: dimColor, anchor: "middle", central: true };
      dims.push(chipRect, chipTexto);
      movibles.push({
        todos: [chipRect, chipTexto], lista: dims, caja: { x0: chipX, y0: chipY, x1: chipX + chipW, y1: chipY + chipH },
        region: zonaPool, ocultable: false,
      });
    }

    const topY = arribaFuera - 34;
    dims.push({ t: "line", x1: ox, y1: topY, x2: ox + totalW * pxPerM, y2: topY, stroke: dimColor, strokeWidth: 0.75 });
    dims.push(tickH(ox, topY, dimColor));
    dims.push(tickH(ox + totalW * pxPerM, topY, dimColor));
    dims.push({ t: "text", x: ox + (totalW * pxPerM) / 2, y: topY - 10, text: `Borde total: ${fmtM(totalW)} m`, fontSize: 13, fill: dimColor, anchor: "middle" });

    const leftX = Math.max(40, izquierdaFuera - 60);
    dims.push({ t: "line", x1: leftX, y1: oy, x2: leftX, y2: oy + totalH * pxPerM, stroke: dimColor, strokeWidth: 0.75 });
    dims.push(tick(leftX, oy, dimColor));
    dims.push(tick(leftX, oy + totalH * pxPerM, dimColor));
    dims.push({
      t: "text", x: leftX - 16, y: oy + (totalH * pxPerM) / 2,
      text: `Borde total: ${fmtM(totalH)} m`, fontSize: 13, fill: dimColor, anchor: "middle", central: true,
      rotateDeg: -90,
    });

    if (s.lateral1 * pxPerM > 16) {
      dims.push({ t: "text", x: poolX + poolW / 2, y: oy + (s.lateral1 * pxPerM) / 2, text: `${s.lblLateral1}: ${fmtM(s.lateral1)} m`, fontSize: 13, fill: labelColor, anchor: "middle", central: true });
    }
    if (s.lateral2 * pxPerM > 16) {
      dims.push({ t: "text", x: poolX + poolW / 2, y: oy + s.lateral1 * pxPerM + poolH + (s.lateral2 * pxPerM) / 2, text: `${s.lblLateral2}: ${fmtM(s.lateral2)} m`, fontSize: 13, fill: labelColor, anchor: "middle", central: true });
    }
    if (s.solar * pxPerM > 22) {
      dims.push({
        t: "text", x: ox + (s.solar * pxPerM) / 2, y: poolY + poolH / 2,
        text: `${s.lblSolar}: ${fmtM(s.solar)} m`, fontSize: 13, fill: labelColor, anchor: "middle", central: true,
        rotateDeg: -90,
      });
    }
    if (s.opuesto * pxPerM > 22) {
      dims.push({
        t: "text", x: ox + s.solar * pxPerM + poolW + (s.opuesto * pxPerM) / 2, y: poolY + poolH / 2,
        text: `${s.lblOpuesto}: ${fmtM(s.opuesto)} m`, fontSize: 13, fill: labelColor, anchor: "middle", central: true,
        rotateDeg: -90,
      });
    }
  } else {
    // Las medidas de cada lado van DENTRO del borde, pegadas a su lado (como en el plano del cliente): así
    // quedan junto a lo que miden aunque haya una sala o una casa alrededor.
    const lbl = { fontSize: 11, fill: labelColor, anchor: "middle" as const, central: true };
    if (s.lateral1 * pxPerM > 16) dims.push({ t: "text", x: poolX + poolW / 2, y: oy + (s.lateral1 * pxPerM) / 2, text: `${s.lblLateral1}: ${fmtM(s.lateral1)} m`, ...lbl });
    if (s.lateral2 * pxPerM > 16) dims.push({ t: "text", x: poolX + poolW / 2, y: oy + s.lateral1 * pxPerM + poolH + (s.lateral2 * pxPerM) / 2, text: `${s.lblLateral2}: ${fmtM(s.lateral2)} m`, ...lbl });
    if (s.solar * pxPerM > 22) dims.push({ t: "text", x: ox + (s.solar * pxPerM) / 2, y: poolY + poolH / 2, text: `${s.lblSolar}: ${fmtM(s.solar)} m`, ...lbl, rotateDeg: -90 });
    if (s.opuesto * pxPerM > 22) dims.push({ t: "text", x: ox + s.solar * pxPerM + poolW + (s.opuesto * pxPerM) / 2, y: poolY + poolH / 2, text: `${s.lblOpuesto}: ${fmtM(s.opuesto)} m`, ...lbl, rotateDeg: -90 });
    // El texto central va en el medio del agua que queda libre (no encima del solar húmedo ni de la escalera).
    const xTexto = centroLibreX(poolX, poolX + poolW, poolH, franjas);
    dims.push({
      t: "text", x: xTexto, y: poolY + poolH / 2 - (revestTextFinal ? 8 : 0),
      text: `${fmtM(s.largo)} x ${fmtM(s.ancho)} m`, fontSize: 14, fill: "#1B3A5C", anchor: "middle", central: true,
    });
    if (revestTextFinal) {
      dims.push({
        t: "text", x: xTexto, y: poolY + poolH / 2 + 12,
        text: `Revestimiento: ${revestTextFinal}`, fontSize: 10, fill: "#1B3A5C", anchor: "middle", central: true, opacity: 0.7,
      });
    }
  }

  // Un lado angosto (o sin borde, medida 0) no tiene lugar para su medida adentro: va afuera, pegada
  // a ese lado, así ninguno queda sin decir cuánto mide. (Arriba/abajo sólo en el editor: en el plano
  // del cliente ahí van el título y las cotas.)
  {
    const fs = showDims ? 13 : 11;
    const angosto = (px: number, min: number, desborde: boolean) => !desborde && px <= min;
    if (angosto(s.solar * pxPerM, 22, sRaw.desbordeSolar)) {
      dims.push({ t: "text", x: ox - 11, y: poolY + poolH / 2, text: `${s.lblSolar}: ${fmtM(s.solar)} m`, fontSize: fs, fill: labelColor, anchor: "middle", central: true, rotateDeg: -90 });
    }
    if (angosto(s.opuesto * pxPerM, 22, sRaw.desbordeOpuesto)) {
      dims.push({ t: "text", x: ox + totalW * pxPerM + 11, y: poolY + poolH / 2, text: `${s.lblOpuesto}: ${fmtM(s.opuesto)} m`, fontSize: fs, fill: labelColor, anchor: "middle", central: true, rotateDeg: -90 });
    }
    if (!showDims) {
      if (angosto(s.lateral1 * pxPerM, 16, sRaw.desbordeLateral1)) {
        dims.push({ t: "text", x: poolX + poolW / 2, y: oy - 11, text: `${s.lblLateral1}: ${fmtM(s.lateral1)} m`, fontSize: fs, fill: labelColor, anchor: "middle", central: true });
      }
      if (angosto(s.lateral2 * pxPerM, 16, sRaw.desbordeLateral2)) {
        dims.push({ t: "text", x: poolX + poolW / 2, y: oy + totalH * pxPerM + 11, text: `${s.lblLateral2}: ${fmtM(s.lateral2)} m`, fontSize: fs, fill: labelColor, anchor: "middle", central: true });
      }
    }
  }

  // ── Que nada quede pisado ──────────────────────────────────────────────────
  // 1) Objetos (luces, skimmers, hidromasajes, escalera libre). En el plano del
  //    cliente (el que se entrega), si uno cae sobre otro o sobre un texto
  //    fijo se lo corre lo mínimo hasta un lugar libre. En el editor NO: ahí
  //    lo que se arrastra es lo que se ve.
  const zonaObjetos: Caja = { x0: poolX - 16, y0: poolY - 16, x1: poolX + poolW + 16, y1: poolY + poolH + 16 };
  const colocados: Caja[] = [];
  for (const m of marcadores) {
    if (showDims) {
      const lugar = buscarLugarLibre(m.caja, zonaObjetos, [...fijos, ...colocados], 6, 2);
      if (lugar && (lugar.dx !== 0 || lugar.dy !== 0)) {
        for (const p of m.prims) trasladarPrim(p, lugar.dx, lugar.dy);
        m.caja = trasladarCaja(m.caja, lugar.dx, lugar.dy);
      }
    }
    colocados.push(m.caja);
  }
  // 2) Textos y cartelitos: se corren a un lugar libre; si no hay (y ya figuran
  //    en la leyenda) se omiten.
  const ocupados: Caja[] = [...fijos, ...colocados];
  for (const e of movibles) {
    const lugar = buscarLugarLibre(e.caja, e.region, e.esquivaFranjas ? [...ocupados, ...franjas] : ocupados, 6, 2);
    if (lugar) {
      if (lugar.dx !== 0 || lugar.dy !== 0) for (const p of e.todos) trasladarPrim(p, lugar.dx, lugar.dy);
      ocupados.push(trasladarCaja(e.caja, lugar.dx, lugar.dy));
    } else if (e.ocultable) {
      for (const p of e.todos) {
        const k = e.lista.indexOf(p);
        if (k >= 0) e.lista.splice(k, 1);
      }
    } else {
      ocupados.push(e.caja);
    }
  }

  let svgH = abajoFuera + padBottom;
  const legend: LegendItem[] = [];

  if (showDims) {
    const legItems: { kind: LegendItem["kind"]; label: string }[] = [
      { kind: "loseta", label: leyendaDeBorde(s.materialBorde, s.tonoBorde) },
      { kind: "pileta", label: "Pileta" },
    ];
    if (s.solarHumedo && s.solarHumedoAncho > 0) legItems.push({ kind: "solarhumedo", label: "Solar húmedo" });
    if (s.tipoPileta === "fibra" && s.labios > 0) legItems.push({ kind: "espejo", label: "Espejo de agua" });
    if (s.escalera) legItems.push({ kind: "escalera", label: "Escalera" });
    if (s.luces && s.cantLuces > 0) legItems.push({ kind: "luz", label: "Luz" });
    if (s.skimmer && s.cantSkimmers > 0) legItems.push({ kind: "skimmer", label: "Skimmer" });
    if (s.hidromasaje && s.cantHidromasajes > 0) legItems.push({ kind: "hidromasaje", label: "Hidromasaje" });
    if (s.salaFiltro) legItems.push({ kind: "sala", label: "Sala de filtro" });
    if (s.casa) legItems.push({ kind: "casa", label: "Casa" });

    const swW = 18, swGap = 8, itemGap = 30, rowH = 28;
    const maxRight = derechaFuera;
    let lx = ox;
    let ly = abajoFuera + 62;
    for (const it of legItems) {
      const w = swW + swGap + it.label.length * 7.4 + itemGap;
      if (lx + w > maxRight && lx > ox) { lx = ox; ly += rowH; }
      legend.push({ x: lx, y: ly, kind: it.kind, label: it.label });
      lx += w;
    }
    svgH = ly + 24;
  }

  return {
    viewW,
    svgH,
    pool: { x: poolX, y: poolY, w: poolW, h: poolH },
    caja: { x: ox, y: oy, w: totalW * pxPerM, h: totalH * pxPerM, pxPerM },
    colores: { aguaTop, aguaBottom, losetaFill },
    fondo: { t: "rect", x: ox, y: oy, w: totalW * pxPerM, h: totalH * pxPerM, rx: 6, fill: losetaFill, stroke: "#C0522D", strokeWidth: 1 },
    grid,
    borde,
    extras,
    dims,
    legend,
  };
}
