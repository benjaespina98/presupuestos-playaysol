"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { mensajeProveedor, type DocumentoPedido, type SeccionProveedor } from "@/lib/domain/abastecimiento/pedidoDocumento";
import { exportarPedido, type ArchivoGenerado } from "@/lib/documentos/pedidos/exportar";
import { compartirArchivoYTexto, descargarArchivo, esDispositivoMovil } from "@/lib/documentos/compartir";
import { copiarAlPortapapeles } from "@/lib/clipboard";
import { botonDe } from "@/components/ui/botones";

/**
 * Las acciones de UN proveedor dentro del detalle de un pedido: Compartir (sólo en el celular), Descargar y
 * Copiar mensaje. Lo que sale es exactamente lo mismo que el ZIP: artículos con cantidad y unidad, sin
 * precios ni teléfonos ni notas (`paraSalida` lo garantiza dentro de `exportarPedido` y `mensajeProveedor`).
 */
export function AccionesProveedor({
  doc,
  seccion,
  onMensaje,
}: {
  doc: DocumentoPedido;
  seccion: SeccionProveedor;
  onMensaje: (tipo: "ok" | "error", texto: string) => void;
}) {
  // En el servidor no hay navegador: ahí es "no móvil"; en el cliente se mira el dispositivo.
  const movil = useSyncExternalStore(() => () => {}, esDispositivoMovil, () => false);
  const [preparado, setPreparado] = useState<{ clave: string; archivo: ArchivoGenerado } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const texto = mensajeProveedor(doc, seccion);
  // El PDF preparado sólo vale para este mismo contenido.
  const archivo = preparado && preparado.clave === texto ? preparado.archivo : null;

  // En iOS la hoja de compartir sólo abre si se pide directo desde el toque: por eso el PDF se genera antes.
  useEffect(() => {
    let vigente = true;
    if (!movil) return;
    exportarPedido({ ...doc, proveedores: [seccion] }, "pdf", "por-proveedor")
      .then((a) => vigente && setPreparado({ clave: texto, archivo: a }))
      .catch((err) => console.error("No se pudo preparar el PDF del proveedor", err));
    return () => {
      vigente = false;
    };
  }, [movil, doc, seccion, texto]);

  async function generar(): Promise<ArchivoGenerado> {
    return archivo ?? exportarPedido({ ...doc, proveedores: [seccion] }, "pdf", "por-proveedor");
  }

  async function descargar() {
    setOcupado(true);
    try {
      const a = await generar();
      descargarArchivo(a.blob, a.nombre);
      onMensaje("ok", `${a.nombre} descargado.`);
    } catch (err) {
      console.error("No se pudo generar el PDF del proveedor", err);
      onMensaje("error", "No se pudo generar el archivo. Probá de nuevo.");
    } finally {
      setOcupado(false);
    }
  }

  async function compartir() {
    if (!archivo) return;
    const r = await compartirArchivoYTexto(archivo.blob, archivo.nombre, archivo.mime, texto);
    if (r === "compartido") onMensaje("ok", `Pedido a ${seccion.nombre} compartido.`);
    else if (r === "texto") onMensaje("ok", "Este navegador no comparte archivos: se compartió el texto del pedido.");
    else if (r === "descargado") onMensaje("ok", `${archivo.nombre} descargado.`);
  }

  async function copiar() {
    const ok = await copiarAlPortapapeles(texto);
    if (!ok) return onMensaje("error", "No se pudo copiar. Probá de nuevo.");
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div role="group" aria-label={`Acciones del pedido a ${seccion.nombre}`} className="flex flex-wrap gap-2 border-t border-gray-100 bg-[#FFFFFF] px-3 py-2.5" data-print-hide="">
      {movil && (
        <button type="button" onClick={compartir} disabled={!archivo || ocupado} className={botonDe("primario", "min-h-12 flex-1")}>
          {archivo ? "Compartir" : "Preparando…"}
        </button>
      )}
      <button type="button" onClick={descargar} disabled={ocupado} className={botonDe(movil ? "secundario" : "primario", "min-h-12 flex-1")}>
        Descargar
      </button>
      <button type="button" onClick={copiar} className={botonDe("secundario", "min-h-12 flex-1")}>
        {copiado ? "¡Copiado!" : "Copiar mensaje"}
      </button>
    </div>
  );
}
