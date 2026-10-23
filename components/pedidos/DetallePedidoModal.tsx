"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { anularPedido, cambiarEstadoPedido } from "@/lib/pedidos";
import { estaAnulado } from "@/lib/anulacion";
import { AnularDialog } from "@/components/AnularDialog";
import { AvisoAnulado } from "@/components/Anulado";
import {
  ESTADOS_PEDIDO,
  ETIQUETA_ESTADO,
  armarDocumento,
  type EstadoPedido,
  type PedidoGuardado,
} from "@/lib/domain/abastecimiento/pedidoDocumento";
import type { FormatoPedido, ModoPedido } from "@/lib/documentos/pedidos/exportar";
import { entregarPedido } from "@/lib/documentos/pedidos/entregar";
import { formatARSExacto } from "@/lib/format/ars";
import { ModalShell } from "@/components/abastecimiento/modal-partes";
import { MenuExportar } from "./MenuExportar";
import { AccionesProveedor } from "./AccionesProveedor";
import { SelectorSimple } from "@/components/ui/SelectorSimple";

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
  onAnulado,
}: {
  pedido: PedidoGuardado;
  onClose: () => void;
  /** Avisa que el pedido cambió (por ahora, de estado) para actualizar la lista. */
  onCambio: (p: PedidoGuardado) => void;
  /** Avisa que se anuló, con los datos de la anulación, para actualizar la lista. */
  onAnulado: (p: PedidoGuardado) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [anulando, setAnulando] = useState(false);
  const anulado = estaAnulado(pedido);
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
      const nombre = await entregarPedido(doc, formato, modo);
      setMensaje({ tipo: "ok", texto: `${nombre} generado.` });
    } catch (err) {
      console.error("No se pudo generar el archivo del pedido", err);
      setMensaje({ tipo: "error", texto: "No se pudo generar el archivo. Probá de nuevo." });
    } finally {
      setOcupado(false);
    }
  }

  /** Devuelve el mensaje de error (el diálogo queda abierto) o null si se anuló. */
  async function anular(motivo: string): Promise<string | null> {
    const { error } = await anularPedido(pedido.id, motivo);
    if (error) return error;
    setAnulando(false);
    onAnulado({ ...pedido, anulado_at: new Date().toISOString(), anulado_motivo: motivo });
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
      {anulado && (
        <AvisoAnulado anulado={{ motivo: pedido.anulado_motivo ?? null, fecha: pedido.anulado_at ?? null }} que="pedido" />
      )}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <label htmlFor="estado-pedido" className="mb-1 block text-[13px] font-medium uppercase tracking-wide text-gray-600">
            Estado
          </label>
          <div className="min-w-44">
            <SelectorSimple
              id="estado-pedido"
              titulo="Estado"
              valor={pedido.estado}
              opciones={ESTADOS_PEDIDO.map((e) => ({ value: e, label: ETIQUETA_ESTADO[e] }))}
              disabled={ocupado || anulado}
              onCambio={(v) => cambiarEstado(v as EstadoPedido)}
            />
          </div>
        </div>
        <MenuExportar onExportar={exportar} variosProveedores={doc.proveedores.length > 1} ocupado={ocupado} />
      </div>

      <dl className="mb-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div>
          <dt className="inline font-medium text-[#244B5A]">Pide: </dt>
          <dd className="inline text-gray-700">{doc.solicitante || "—"}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-[#244B5A]">Condiciones: </dt>
          <dd className="inline text-gray-700">{doc.condiciones.join(" · ")}</dd>
        </div>
      </dl>

      <div className="space-y-4">
        {doc.proveedores.map((s) => (
          <section key={s.nombre + s.telefono} aria-label={`Pedido a ${s.nombre}`} className="overflow-hidden rounded-lg border border-gray-200">
            <header className="flex flex-wrap items-baseline justify-between gap-x-3 bg-[#F4F8F9] px-3 py-2">
              <h3 className="text-sm font-bold text-[#244B5A]">{s.nombre}</h3>
              <p className="text-xs text-gray-500">{[s.contacto, s.telefono].filter(Boolean).join(" · ")}</p>
            </header>
            {/* Celular: el artículo y su subtotal arriba, y debajo "cantidad × precio" (sin tabla que haya que deslizar). */}
            <ul className="divide-y divide-gray-100 text-sm">
              {s.lineas.map((l, i) => (
                <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-3 py-1.5 sm:grid-cols-[minmax(0,1fr)_6rem_8rem_8rem] sm:items-baseline">
                  <p className="break-words text-gray-900">{l.descripcion}</p>
                  <p className="col-start-2 row-start-1 whitespace-nowrap text-right font-medium tabular-nums text-gray-900 sm:col-start-4">
                    {l.subtotal === null ? "—" : formatARSExacto(l.subtotal)}
                  </p>
                  <p className="col-span-2 whitespace-nowrap text-[13px] tabular-nums text-gray-700 sm:contents">
                    <span className="sm:col-start-2 sm:row-start-1 sm:text-right sm:text-sm">
                      {cantidad(l.cantidad)} <span className="text-gray-500">{l.unidad}</span>
                    </span>
                    <span className="sm:col-start-3 sm:row-start-1 sm:text-right sm:text-sm">
                      <span className="sm:hidden"> × </span>
                      {l.precio === null ? <span className="text-xs text-amber-700">A confirmar</span> : formatARSExacto(l.precio)}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
            <p className="border-t border-gray-100 bg-gray-50 px-3 py-1.5 text-right text-sm font-semibold tabular-nums text-gray-900">
              Subtotal {formatARSExacto(s.subtotal)}
            </p>
            <AccionesProveedor doc={doc} seccion={s} onMensaje={(tipo, texto) => setMensaje({ tipo, texto })} />
          </section>
        ))}
      </div>

      <p className="mt-3 flex items-baseline justify-between border-t-2 border-[#244B5A] pt-2 text-base font-bold text-[#244B5A]">
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
          <span className="font-medium text-[#244B5A]">Observaciones: </span>
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
          className="inline-flex min-h-11 items-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-[#244B5A] hover:bg-gray-50"
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

      {!anulado && (
        <div className="mt-5 border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={() => setAnulando(true)}
            disabled={ocupado}
            className="min-h-11 w-full rounded-md border border-red-200 px-4 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Anular pedido
          </button>
          <AnularDialog
            open={anulando}
            titulo="¿Anular este pedido?"
            mensaje={`Se anula ${doc.numero}: queda en el historial para todo el equipo (se puede ver y exportar), pero ya no se puede modificar. Si sólo cambió de estado, usá el selector de Estado en lugar de anularlo.`}
            onConfirmar={anular}
            onCancel={() => setAnulando(false)}
          />
        </div>
      )}
    </ModalShell>
  );
}
