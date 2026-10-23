import type { DocumentoPedido } from "@/lib/domain/abastecimiento/pedidoDocumento";
import { compartirOdescargarArchivo, compartirVarios, esDispositivoMovil } from "@/lib/documentos/compartir";
import { exportarPedido, exportarPedidoArchivos, type FormatoPedido, type ModoPedido } from "./exportar";

/**
 * Genera y entrega lo que se exportó. En el celular, "uno por proveedor" NO arma un ZIP (no se puede abrir): comparte un archivo
 * suelto por proveedor, todos juntos en la hoja de compartir. En la compu, el ZIP de siempre. Devuelve cómo se llamó lo entregado.
 */
export async function entregarPedido(doc: DocumentoPedido, formato: FormatoPedido, modo: ModoPedido, movil: boolean = esDispositivoMovil()): Promise<string> {
  if (modo === "por-proveedor" && movil) {
    const archivos = await exportarPedidoArchivos(doc, formato);
    if (archivos.length > 1) {
      await compartirVarios(archivos);
      return `${archivos.length} archivos (uno por proveedor)`;
    }
    await compartirOdescargarArchivo(archivos[0].blob, archivos[0].nombre, archivos[0].mime);
    return archivos[0].nombre;
  }
  const archivo = await exportarPedido(doc, formato, modo);
  await compartirOdescargarArchivo(archivo.blob, archivo.nombre, archivo.mime);
  return archivo.nombre;
}
