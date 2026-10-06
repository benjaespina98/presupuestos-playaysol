"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listarPedidos } from "@/lib/pedidos";
import {
  ESTADOS_PEDIDO,
  ETIQUETA_ESTADO,
  numeroFormateado,
  fechaDocumento,
  type EstadoPedido,
  type PedidoGuardado,
} from "@/lib/domain/abastecimiento/pedidoDocumento";
import { contarPorEstado, filtrarPedidos, proveedoresDePedido } from "@/lib/domain/abastecimiento/pedidosLista";
import { formatARSExacto } from "@/lib/format/ars";
import { PanelPortal } from "@/components/PanelPortal";
import { IconSearch } from "@/components/icons";
import { BarraFiltros } from "@/components/catalogo/BarraFiltros";
import { EncabezadoPagina } from "@/components/catalogo/EncabezadoPagina";
import { Chip } from "@/components/catalogo/FiltrosCatalogo";
import { CLASE_ESTADO, DetallePedidoModal } from "@/components/pedidos/DetallePedidoModal";

/** Columnas en pantallas medianas y grandes: N° · Fecha · Obra · Pileta · Proveedores · Costo · Estado · acción. */
const COLUMNAS = "md:grid-cols-[5.5rem_6.5rem_minmax(0,1fr)_5rem_6rem_9rem_6.5rem_5rem]";

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<PedidoGuardado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<EstadoPedido | "">("");
  const [abierto, setAbierto] = useState<PedidoGuardado | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    listarPedidos().then((r) => {
      if (cancelado) return;
      if (r.error) setError(r.error);
      else setPedidos(r.items);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  const visibles = useMemo(
    () => (pedidos ? filtrarPedidos(pedidos, { busqueda, estado: estado || null }) : null),
    [pedidos, busqueda, estado]
  );
  const conteos = useMemo(() => contarPorEstado(pedidos ?? [], busqueda), [pedidos, busqueda]);
  const hayFiltros = !!(busqueda || estado);

  return (
    <PanelPortal compacto>
      <EncabezadoPagina titulo="Pedidos" descripcion="Historial de pedidos de materiales, con su número y su estado.">
        <Link
          href="/dashboard/catalogo/pedido"
          className="flex min-h-11 items-center rounded-lg bg-[#1B3A5C] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#142c46]"
        >
          Armar pedido nuevo
        </Link>
      </EncabezadoPagina>

      <BarraFiltros>
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por número, obra, quién pidió o proveedor..."
            aria-label="Buscar pedidos"
            className="min-h-11 w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20"
          />
        </div>
        <div
          role="group"
          aria-label="Filtrar por estado"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-0"
        >
          <Chip activo={estado === ""} onClick={() => setEstado("")} cantidad={conteos.total}>
            Todos
          </Chip>
          {ESTADOS_PEDIDO.map((e) => (
            <Chip key={e} activo={estado === e} onClick={() => setEstado(estado === e ? "" : e)} cantidad={conteos.porEstado[e]}>
              {ETIQUETA_ESTADO[e]}
            </Chip>
          ))}
        </div>
      </BarraFiltros>

      {mensaje && (
        <p role="status" className="mb-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
          {mensaje}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {!error && pedidos === null && <p className="text-sm text-gray-500">Cargando…</p>}

      {!error && visibles && visibles.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
          {hayFiltros ? (
            "Ningún pedido coincide con el filtro."
          ) : (
            <>
              Todavía no hay pedidos guardados.{" "}
              <Link href="/dashboard/catalogo/pedido" className="font-medium text-[#1B3A5C] hover:underline">
                Armá el primero
              </Link>
              .
            </>
          )}
        </div>
      )}

      {!error && visibles && visibles.length > 0 && (
        <>
          <p className="mb-2 text-xs text-gray-500">
            {visibles.length} {visibles.length === 1 ? "pedido" : "pedidos"}
            {hayFiltros && pedidos ? ` de ${pedidos.length}` : ""}
          </p>
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div
              aria-hidden="true"
              className={`hidden rounded-t-lg border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-500 md:sticky md:top-[var(--catalogo-barra,0px)] md:z-10 md:grid md:items-center md:gap-x-4 ${COLUMNAS}`}
            >
              <span>N°</span>
              <span>Fecha</span>
              <span>Obra</span>
              <span>Pileta</span>
              <span className="text-right">Proveedores</span>
              <span className="text-right">Costo</span>
              <span>Estado</span>
              <span />
            </div>
            <ul className="divide-y divide-gray-100">
              {visibles.map((p) => (
                <FilaPedido
                  key={p.id}
                  pedido={p}
                  onAbrir={() => {
                    setMensaje(null);
                    setAbierto(p);
                  }}
                />
              ))}
            </ul>
          </div>
        </>
      )}

      {abierto && (
        <DetallePedidoModal
          key={abierto.id}
          pedido={abierto}
          onClose={() => setAbierto(null)}
          onCambio={(p) => {
            setPedidos((prev) => (prev ? prev.map((x) => (x.id === p.id ? p : x)) : prev));
            setAbierto(p);
          }}
          onEliminado={(p) => {
            setPedidos((prev) => (prev ? prev.filter((x) => x.id !== p.id) : prev));
            setAbierto(null);
            setMensaje(`Se eliminó ${numeroFormateado(p.numero)}.`);
          }}
        />
      )}
    </PanelPortal>
  );
}

function FilaPedido({ pedido: p, onAbrir }: { pedido: PedidoGuardado; onAbrir: () => void }) {
  const proveedores = proveedoresDePedido(p);
  return (
    <li
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-gray-50/70 md:grid md:gap-x-4 md:gap-y-0 md:py-2.5 ${COLUMNAS} ${p.estado === "cancelado" ? "opacity-60" : ""}`}
    >
      <p className="font-semibold tabular-nums text-[#1B3A5C]">{numeroFormateado(p.numero)}</p>
      <p className="text-sm tabular-nums text-gray-600">{fechaDocumento(new Date(p.created_at))}</p>
      <div className="min-w-0 basis-full md:basis-auto">
        <p className="truncate font-medium text-gray-900" title={p.obra || undefined}>
          {p.obra || <span className="font-normal text-gray-400">Sin obra</span>}
        </p>
        {p.solicitante && <p className="truncate text-xs text-gray-500">Pide: {p.solicitante}</p>}
      </div>
      <p className="text-sm text-gray-700">{p.parametros.tamano}</p>
      <p className="text-sm text-gray-700 md:text-right" title={proveedores.join(", ")}>
        {proveedores.length} {proveedores.length === 1 ? "proveedor" : "proveedores"}
      </p>
      <p className="ml-auto whitespace-nowrap font-medium tabular-nums text-gray-900 md:ml-0 md:text-right">{formatARSExacto(p.costo)}</p>
      <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-medium ${CLASE_ESTADO[p.estado]}`}>
        {ETIQUETA_ESTADO[p.estado]}
      </span>
      <button
        type="button"
        onClick={onAbrir}
        aria-label={`Abrir ${numeroFormateado(p.numero)}`}
        className="ml-auto inline-flex min-h-11 items-center justify-end rounded-md px-2 text-sm font-medium text-[#1B3A5C] hover:bg-[#1B3A5C]/8 md:ml-0 md:justify-center"
      >
        Abrir
      </button>
    </li>
  );
}
