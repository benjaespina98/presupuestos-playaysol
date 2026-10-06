"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cambiarEstadoPedido, eliminarPedido } from "@/lib/pedidos";
import {
  ESTADOS_PEDIDO,
  ETIQUETA_ESTADO,
  armarDocumento,
  type EstadoPedido,
  type PedidoGuardado,
} from "@/lib/domain/abastecimiento/pedidoDocumento";
import { exportarPedido, type FormatoPedido, type ModoPedido } from "@/lib/documentos/pedidos/exportar";
import { compartirOdescargarArchivo } from "@/lib/documentos/compartir";
import { formatARSExacto } from "@/lib/format/ars";
import { ModalShell, ZonaEliminar } from "@/components/abastecimiento/modal-partes";
import { MenuExportar } from "./MenuExportar";

const cantidad = (n: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);

/** El color de cada estado: de un vistazo se ve en qué está cada pedido. */
export const CLASE_ESTADO: Record<EstadoPedido, string> = {
  borrador: "bg-gray-100 text-gray-700",
  enviado: "bg-blue-50 text-blue-700",
  recibido: "bg-green-50 text-green-700",
  cancelado: "bg-red-50 text-red-700",
};

/**
 * Un pedido guardado, abierto: sus líneas por proveedor, su estado y las
 * mismas exportaciones que al armarlo. El documento sale de lo que quedó
 * guardado (no del catálogo de hoy): el pedido de ayer dice lo que se pidió ayer.
 */
