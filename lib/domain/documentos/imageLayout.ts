/**
 * Filas justificadas para una galería de fotos — puro, sin DOM (mismo
 * criterio que `lib/domain/plano/losetas.ts`: geometría como dato).
 *
 * El problema que resuelve: el PDF viejo (window.print() sobre una grilla
 * CSS de 2/3 columnas) no sabía nada de la proporción real de cada foto —
 * por eso a veces sobraba media fila vacía y otras veces una foto quedaba
 * deformada para "completar" la grilla. Acá se conoce el ancho/alto real de
 * cada foto de antemano (`FotoSeed.width/height` y
 * `PresupuestoV1.fotos[].width/height` ya existen), así que se arman filas
 * que llenan el ancho disponible EXACTO escalando cada foto sin deformarla
 * — el criterio clásico de "justified gallery": se agrupan fotos hasta que,
 * escaladas a una altura común, superan el ancho disponible; esa altura
 * común se reescala para que la fila cierre justo al ancho, y se pasa a la
 * fila siguiente. Sin reglas fijas de "2 por fila" o "3 por fila": la
 * cantidad que entra por fila depende de la proporción real de las fotos.
 */

export interface FotoConAspecto {
  width: number;
  height: number;
}

export interface FotoEnFila<T> {
  foto: T;
  anchoRender: number;
  altoRender: number;
}

/**
 * @param fotos           Fotos a maquetar, en orden.
 * @param anchoDisponible Ancho útil de la página/columna, en las mismas
 *                         unidades que se quiera el resultado (pt, px, mm).
 * @param altoFilaObjetivo Altura "ideal" de fila antes de reescalar para
 *                         cerrar el ancho — más alta da menos fotos por fila
 *                         y fotos más grandes; más baja, más por fila.
 * @param altoFilaMaxima   Techo de altura para la ÚLTIMA fila (que puede
 *                         quedar con pocas fotos y, sin techo, saldría
 *                         gigante) — el resto de las filas ya cierran solas
 *                         al ancho y no lo necesitan.
 */
export function justificarFilas<T extends FotoConAspecto>(
  fotos: T[],
  anchoDisponible: number,
  altoFilaObjetivo: number,
  altoFilaMaxima: number = altoFilaObjetivo * 1.6
): FotoEnFila<T>[][] {
  if (!fotos.length || anchoDisponible <= 0) return [];

  const filas: FotoEnFila<T>[][] = [];
  let filaActual: { foto: T; ratio: number }[] = [];
  let anchoFilaActual = 0; // suma de (ratio * altoFilaObjetivo) de la fila en curso

  const cerrarFila = (esUltima: boolean) => {
    if (!filaActual.length) return;
    // Escala la fila entera para que ocupe exactamente el ancho disponible.
    // La última fila, si quedó floja (pocas fotos), no se estira más allá
    // de altoFilaMaxima — se ve rara una foto sola ocupando toda la hoja.
    const escala = esUltima && anchoFilaActual < anchoDisponible
      ? Math.min(anchoDisponible / anchoFilaActual, altoFilaMaxima / altoFilaObjetivo)
      : anchoDisponible / anchoFilaActual;
    const alto = altoFilaObjetivo * escala;
    filas.push(
      filaActual.map(({ foto, ratio }) => ({
        foto,
        anchoRender: ratio * alto,
        altoRender: alto,
      }))
    );
    filaActual = [];
    anchoFilaActual = 0;
  };

  for (const foto of fotos) {
    const ratio = foto.width > 0 && foto.height > 0 ? foto.width / foto.height : 1;
    const anchoAAltoObjetivo = ratio * altoFilaObjetivo;

    filaActual.push({ foto, ratio });
    anchoFilaActual += anchoAAltoObjetivo;

    if (anchoFilaActual >= anchoDisponible) {
      cerrarFila(false);
    }
  }
  cerrarFila(true);

  return filas;
}
