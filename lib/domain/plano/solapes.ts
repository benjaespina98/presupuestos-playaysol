/**
 * Geometría mínima para que el plano no tenga cosas pisadas: cajas, choques, y
 * una búsqueda del lugar libre más cercano. Todo en píxeles del plano y puro
 * (sin DOM, sin tipos del plano), así se prueba aparte.
 */

export interface Caja {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface TextoMedible {
  x: number;
  y: number;
  text: string;
  fontSize: number;
  anchor?: "start" | "middle" | "end";
  /** true = `y` es el centro vertical; false = es la línea base. */
  central?: boolean;
}

/** ¿Se tocan las dos cajas? `margen` agranda la zona de choque (aire mínimo
 *  entre objetos para que no queden pegados). */
export function seSuperponen(a: Caja, b: Caja, margen = 0): boolean {
  return a.x0 < b.x1 + margen && a.x1 > b.x0 - margen && a.y0 < b.y1 + margen && a.y1 > b.y0 - margen;
}

export function contiene(region: Caja, c: Caja): boolean {
  return c.x0 >= region.x0 && c.x1 <= region.x1 && c.y0 >= region.y0 && c.y1 <= region.y1;
}

export function trasladarCaja(c: Caja, dx: number, dy: number): Caja {
  return { x0: c.x0 + dx, y0: c.y0 + dy, x1: c.x1 + dx, y1: c.y1 + dy };
}

export function unirCajas(cajas: readonly Caja[]): Caja {
  return {
    x0: Math.min(...cajas.map((c) => c.x0)),
    y0: Math.min(...cajas.map((c) => c.y0)),
    x1: Math.max(...cajas.map((c) => c.x1)),
    y1: Math.max(...cajas.map((c) => c.y1)),
  };
}

/** Caja aproximada de un texto: no hay DOM para medirlo, así que se estima con
 *  el ancho medio de un carácter de la tipografía del plano (~0,56 × cuerpo). */
export function cajaDeTexto(t: TextoMedible): Caja {
  const w = t.text.length * t.fontSize * 0.56;
  const h = t.fontSize * 1.25;
  const x0 = t.anchor === "middle" ? t.x - w / 2 : t.anchor === "end" ? t.x - w : t.x;
  const y0 = t.central ? t.y - h / 2 : t.y - h * 0.8;
  return { x0, y0, x1: x0 + w, y1: y0 + h };
}

/**
 * El desplazamiento (dx, dy) más corto, en múltiplos de `paso`, que deja la
 * caja dentro de `region` y sin tocar a ninguna de `ocupados`. `null` si no hay
 * ninguno dentro del radio de búsqueda. (0, 0) si ya está libre.
 */
export function buscarLugarLibre(
  caja: Caja,
  region: Caja,
  ocupados: readonly Caja[],
  paso = 8,
  margen = 3,
  radio = 14
): { dx: number; dy: number } | null {
  const libre = (dx: number, dy: number) => {
    const c = trasladarCaja(caja, dx, dy);
    return contiene(region, c) && !ocupados.some((o) => seSuperponen(c, o, margen));
  };
  if (libre(0, 0)) return { dx: 0, dy: 0 };

  for (let r = 1; r <= radio; r++) {
    let mejor: { dx: number; dy: number; dist: number } | null = null;
    // Sólo el "anillo" de radio r (el borde del cuadrado), no el interior ya probado.
    for (let i = -r; i <= r; i++) {
      for (let j = -r; j <= r; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        // Mover en vertical se prefiere a mover en horizontal: el plano se lee de
        // izquierda a derecha y una etiqueta corrida de costado pierde su zona.
        const dx = j * paso;
        const dy = i * paso;
        if (!libre(dx, dy)) continue;
        const dist = Math.hypot(dx * 1.4, dy);
        if (!mejor || dist < mejor.dist) mejor = { dx, dy, dist };
      }
    }
    if (mejor) return { dx: mejor.dx, dy: mejor.dy };
  }
  return null;
}
