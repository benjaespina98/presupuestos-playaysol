/**
 * Comparte o descarga un archivo ya generado (PDF, Word) — resuelve el punto
 * "compartirlo directamente desde celular" del pedido: en un celular con
 * hoja de compartir nativa (`navigator.share`/`canShare`), abre WhatsApp/
 * Mail/etc. directamente con el archivo. Si no está disponible (desktop, o
 * el navegador no soporta compartir archivos), cae a la descarga de toda la
 * vida — mismo patrón que ya usa `onDescargarWord` en las 4 calculadoras
 * (URL.createObjectURL + <a download>).
 */
export async function compartirOdescargarArchivo(blob: Blob, nombreArchivo: string, mimeType: string): Promise<void> {
  const nombreConExtension = nombreArchivo.endsWith(extensionDe(mimeType)) ? nombreArchivo : `${nombreArchivo}${extensionDe(mimeType)}`;

  if (typeof navigator !== "undefined" && navigator.share && navigator.canShare) {
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
