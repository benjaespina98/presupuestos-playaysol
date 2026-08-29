/**
 * Comparte o descarga un archivo ya generado (PDF, Word) — resuelve el punto
 * "compartirlo directamente desde celular" del pedido: en un celular con
 * hoja de compartir nativa (`navigator.share`/`canShare`), abre WhatsApp/
 * Mail/etc. directamente con el archivo. Si no está disponible (o estamos en
 * desktop — ver `esDispositivoMovil` más abajo), cae a la descarga de toda la
 * vida — mismo patrón que ya usa `onDescargarWord` en las 4 calculadoras
 * (URL.createObjectURL + <a download>).
 */
export async function compartirOdescargarArchivo(blob: Blob, nombreArchivo: string, mimeType: string): Promise<void> {
  const nombreConExtension = nombreArchivo.endsWith(extensionDe(mimeType)) ? nombreArchivo : `${nombreArchivo}${extensionDe(mimeType)}`;

  if (esDispositivoMovil() && typeof navigator !== "undefined" && navigator.share && navigator.canShare) {
    try {
      const archivo = new File([blob], nombreConExtension, { type: mimeType });
      if (navigator.canShare({ files: [archivo] })) {
        await navigator.share({ files: [archivo] });
        return;
      }
    } catch (err) {
      // El usuario canceló la hoja de compartir, o el navegador la abrió y
      // falló a mitad de camino: no es un error real, se cae a descargar.
      if (err instanceof Error && err.name === "AbortError") return;
    }
  }

  descargarBlob(blob, nombreConExtension);
}

/**
 * Chrome/Edge en Windows también implementan `navigator.share` — abren la
 * hoja de compartir nativa de Windows (WhatsApp, Teams, Outlook, "Enlace
 * móvil"...), pero esa hoja NO tiene una opción "Guardar en el equipo": para
 * alguien en la compu que sólo quiere el PDF en su carpeta de Descargas, la
 * hoja de compartir es un paso extra confuso que no lleva a ningún lado. En
 * el celular es al revés: ahí sí sirve (comparte directo por WhatsApp/mail
 * sin pasar por Archivos). Por eso `compartirOdescargarArchivo` sólo intenta
 * `navigator.share` si el dispositivo es un celular/tablet — en desktop va
 * derecho a la descarga de siempre.
 *
 * `navigator.userAgentData.mobile` (Chromium) es la señal correcta cuando
 * está disponible; Safari/iOS no la expone, así que se cae a mirar el user
 * agent como hacía el legacy.
 */
function esDispositivoMovil(): boolean {
  if (typeof navigator === "undefined") return false;
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (uaData && typeof uaData.mobile === "boolean") return uaData.mobile;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function descargarBlob(blob: Blob, nombreArchivo: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function extensionDe(mimeType: string): string {
  if (mimeType === "application/pdf") return ".pdf";
  if (mimeType.includes("wordprocessingml")) return ".docx";
  return "";
}