export function DetallePedidoModal({
  pedido,
  onClose,
  onCambio,
  onEliminado,
}: {
  pedido: PedidoGuardado;
  onClose: () => void;
  /** Avisa que el pedido cambió (por ahora, de estado) para actualizar la lista. */
  onCambio: (p: PedidoGuardado) => void;
  onEliminado: (p: PedidoGuardado) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const doc = useMemo(
    () =>
      armarDocumento(pedido.lineas, {
        numero: pedido.numero,
        fecha: new Date(pedido.created_at),
        obra: pedido.obra,
        solicitante: pedido.solicitante,
        parametros: pedido.parametros,
        observaciones: pedido.notas ?? "",
      }),
    [pedido]
  );

  async function cambiarEstado(estado: EstadoPedido) {
    if (estado === pedido.estado) return;
    setOcupado(true);
    setMensaje(null);
    const { error } = await cambiarEstadoPedido(pedido.id, estado);
    setOcupado(false);
    if (error) {
      setMensaje({ tipo: "error", texto: error });
      return;
    }
    onCambio({ ...pedido, estado });
    setMensaje({ tipo: "ok", texto: `Estado: ${ETIQUETA_ESTADO[estado]}.` });
  }

  async function exportar(formato: FormatoPedido, modo: ModoPedido) {
    setOcupado(true);
    setMensaje(null);
    try {
      const archivo = await exportarPedido(doc, formato, modo);
      await compartirOdescargarArchivo(archivo.blob, archivo.nombre, archivo.mime);
      setMensaje({ tipo: "ok", texto: `${archivo.nombre} generado.` });
    } catch (err) {
      console.error("No se pudo generar el archivo del pedido", err);
      setMensaje({ tipo: "error", texto: "No se pudo generar el archivo. Probá de nuevo." });
    } finally {
      setOcupado(false);
    }
  }

  async function eliminar(): Promise<string | null> {
    const { error } = await eliminarPedido(pedido.id);
    if (error) return error;
    onEliminado(pedido);
    return null;
  }

  return (
    <ModalShell
      titulo={`Pedido ${doc.numero}`}
      subtitulo={`${doc.fecha} · ${doc.obra || "Sin obra"}`}
      ancho="max-w-2xl"
      ocupado={ocupado}
      onClose={onClose}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <label htmlFor="estado-pedido" className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
            Estado
          </label>
          <select
            id="estado-pedido"
            value={pedido.estado}
            disabled={ocupado}
            onChange={(e) => cambiarEstado(e.target.value as EstadoPedido)}
            className={`min-h-11 rounded-lg border border-gray-200 px-3 text-sm font-medium focus:border-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20 ${CLASE_ESTADO[pedido.estado]}`}
          >
            {ESTADOS_PEDIDO.map((e) => (
              <option key={e} value={e}>
                {ETIQUETA_ESTADO[e]}
              </option>
            ))}
          </select>
        </div>
        <MenuExportar onExportar={exportar} variosProveedores={doc.proveedores.length > 1} ocupado={ocupado} />
      </div>

      <dl className="mb-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div>
          <dt className="inline font-medium text-[#1B3A5C]">Pide: </dt>
          <dd className="inline text-gray-700">{doc.solicitante || "—"}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-[#1B3A5C]">Condiciones: </dt>
          <dd className="inline text-gray-700">{doc.condiciones.join(" · ")}</dd>
        </div>
      </dl>

      <div className="space-y-4">
        {doc.proveedores.map((s) => (
          <section key={s.nombre + s.telefono} aria-label={`Pedido a ${s.nombre}`} className="overflow-hidden rounded-lg border border-gray-200">
            <header className="flex flex-wrap items-baseline justify-between gap-x-3 bg-[#F4F8F9] px-3 py-2">
              <h3 className="text-sm font-bold text-[#1B3A5C]">{s.nombre}</h3>
              <p className="text-xs text-gray-500">{[s.contacto, s.telefono].filter(Boolean).join(" · ")}</p>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[30rem] text-left text-sm">
                <tbody>
                  {s.lineas.map((l, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-3 py-1.5 text-gray-900">{l.descripcion}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-gray-700">
                        {cantidad(l.cantidad)} <span className="text-gray-400">{l.unidad}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-gray-700">
                        {l.precio === null ? <span className="text-xs text-amber-700">A confirmar</span> : formatARSExacto(l.precio)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right font-medium tabular-nums text-gray-900">
                        {l.subtotal === null ? "—" : formatARSExacto(l.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-gray-100 bg-gray-50 px-3 py-1.5 text-right text-sm font-semibold tabular-nums text-gray-900">
              Subtotal {formatARSExacto(s.subtotal)}
            </p>
          </section>
        ))}
      </div>

      <p className="mt-3 flex items-baseline justify-between border-t-2 border-[#1B3A5C] pt-2 text-base font-bold text-[#1B3A5C]">
        <span>Total estimado</span>
        <span className="tabular-nums">{formatARSExacto(doc.total)}</span>
      </p>
      {doc.sinPrecio > 0 && (
        <p className="mt-1 text-xs text-amber-700">
          No incluye {doc.sinPrecio} {doc.sinPrecio === 1 ? "artículo" : "artículos"} con precio a confirmar.
        </p>
      )}
      {doc.observaciones && (
        <p className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
          <span className="font-medium text-[#1B3A5C]">Observaciones: </span>
          {doc.observaciones}
        </p>
      )}

      {mensaje && (
        <p
          role={mensaje.tipo === "error" ? "alert" : "status"}
          className={`mt-3 rounded-md px-3 py-2 text-sm ${mensaje.tipo === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
        >
          {mensaje.texto}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/dashboard/catalogo/pedido?desde=${pedido.id}`}
          className="inline-flex min-h-11 items-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-[#1B3A5C] hover:bg-gray-50"
        >
          Volver a armar con estos datos
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-lg px-4 text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          Cerrar
        </button>
      </div>

      <ZonaEliminar
        etiqueta="Eliminar pedido"
        titulo="¿Eliminar este pedido?"
        mensaje={`Se elimina ${doc.numero} del historial para todo el equipo y no se puede deshacer. Si sólo no se va a usar, cambiale el estado a Cancelado en lugar de eliminarlo.`}
        deshabilitado={ocupado}
        onEliminar={eliminar}
      />
    </ModalShell>
  );
}
