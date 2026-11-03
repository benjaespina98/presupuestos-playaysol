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
import { Aviso } from "@/components/ui/Aviso";
import { Hoja } from "@/components/ui/Hoja";
import { Pastilla, type TonoPastilla } from "@/components/ui/Pastilla";
import { botonDe } from "@/components/ui/botones";
import { CLASE_ETIQUETA } from "@/components/ui/lista";
import { MenuExportar } from "./MenuExportar";
import { AccionesProveedor } from "./AccionesProveedor";
import { SelectorSimple } from "@/components/ui/SelectorSimple";

const cantidad = (n: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);

/** El tono de cada estado: de un vistazo se ve en qué está cada pedido. */
export const TONO_ESTADO: Record<EstadoPedido, TonoPastilla> = {
  borrador: "neutro",
  enviado: "info",
  recibido: "ok",
  cancelado: "error",
};

/**
 * Un pedido guardado, abierto: sus líneas por proveedor, su estado y las
 * mismas exportaciones que al armarlo. El documento sale de lo que quedó
 * guardado (no del catálogo de hoy): el pedido de ayer dice lo que se pidió ayer.
 *
 * Arriba lo que se usa siempre (estado y exportar), en el medio el pedido, y anular al final, separado. Los mensajes
 * van en el pie fijo: con un pedido largo, un aviso dentro del cuerpo quedaría fuera de la vista.
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
    <Hoja
      titulo={`Pedido ${doc.numero}`}
      subtitulo={`${doc.fecha} · ${doc.obra || "Sin obra"}`}
      ancho="xl"
      alto="completo"
      ocupado={ocupado}
      onCerrar={onClose}
      aviso={mensaje ? <Aviso tono={mensaje.tipo === "ok" ? "ok" : "error"}>{mensaje.texto}</Aviso> : undefined}
      pie={
        <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-between">
          <Link href={`/dashboard/catalogo/pedido?desde=${pedido.id}`} className={botonDe("secundario", "min-h-12 text-base")}>
            Armar uno igual
          </Link>
          <button type="button" onClick={onClose} disabled={ocupado} className={botonDe("primario", "min-h-12 text-base sm:min-w-32")}>
            Cerrar
          </button>
        </div>
      }
    >
      {anulado && <AvisoAnulado anulado={{ motivo: pedido.anulado_motivo ?? null, fecha: pedido.anulado_at ?? null }} que="pedido" />}

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-44 flex-1 sm:flex-none">
          <label htmlFor="estado-pedido" className={CLASE_ETIQUETA}>
            Estado
          </label>
          <SelectorSimple
            id="estado-pedido"
            titulo="Estado"
            valor={pedido.estado}
            opciones={ESTADOS_PEDIDO.map((e) => ({ value: e, label: ETIQUETA_ESTADO[e] }))}
            disabled={ocupado || anulado}
            className="min-h-12"
            onCambio={(v) => cambiarEstado(v as EstadoPedido)}
          />
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

      <div className="space-y-3">
        {doc.proveedores.map((s) => (
          <section key={s.nombre + s.telefono} aria-label={`Pedido a ${s.nombre}`} className="overflow-hidden rounded-lg border border-[#D9DFE3]">
            <header className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-[#D9DFE3] bg-[#F4F8F9] px-3 py-2">
              <h3 className="text-sm font-bold text-[#244B5A]">{s.nombre}</h3>
              <p className="text-[13px] text-gray-500">{[s.contacto, s.telefono].filter(Boolean).join(" · ")}</p>
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
                      {l.precio === null ? <Pastilla tono="aviso">A confirmar</Pastilla> : formatARSExacto(l.precio)}
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
        <p className="mt-1 text-[13px] text-amber-800">
          No incluye {doc.sinPrecio} {doc.sinPrecio === 1 ? "artículo" : "artículos"} con precio a confirmar.
        </p>
      )}
      {doc.observaciones && (
        <p className="mt-3 rounded-lg bg-[#F4F8F9] px-3 py-2 text-sm text-gray-700">
          <span className="font-medium text-[#244B5A]">Observaciones: </span>
          {doc.observaciones}
        </p>
      )}

      {!anulado && (
        <div className="mt-5 flex justify-end border-t border-[#D9DFE3] pt-3">
          <button type="button" onClick={() => setAnulando(true)} disabled={ocupado} className={botonDe("textoPeligro")}>
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
    </Hoja>
  );
}
