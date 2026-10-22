import type { DocumentoPedido } from "@/lib/domain/abastecimiento/pedidoDocumento";

/** El logo de la empresa, tal como está en /public. */
export const LOGO_PEDIDO = "/logo-playa-sol.png";

/** Las URLs relativas se resuelven contra el origin de la página (mismo criterio que `pdfGenerator`). */
function resolverUrl(url: string): string {
  if (typeof window === "undefined" || !url.startsWith("/")) return url;
  return new URL(url, window.location.origin).toString();
}

/**
 * Genera el PDF del pedido formal. `@react-pdf/renderer` se importa de forma
 * perezosa: no infla el bundle de nadie que no toque "PDF".
 */
export async function generarPdfPedido(
  doc: DocumentoPedido,
  opciones: { titulo?: string; logoUrl?: string | null } = {}
): Promise<Blob> {
  const [{ pdf }, { PedidoPdfDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/documentos/pdf/PedidoPdfDocument"),
  ]);
  const logo = opciones.logoUrl === undefined ? LOGO_PEDIDO : opciones.logoUrl;
  return pdf(
    <PedidoPdfDocument
      doc={doc}
      logoUrl={logo ? resolverUrl(logo) : null}
      titulo={opciones.titulo ?? `Pedido ${doc.numero}`}
    />
  ).toBlob();
}
