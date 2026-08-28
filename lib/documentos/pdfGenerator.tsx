import type { BloqueDocumento, FotoDocumentoModelo } from "./modelo";

/**
 * `armarBloques<Tipo>()` reusa las mismas URLs relativas que ya usa la
 * pantalla ("/header-teal.png", "/seeds/x.jpg" — ver fotosSeed.ts): ahí
 * andan bien porque el navegador las resuelve solas contra el origin de la
 * página. `@react-pdf/renderer` pide sus imágenes con su propio resolutor
 * (`@react-pdf/image`), que en su build de navegador hace `fetch(src)` sin
 * más — mismo comportamiento, así que una URL relativa también debería
 * andar ahí. Se resuelven absolutas de todos modos, sin esperar a que el
 * bundler elija el build correcto: así el mismo dato es válido lo mismo en
 * un Service Worker, en un contexto sin `document.baseURI` claro, o corrido
 * fuera del navegador (como el propio smoke test de este módulo). Las URLs
 * que ya son absolutas (`http(s)://`, `blob:`, `data:`) quedan intactas.
 */
function resolverUrl(url: string): string {
  if (typeof window === "undefined" || !url.startsWith("/")) return url;
  return new URL(url, window.location.origin).toString();
}

function resolverFotos(fotos: FotoDocumentoModelo[]): FotoDocumentoModelo[] {
  return fotos.map((f) => ({ ...f, url: resolverUrl(f.url) }));
}

/** Reescribe en el lugar las URLs de imagen de todos los bloques que
 *  llevan una — el resto de los bloques (texto, precios) vuelve sin tocar. */
function resolverUrlsDeBloques(bloques: BloqueDocumento[]): BloqueDocumento[] {
  return bloques.map((b) => {
    switch (b.tipo) {
      case "encabezado":
        return { ...b, logoUrl: resolverUrl(b.logoUrl) };
      case "galeriaSeeds":
      case "galeriaFotos":
        return { ...b, fotos: resolverFotos(b.fotos) };
      case "tarjetaOpcional":
        return { ...b, fotos: resolverFotos(b.fotos) };
      default:
        return b;
    }
  });
}

/**
 * Genera el PDF real de un presupuesto a partir de sus bloques (ver
 * lib/documentos/modelo.ts). `@react-pdf/renderer` se importa de forma
 * perezosa — mismo criterio que ya usan `docx.ts`/`html2canvas` (ver
 * tests/unit/dependencias.test.ts): no infla el bundle inicial de ninguna
 * calculadora con una librería que sólo hace falta al tocar "PDF".
 */
export async function generarPdfPresupuesto(bloques: BloqueDocumento[], titulo: string): Promise<Blob> {
  const [{ pdf }, { PresupuestoPdfDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/documentos/pdf/PresupuestoPdfDocument"),
  ]);
  return pdf(<PresupuestoPdfDocument bloques={resolverUrlsDeBloques(bloques)} titulo={titulo} />).toBlob();
}
