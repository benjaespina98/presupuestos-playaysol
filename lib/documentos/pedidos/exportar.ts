import {
  nombreArchivoPedido,
  separarPorProveedor,
  type DocumentoPedido,
} from "@/lib/domain/abastecimiento/pedidoDocumento";
import { generarExcelPedido } from "./excel";
import { LOGO_PEDIDO, generarPdfPedido } from "./pdf";

export type FormatoPedido = "pdf" | "xlsx";
/** "junto": un solo documento con todos los proveedores. "por-proveedor": uno por cada proveedor. */
export type ModoPedido = "junto" | "por-proveedor";

export interface ArchivoGenerado {
  blob: Blob;
  nombre: string;
  mime: string;
}

export const MIME: Record<FormatoPedido | "zip", string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
};

/** Baja el logo para incrustarlo en el Excel. Si no se puede, el Excel sale igual, sin logo. */
async function cargarLogo(): Promise<ArrayBuffer | undefined> {
  try {
    const r = await fetch(LOGO_PEDIDO);
    return r.ok ? await r.arrayBuffer() : undefined;
  } catch {
    return undefined;
  }
}

/** Nombres que no se repiten dentro del ZIP (dos proveedores con el mismo nombre no se pisan). */
export function nombresUnicos(nombres: readonly string[]): string[] {
  const usados = new Map<string, number>();
  return nombres.map((nombre) => {
    const clave = nombre.toLowerCase();
    const n = (usados.get(clave) ?? 0) + 1;
    usados.set(clave, n);
    if (n === 1) return nombre;
    const punto = nombre.lastIndexOf(".");
    return punto === -1 ? `${nombre}_${n}` : `${nombre.slice(0, punto)}_${n}${nombre.slice(punto)}`;
  });
}

export interface OpcionesExportar {
  /** Con precios (uso interno, tentativos) o sin ellos (para pedirle al proveedor). Por defecto, con. */
  conPrecios?: boolean;
  /** Para probar sin red. */
  logo?: () => Promise<ArrayBuffer | undefined>;
}

async function generarUno(doc: DocumentoPedido, formato: FormatoPedido, logo: ArrayBuffer | undefined, conPrecios: boolean): Promise<Blob> {
  return formato === "pdf" ? generarPdfPedido(doc, { conPrecios }) : generarExcelPedido(doc, { logo, conPrecios });
}

/**
 * Genera lo que se descarga:
 *
 *  - "junto": UN archivo con todos los proveedores.
 *  - "por-proveedor": UN archivo por cada proveedor, todos dentro de un ZIP.
 *    Si el pedido tiene un solo proveedor no hace falta ZIP: es ese archivo.
 */
export async function exportarPedido(
  doc: DocumentoPedido,
  formato: FormatoPedido,
  modo: ModoPedido,
  opciones: OpcionesExportar = {}
): Promise<ArchivoGenerado> {
  const conPrecios = opciones.conPrecios ?? true;
  const logo = formato === "xlsx" ? await (opciones.logo ?? cargarLogo)() : undefined;

  if (modo === "junto") {
    return { blob: await generarUno(doc, formato, logo, conPrecios), nombre: nombreArchivoPedido(doc, formato), mime: MIME[formato] };
  }

  const partes = separarPorProveedor(doc);
  if (partes.length === 1) {
    const unico = partes[0];
    return {
      blob: await generarUno(unico, formato, logo, conPrecios),
      nombre: nombreArchivoPedido(unico, formato, unico.proveedores[0].nombre),
      mime: MIME[formato],
    };
  }

  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const nombres = nombresUnicos(partes.map((p) => nombreArchivoPedido(p, formato, p.proveedores[0].nombre)));
  for (let i = 0; i < partes.length; i++) {
    // Con bytes (no con el Blob): JSZip sólo acepta Blob en el navegador; así anda en cualquier entorno.
    zip.file(nombres[i], await (await generarUno(partes[i], formato, logo, conPrecios)).arrayBuffer());
  }
  const nombreZip = nombreArchivoPedido(doc, "zip").replace(/\.zip$/, `_por_proveedor_${formato}.zip`);
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return { blob: new Blob([bytes as BlobPart], { type: MIME.zip }), nombre: nombreZip, mime: MIME.zip };
}
