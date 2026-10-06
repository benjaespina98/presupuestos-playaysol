import type { Prim } from "./losetas";

/**
 * Ubicación de la pileta en el terreno: puntos cardinales, sala de filtro y casa.
 *
 * Motor puro (sin DOM): devuelve primitivas de dibujo, igual que el resto de
 * `lib/domain/plano`. La sala de filtro y la casa se ubican a mano (se arrastran
 * como las luces) pero siempre quedan FUERA del borde (losetas, decks,
 * travertino), pegadas a uno de los cuatro lados: el plano reserva ese lugar,
 * así que nunca pisan la pileta ni el borde ni las cotas.
 */

export type TipoUbicacion = "sala" | "casa";

/** Hacia dónde apunta el norte en el plano (grados en sentido horario; 0 = arriba). */
export const DIRECCIONES_NORTE = [
  { grados: 0, etiqueta: "Arriba" },
  { grados: 45, etiqueta: "Arriba a la derecha" },
  { grados: 90, etiqueta: "A la derecha" },
  { grados: 135, etiqueta: "Abajo a la derecha" },
  { grados: 180, etiqueta: "Abajo" },
  { grados: 225, etiqueta: "Abajo a la izquierda" },
  { grados: 270, etiqueta: "A la izquierda" },
  { grados: 315, etiqueta: "Arriba a la izquierda" },
] as const;

export const COLORES_UBICACION = {
  salaFondo: "#4B5563",
  salaBorde: "#2F3742",
  casaFondo: "#E4DED2",
  casaBorde: "#7C6F58",
  casaTexto: "#5B5240",
} as const;

/** Tamaño de cada objeto en el dibujo (px): `largo` a lo largo del lado, `prof` hacia afuera del borde. */
const TAMANO: Record<TipoUbicacion, { largo: number; prof: number }> = {
  sala: { largo: 84, prof: 44 },
  casa: { largo: 130, prof: 64 },
};
/** Separación mínima entre el borde del plano y el objeto. */
const SEPARACION = 8;

