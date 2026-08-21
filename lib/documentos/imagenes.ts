/**
 * Redimensiona una imagen vía canvas, recodificando siempre a JPEG.
 *
 * Port del mismo algoritmo que hoy vive DOS veces en cada `-calc.js`
 * (`resizeImageFile` al subir la foto, `blobToConstrainedUint8Array` al
 * exportar a Word) con distintos parámetros — acá es una sola función porque
 * el reuso ya era real en el propio legacy, no es una abstracción anticipada.
 *
 * Recodificar siempre a JPEG (nunca conservar el formato original) es
 * intencional: así el tipo que se declara al incrustar en el .docx coincide
 * siempre con los bytes reales, sin importar si la foto original era PNG,
 * HEIC-ya-convertido, etc.
 */
export function redimensionarImagen(
  origen: Blob,
  maxDim: number,
  calidad: number
): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(origen);
    img.onload = () => {
      let { naturalWidth: width, naturalHeight: height } = img;
      if (width > maxDim || height > maxDim) {
        const escala = maxDim / Math.max(width, height);
        width = Math.round(width * escala);
        height = Math.round(height * escala);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("No se pudo obtener el contexto 2D del canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("No se pudo generar la imagen redimensionada"));
            return;
          }
          resolve({ blob, width, height });
        },
        "image/jpeg",
        calidad
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = url;
  });
}

/** Cómo se sube/previsualiza una foto agregada a mano: nítida en pantalla/PDF/
 *  Word, sin que una foto de celular de varios MB rompa el diseño o llene el
 *  almacenamiento. Mismo valor que el legacy (`resizeImageFile(file, 1400)`). */
export const MAX_DIM_SUBIDA = 1400;
export const CALIDAD_SUBIDA = 0.85;

/** Cómo se reincrusta una foto ya redimensionada al generar el .docx: más
 *  chica todavía, porque un documento Word no necesita la resolución de
 *  pantalla completa. Mismos valores que el legacy
 *  (`blobToConstrainedUint8Array(blob, 1100, 0.78)`). */
export const MAX_DIM_DOCX = 1100;
export const CALIDAD_DOCX = 0.78;
