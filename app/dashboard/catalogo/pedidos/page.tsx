"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { etiquetaCortaDeOrden, opcionesDeOrden, ordenarPor, type ClaveOrden } from "@/lib/ordenar";
import { useEstadoPersistente } from "@/lib/useEstadoPersistente";
import { PanelPortal } from "@/components/PanelPortal";
import { EtiquetaAnulado } from "@/components/Anulado";
import { contarAnulados, estaAnulado } from "@/lib/anulacion";
import { EncabezadoPagina } from "@/components/catalogo/EncabezadoPagina";
import { Buscador } from "@/components/ui/FiltrosPlegables";
import { BarraListado, BotonFiltros, Chip, ChipsFila, Interruptor, MenuSeleccion, Toast } from "@/components/ui/BarraListado";
import { BotonLapiz, alTocarFila } from "@/components/ui/BotonLapiz";
import { botonDe } from "@/components/ui/botones";
import { CLASE_ESTADO, DetallePedidoModal } from "@/components/pedidos/DetallePedidoModal";

/** Columnas desde `lg`: N° · Fecha · Obra · Pileta · Proveedores · Costo · Estado · Editar. */
const COLUMNAS = "lg:grid-cols-[5.5rem_6.5rem_minmax(0,1fr)_5rem_6.5rem_9rem_7rem_3.5rem]";

interface Filtros {
  busqueda: string;
  estado: EstadoPedido | "";
  mostrarAnulados: boolean;
  orden: ClaveOrden;
}
const SIN_FILTROS: Filtros = { busqueda: "", estado: "", mostrarAnulados: false, orden: "defecto" };
const ORDENES = opcionesDeOrden(["nombre", "precio", "actualizado"]);

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<PedidoGuardado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // La búsqueda, los filtros y el orden se conservan al abrir un pedido y volver.
  const [filtros, setFiltros] = useEstadoPersistente<Filtros>("pedidos:filtros", SIN_FILTROS);
  const { busqueda, estado, mostrarAnulados } = filtros;
  const orden = filtros.orden ?? "defecto";
  const cambiar = (parcial: Partial<Filtros>) => setFiltros({ ...filtros, ...parcial });
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
    () =>
      pedidos
        ? ordenarPor(filtrarPedidos(pedidos, { busqueda, estado: estado || null, incluirAnulados: mostrarAnulados }), orden, {
            nombre: (p) => p.obra,
            precio: (p) => p.costo,
            actualizado: (p) => p.updated_at,
          })
        : null,
    [pedidos, busqueda, estado, mostrarAnulados, orden]
  );
  const conteos = useMemo(() => contarPorEstado(pedidos ?? [], busqueda, mostrarAnulados), [pedidos, busqueda, mostrarAnulados]);
  const cantidadAnulados = useMemo(() => contarAnulados(pedidos ?? []), [pedidos]);
  const hayFiltros = !!(busqueda || estado || mostrarAnulados || orden !== "defecto");
  const cerrarToast = useCallback(() => setMensaje(null), []);

  return (
    <PanelPortal compacto amplio>
      <EncabezadoPagina titulo="Pedidos" descripcion="Historial de pedidos de materiales, con su número y su estado.">
        <Link href="/dashboard/catalogo/pedido" aria-label="Armar pedido nuevo" className={botonDe("primario", "px-4")}>
          Armar pedido<span className="hidden sm:inline">&nbsp;nuevo</span>
        </Link>
      </EncabezadoPagina>

      <BarraListado
        buscador={<Buscador valor={busqueda} onCambio={(v) => cambiar({ busqueda: v })} placeholder="Buscar por número, obra, proveedor..." etiqueta="Buscar pedidos" />}
        menus={
          <MenuSeleccion
            etiqueta="Ordenar"
            titulo="Orden"
            opciones={ORDENES.map((o) => ({ id: o.id, etiqueta: o.etiqueta.replace("Nombre", "Obra").replace("Precio", "Costo") }))}
            valor={orden}
            porDefecto="defecto"
            onCambio={(v) => cambiar({ orden: v })}
            textoBoton={etiquetaCortaDeOrden(orden).replace("Nombre", "Obra").replace("Precio", "Costo")}
          />
        }
        chips={
          <ChipsFila etiqueta="Filtrar por estado">
            <Chip activo={estado === ""} onClick={() => cambiar({ estado: "" })} cantidad={conteos.total}>
              Todos
            </Chip>
            {ESTADOS_PEDIDO.map((e) => (
              <Chip key={e} activo={estado === e} onClick={() => cambiar({ estado: estado === e ? "" : e })} cantidad={conteos.porEstado[e]}>
                {ETIQUETA_ESTADO[e]}
              </Chip>
            ))}
          </ChipsFila>
        }
        filtros={
          <BotonFiltros contador={mostrarAnulados ? 1 : 0} hayFiltros={hayFiltros} onLimpiar={() => setFiltros(SIN_FILTROS)}>
            {cantidadAnulados > 0 ? (
              <Interruptor checked={mostrarAnulados} onChange={(v) => cambiar({ mostrarAnulados: v })}>
                Mostrar anulados ({cantidadAnulados})
              </Interruptor>
            ) : (
              <p className="px-1 py-2 text-[13px] text-[#4A5861]">No hay pedidos anulados.</p>
            )}
          </BotonFiltros>
        }
      />

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-[#B42318]">
          {error}
        </p>
      )}
      {!error && pedidos === null && <p className="py-6 text-center text-sm text-[#4A5861]">Cargando…</p>}

      {!error && visibles && visibles.length === 0 && (
        <div className="rounded-lg border border-dashed border-[#7D8892] px-4 py-10 text-center text-sm text-[#3E4A52]">
          {hayFiltros ? (
            "Ningún pedido coincide con el filtro."
          ) : (
            <>
              Todavía no hay pedidos guardados.{" "}
              <Link href="/dashboard/catalogo/pedido" className="inline-flex min-h-11 items-center font-medium text-[#244B5A] underline underline-offset-2 hover:no-underline">
                Armá el primero
              </Link>
              .
            </>
          )}
        </div>
      )}

      {!error && visibles && visibles.length > 0 && (
        <>
          <p className="py-1 text-[13px] text-[#4A5861]" aria-live="polite">
            {visibles.length} {hayFiltros && pedidos ? `de ${pedidos.length} pedidos` : visibles.length === 1 ? "pedido" : "pedidos"}
          </p>
          <div className="rounded-lg border border-[#D9DFE3] bg-white lg:rounded-none">
            <div
              aria-hidden="true"
              className={`hidden h-9 border-b border-[#D9DFE3] bg-[#F1F4F6] px-4 text-[13px] font-semibold uppercase tracking-wide text-[#4A5861] lg:sticky lg:top-[var(--catalogo-barra,0px)] lg:z-10 lg:grid lg:items-center lg:gap-x-4 ${COLUMNAS}`}
            >
              <span>N°</span>
              <span>Fecha</span>
              <span>Obra</span>
              <span className="text-center">Pileta</span>
              <span className="text-center">Proveedores</span>
              <span className="text-center">Costo</span>
              <span className="text-center">Estado</span>
              <span className="text-center">Editar</span>
            </div>
            <ul className="divide-y divide-[#EEF1F3]">
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
          onAnulado={(p) => {
            setPedidos((prev) => (prev ? prev.map((x) => (x.id === p.id ? p : x)) : prev));
            setAbierto(null);
            setMensaje(`Se anuló ${numeroFormateado(p.numero)}.`);
          }}
        />
      )}

      <Toast mensaje={mensaje} onCerrar={cerrarToast} />
    </PanelPortal>
  );
}