export interface Caja2 {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CajaUbicada extends Caja2 {
  tipo: TipoUbicacion;
}

/** Lo que hay que reservar alrededor del borde, en los cuatro lados, para que los objetos activos entren. */
export function reservaUbicacion(activos: TipoUbicacion[]): number {
  if (activos.length === 0) return 0;
  return SEPARACION + Math.max(...activos.map((t) => TAMANO[t].prof));
}

const acotar = (v: number, min: number, max: number) => Math.max(min, Math.min(v, Math.max(min, max)));

/** Dónde nace cada objeto si todavía no se lo movió: la sala del lado opuesto (abajo a la derecha), la casa del lado del solar. */
export function centroPorDefecto(tipo: TipoUbicacion, borde: Caja2): { x: number; y: number } {
  const { largo, prof } = TAMANO[tipo];
  if (tipo === "sala") return { x: borde.x + borde.w + SEPARACION + prof / 2, y: borde.y + borde.h - largo / 2 };
  return { x: borde.x - SEPARACION - prof / 2, y: borde.y + borde.h / 2 };
}

/**
 * Coloca un objeto de modo que quede SIEMPRE afuera del borde, pegado al lado
 * al que corresponde su centro (el que más lo "saca" del borde), con su lado
 * largo a lo largo de ese lado y dentro de la zona reservada. Es lo que hace que
 * arrastrarlo a cualquier parte nunca lo meta sobre las losetas ni sobre las cotas.
 */
export function colocarObjeto(tipo: TipoUbicacion, centro: { x: number; y: number }, borde: Caja2, reserva: number): CajaUbicada {
  const { largo, prof } = TAMANO[tipo];
  const izq = borde.x;
  const der = borde.x + borde.w;
  const arr = borde.y;
  const aba = borde.y + borde.h;
  const afuera = {
    solar: izq - centro.x,
    opuesto: centro.x - der,
    lateral1: arr - centro.y,
    lateral2: centro.y - aba,
  };
  // El lado más "afuera"; si el centro cayó adentro del borde, el más cercano.
  const lado = (Object.keys(afuera) as (keyof typeof afuera)[]).reduce((a, b) => (afuera[b] > afuera[a] ? b : a));
  const x0 = izq - reserva;
  const x1 = der + reserva;
  const y0 = arr - reserva;
  const y1 = aba + reserva;

  if (lado === "solar" || lado === "opuesto") {
    const x = lado === "solar" ? acotar(centro.x - prof / 2, x0, izq - SEPARACION - prof) : acotar(centro.x - prof / 2, der + SEPARACION, x1 - prof);
    return { tipo, x, y: acotar(centro.y - largo / 2, y0, y1 - largo), w: prof, h: largo };
  }
  const y = lado === "lateral1" ? acotar(centro.y - prof / 2, y0, arr - SEPARACION - prof) : acotar(centro.y - prof / 2, aba + SEPARACION, y1 - prof);
  return { tipo, x: acotar(centro.x - largo / 2, x0, x1 - largo), y, w: largo, h: prof };
}

function seSuperponen(a: Caja2, b: Caja2, margen = 4): boolean {
  return a.x < b.x + b.w + margen && b.x < a.x + a.w + margen && a.y < b.y + b.h + margen && b.y < a.y + a.h + margen;
}

/** Si dos objetos quedaron uno encima del otro, corre el segundo a lo largo de su lado hasta dejar libre el primero. */
export function separarObjetos(fijo: CajaUbicada, movil: CajaUbicada, borde: Caja2, reserva: number): CajaUbicada {
  if (!seSuperponen(fijo, movil)) return movil;
  const horizontal = movil.w >= movil.h; // sobre arriba/abajo se corre en x; sobre un lateral, en y
  const min = horizontal ? borde.x - reserva : borde.y - reserva;
  const max = horizontal ? borde.x + borde.w + reserva : borde.y + borde.h + reserva;
  const largo = horizontal ? movil.w : movil.h;
  const ini = horizontal ? fijo.x : fijo.y;
  const fin = ini + (horizontal ? fijo.w : fijo.h);
  const antes = ini - 4 - largo;
  const despues = fin + 4;
  const actual = horizontal ? movil.x : movil.y;
  const opciones = [antes >= min ? antes : null, despues + largo <= max ? despues : null].filter((v): v is number => v !== null);
  if (opciones.length === 0) return movil;
  const elegido = opciones.reduce((a, b) => (Math.abs(a - actual) <= Math.abs(b - actual) ? a : b));
  return horizontal ? { ...movil, x: elegido } : { ...movil, y: elegido };
}

/** Dibuja la sala de filtro (cuadrado gris oscuro) o la casa/quincho. */
export function dibujarObjetoUbicado(c: CajaUbicada): Prim[] {
  const cx = c.x + c.w / 2;
  const cy = c.y + c.h / 2;
  if (c.tipo === "sala") {
    return [
      { t: "rect", x: c.x, y: c.y, w: c.w, h: c.h, rx: 3, fill: COLORES_UBICACION.salaFondo, stroke: COLORES_UBICACION.salaBorde, strokeWidth: 1.2 },
      { t: "text", x: cx, y: cy - 6.5, text: "Sala de", fontSize: 10, fill: "#ffffff", anchor: "middle", central: true, weight: "bold" },
      { t: "text", x: cx, y: cy + 6.5, text: "filtro", fontSize: 10, fill: "#ffffff", anchor: "middle", central: true, weight: "bold" },
    ];
  }
  return [
    { t: "rect", x: c.x, y: c.y, w: c.w, h: c.h, rx: 3, fill: COLORES_UBICACION.casaFondo, stroke: COLORES_UBICACION.casaBorde, strokeWidth: 1.2, dash: "6 3" },
    // Una casita (techo y paredes) arriba del nombre.
    { t: "poly", puntos: [[cx - 11, cy - 11], [cx, cy - 22], [cx + 11, cy - 11]], fill: COLORES_UBICACION.casaBorde },
    { t: "rect", x: cx - 8, y: cy - 11, w: 16, h: 9, fill: COLORES_UBICACION.casaBorde, opacity: 0.75 },
    { t: "rect", x: cx - 2, y: cy - 7, w: 4, h: 5, fill: COLORES_UBICACION.casaFondo },
    { t: "text", x: cx, y: cy + 6, text: "Casa /", fontSize: 12, fill: COLORES_UBICACION.casaTexto, anchor: "middle", central: true, weight: "bold" },
    { t: "text", x: cx, y: cy + 20, text: "quincho", fontSize: 12, fill: COLORES_UBICACION.casaTexto, anchor: "middle", central: true, weight: "bold" },
  ];
}

/** Un grado (0 = norte arriba) → los vectores en pantalla del norte y del este. */
export function vectoresCardinales(grados: number): { norte: [number, number]; este: [number, number] } {
  const a = (grados * Math.PI) / 180;
  return { norte: [Math.sin(a), -Math.cos(a)], este: [Math.cos(a), Math.sin(a)] };
}

/**
 * La rosa de los vientos: una flecha que marca el norte (roja) con sus cuatro
 * letras N, E, S, O (oeste) en su lugar, según hacia dónde apunte el norte en
 * el plano. `r` es el radio del círculo; las letras van afuera.
 */
export function dibujarBrujula(cx: number, cy: number, r: number, grados: number, fontSize: number): Prim[] {
  const { norte, este } = vectoresCardinales(grados);
  const punta = (k: number, v: [number, number]): [number, number] => [cx + v[0] * k, cy + v[1] * k];
  const ancho = r * 0.3;
  const tip = punta(r - 3, norte);
  const cola = punta(-(r - 3), norte);
  const izq = punta(ancho, este);
  const der = punta(-ancho, este);
  const prims: Prim[] = [
    { t: "circle", cx, cy, r, fill: "#ffffff", stroke: "#1B3A5C", strokeWidth: 1, opacity: 0.95 },
    { t: "poly", puntos: [tip, izq, der], fill: "#C0392B" },
    { t: "poly", puntos: [cola, izq, der], fill: "#9AA9B5" },
    { t: "circle", cx, cy, r: 2, fill: "#ffffff", stroke: "#1B3A5C", strokeWidth: 0.75 },
  ];
  const letras: [string, [number, number], boolean][] = [
    ["N", norte, true],
    ["E", este, false],
    ["S", [-norte[0], -norte[1]], false],
    ["O", [-este[0], -este[1]], false],
  ];
  for (const [text, v, esNorte] of letras) {
    const [x, y] = punta(r + fontSize * 0.85, v);
    prims.push({ t: "text", x, y, text, fontSize: esNorte ? fontSize + 2 : fontSize, fill: esNorte ? "#C0392B" : "#1B3A5C", anchor: "middle", central: true, weight: "bold" });
  }
  return prims;
}
