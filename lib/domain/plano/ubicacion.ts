import { z } from "zod";
import type { Prim } from "./losetas";

/**
 * Ubicación de la pileta en el terreno: puntos cardinales, sala de filtro y casa.
 *
 * Motor puro (sin DOM): devuelve primitivas de dibujo, igual que el resto de
 * `lib/domain/plano`. La sala de filtro y la casa se dibujan FUERA del borde
 * (losetas, decks, travertino), pegadas a uno de los cuatro lados: el plano
 * reserva ese lugar, así que nunca pisan la pileta ni el borde ni las cotas.
 */

/** Los cuatro lados del plano: solar = izquierda, opuesto = derecha, lateral 1 = arriba, lateral 2 = abajo. */
export const LadoPlano = z.enum(["solar", "opuesto", "lateral1", "lateral2"]);
export type LadoPlano = z.infer<typeof LadoPlano>;

/** Dónde queda sobre ese lado: al comienzo, centrada o al final. */
export const PosicionLado = z.enum(["inicio", "centro", "fin"]);
export type PosicionLado = z.infer<typeof PosicionLado>;

export type TipoUbicacion = "sala" | "casa";

export interface Ubicacion {
  tipo: TipoUbicacion;
  lado: LadoPlano;
  pos: PosicionLado;
}

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

/** Cómo se llama cada lado en el formulario, con dónde cae en el dibujo. */
export const ETIQUETA_LADO: Record<LadoPlano, string> = {
  lateral1: "Arriba (lateral 1)",
  lateral2: "Abajo (lateral 2)",
  solar: "A la izquierda (solar)",
  opuesto: "A la derecha (opuesto)",
};

/** Las etiquetas de la posición cambian según el lado: sobre uno horizontal se dice izquierda/derecha. */
export function etiquetaPosicion(lado: LadoPlano, pos: PosicionLado): string {
  if (pos === "centro") return "Centrada";
  const horizontal = lado === "lateral1" || lado === "lateral2";
  if (horizontal) return pos === "inicio" ? "Hacia la izquierda" : "Hacia la derecha";
  return pos === "inicio" ? "Hacia arriba" : "Hacia abajo";
}

export const COLORES_UBICACION = {
  salaFondo: "#4B5563",
  salaBorde: "#2F3742",
  casaFondo: "#E4DED2",
  casaBorde: "#7C6F58",
  casaTexto: "#5B5240",
} as const;

/** Profundidad (hacia afuera del borde) de cada objeto, y separación con lo anterior. */
const PROFUNDIDAD: Record<TipoUbicacion, number> = { sala: 46, casa: 78 };
const SEPARACION = 10;

/** Lo que hay que reservar fuera del borde, por lado, para que entren los objetos que se apilan ahí. */
export function reservaPorLado(ubicaciones: Ubicacion[]): Record<LadoPlano, number> {
  const reserva: Record<LadoPlano, number> = { solar: 0, opuesto: 0, lateral1: 0, lateral2: 0 };
  for (const u of ubicaciones) reserva[u.lado] += SEPARACION + PROFUNDIDAD[u.tipo];
  return reserva;
}

/** El largo del objeto a lo largo del lado: la sala es chica; la casa ocupa buena parte del lado. */
function largoSobreLado(tipo: TipoUbicacion, lado: number): number {
  if (tipo === "sala") return Math.min(84, lado);
  return Math.min(lado, Math.max(110, lado * 0.6));
}

export interface CajaUbicada {
  tipo: TipoUbicacion;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Dónde cae cada objeto, dado el rectángulo del borde (el del plano, sin
 * contar lo reservado). Sobre un mismo lado se apilan hacia afuera en el orden
 * recibido: lo primero queda pegado al borde.
 */
export function ubicarObjetos(ubicaciones: Ubicacion[], borde: { x: number; y: number; w: number; h: number }): CajaUbicada[] {
  const usado: Record<LadoPlano, number> = { solar: 0, opuesto: 0, lateral1: 0, lateral2: 0 };
  return ubicaciones.map((u) => {
    const prof = PROFUNDIDAD[u.tipo];
    const desde = usado[u.lado] + SEPARACION;
    usado[u.lado] = desde + prof;
    const horizontal = u.lado === "lateral1" || u.lado === "lateral2";
    const lado = horizontal ? borde.w : borde.h;
    const largo = largoSobreLado(u.tipo, lado);
    const corrimiento = u.pos === "inicio" ? 0 : u.pos === "fin" ? lado - largo : (lado - largo) / 2;
    if (horizontal) {
      const y = u.lado === "lateral1" ? borde.y - desde - prof : borde.y + borde.h + desde;
      return { tipo: u.tipo, x: borde.x + corrimiento, y, w: largo, h: prof };
    }
    const x = u.lado === "solar" ? borde.x - desde - prof : borde.x + borde.w + desde;
    return { tipo: u.tipo, x, y: borde.y + corrimiento, w: prof, h: largo };
  });
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
    { t: "text", x: cx, y: cy - 8, text: "Casa /", fontSize: 12, fill: COLORES_UBICACION.casaTexto, anchor: "middle", central: true, weight: "bold" },
    { t: "text", x: cx, y: cy + 8, text: "quincho", fontSize: 12, fill: COLORES_UBICACION.casaTexto, anchor: "middle", central: true, weight: "bold" },
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