/** Una fila de pedido: tocarla entera (o el lápiz) la abre. En el celular, dos renglones; desde `lg`, la grilla. */
function FilaPedido({ pedido: p, onAbrir }: { pedido: PedidoGuardado; onAbrir: () => void }) {
  const proveedores = proveedoresDePedido(p);
  const num = numeroFormateado(p.numero);
  return (
    <li
      onClick={alTocarFila(onAbrir)}
      className={`flex min-h-[3.25rem] cursor-pointer items-center gap-3 px-4 py-1 text-[15px] leading-5 transition-colors hover:bg-[#F4F8F9] active:bg-[#EAF0F2] lg:grid lg:min-h-[2.75rem] lg:gap-x-4 lg:py-0 ${COLUMNAS} ${p.estado === "cancelado" || estaAnulado(p) ? "opacity-70" : ""}`}
    >
      <div className="min-w-0 flex-1 lg:contents">
        <p className="flex items-baseline gap-2 lg:contents">
          <span className="font-semibold tabular-nums text-[#244B5A]">{num}</span>
          <span className="whitespace-nowrap text-[13px] tabular-nums text-[#4A5861] lg:text-sm lg:text-gray-600">{fechaDocumento(new Date(p.created_at))}</span>
        </p>
        <div className="min-w-0 lg:order-none">
          <p className="line-clamp-2 break-words lg:truncate text-sm font-medium text-gray-900" title={p.obra || undefined}>
            {p.obra || <span className="font-normal text-[#4A5861]">Sin obra</span>}
          </p>
          {p.solicitante && <p className="hidden truncate text-[13px] text-[#4A5861] lg:block">Pide: {p.solicitante}</p>}
        </div>
        <p className="hidden text-center text-sm text-gray-700 lg:block">{p.parametros.tamano}</p>
        <p className="hidden text-center text-sm text-gray-700 lg:block" title={proveedores.join(", ")}>
          {proveedores.length} {proveedores.length === 1 ? "proveedor" : "proveedores"}
        </p>
        <p className="whitespace-nowrap text-[13px] tabular-nums text-[#3E4A52] lg:text-center lg:text-sm lg:font-medium lg:text-gray-900">
          <span className="lg:hidden">{p.parametros.tamano} · </span>
          {formatARSExacto(p.costo)}
        </p>
      </div>
      <div className="shrink-0 lg:flex lg:justify-center">
        {estaAnulado(p) ? (
          <EtiquetaAnulado />
        ) : (
          <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[13px] font-medium ${CLASE_ESTADO[p.estado]}`}>
            {ETIQUETA_ESTADO[p.estado]}
          </span>
        )}
      </div>
      <span className="flex shrink-0 justify-end lg:justify-center">
        <BotonLapiz nombre={num} etiqueta={`Abrir ${num}`} onClick={onAbrir} />
      </span>
    </li>
  );
}
