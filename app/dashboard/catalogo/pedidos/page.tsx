"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
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
import { contarPorFecha, dentroDeFecha, OPCIONES_FECHA, type FiltroFecha } from "@/lib/filtroFecha";
import { etiquetaCortaDeOrden, opcionesDeOrden, ordenarPor, type ClaveOrden } from "@/lib/ordenar";
import { useEstadoPersistente } from "@/lib/useEstadoPersistente";
import { PanelPortal } from "@/components/PanelPortal";
import { EtiquetaAnulado } from "@/components/Anulado";
import { contarAnulados, estaAnulado } from "@/lib/anulacion";
import { EncabezadoPagina } from "@/components/catalogo/EncabezadoPagina";
import { BarraHerramientas } from "@/components/ui/BarraHerramientas";
import { Toast } from "@/components/ui/BarraListado";
import { BotonLapiz, alTocarFila } from "@/components/ui/BotonLapiz";
import { Aviso } from "@/components/ui/Aviso";
import { botonDe } from "@/components/ui/botones";
import { ListaCargando, ListaVacia } from "@/components/ui/EstadoLista";
import { COLUMNA_NUMERO, LISTA, LISTA_ENCABEZADO, LISTA_FILA, LISTA_SEPARADORES, TEXTO_SECUNDARIO } from "@/components/ui/lista";
import { Pastilla } from "@/components/ui/Pastilla";
import { TONO_ESTADO, DetallePedidoModal } from "@/components/pedidos/DetallePedidoModal";

/** Columnas desde `lg`: N° · Fecha · Obra · Pileta · Proveedores · Costo · Estado · Abrir. */
const COLUMNAS = "lg:grid-cols-[5.5rem_6.5rem_minmax(0,1fr)_4rem_6.5rem_8rem_7rem_3.5rem]";

interface Filtros {
  busqueda: string;
  estado: EstadoPedido | "";
  mostrarAnulados: boolean;
  fecha: FiltroFecha;
  orden: ClaveOrden;
}
const SIN_FILTROS: Filtros = { busqueda: "", estado: "", mostrarAnulados: false, fecha: "", orden: "defecto" };
const ORDENES = opcionesDeOrden(["nombre", "precio", "actualizado"]);

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<PedidoGuardado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // La búsqueda, los filtros y el orden se conservan al abrir un pedido y volver.
  const [filtros, setFiltros] = useEstadoPersistente<Filtros>("pedidos:filtros", SIN_FILTROS);
  const { estado, mostrarAnulados } = filtros;
  const busqueda = useDeferredValue(filtros.busqueda);
  const fecha = filtros.fecha ?? "";
  const orden = filtros.orden ?? "defecto";
  const cambiar = (parcial: Partial<Filtros>) => setFiltros({ ...filtros, ...parcial });
  const [abierto, setAbierto] = useState<PedidoGuardado | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Estable, para que abrir un aviso o cerrar una hoja no vuelva a dibujar todas las filas.
  const abrir = useCallback((p: PedidoGuardado) => {
    setMensaje(null);
    setAbierto(p);
  }, []);

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

  // Los contadores de cada filtro cuentan con los OTROS filtros aplicados (el de estado, sin el estado; el de fecha, sin la fecha).
  const sinEstado = useMemo(
    () => (pedidos ?? []).filter((p) => dentroDeFecha(p.created_at, fecha)),
    [pedidos, fecha]
  );
  const visibles = useMemo(
    () =>
      pedidos
        ? ordenarPor(
            filtrarPedidos(pedidos, { busqueda, estado: estado || null, incluirAnulados: mostrarAnulados }).filter((p) => dentroDeFecha(p.created_at, fecha)),
            orden,
            { nombre: (p) => p.obra, precio: (p) => p.costo, actualizado: (p) => p.updated_at }
          )
        : null,
    [pedidos, busqueda, estado, mostrarAnulados, fecha, orden]
  );
  const conteos = useMemo(() => contarPorEstado(sinEstado, busqueda, mostrarAnulados), [sinEstado, busqueda, mostrarAnulados]);
  const pedidosPorFecha = useMemo(
    () => contarPorFecha(filtrarPedidos(pedidos ?? [], { busqueda, estado: estado || null, incluirAnulados: mostrarAnulados }), (p) => p.created_at),
    [pedidos, busqueda, estado, mostrarAnulados]
  );
  const cantidadAnulados = useMemo(() => contarAnulados(pedidos ?? []), [pedidos]);
  const hayFiltros = !!(filtros.busqueda || estado || mostrarAnulados || fecha || orden !== "defecto");
  const cerrarToast = useCallback(() => setMensaje(null), []);

  return (
    <PanelPortal compacto amplio>
      <EncabezadoPagina titulo="Pedidos" descripcion="Historial de pedidos de materiales, con su número y su estado." />

      <BarraHerramientas
        buscador={{ valor: filtros.busqueda, onCambio: (v) => cambiar({ busqueda: v }), placeholder: "Buscar pedido", etiqueta: "Buscar pedidos" }}
        secciones={[
          {
            id: "estado",
            titulo: "Estado",
            opciones: [
              { id: "", etiqueta: "Todos", cantidad: conteos.total },
              ...ESTADOS_PEDIDO.map((e) => ({ id: e as string, etiqueta: ETIQUETA_ESTADO[e], cantidad: conteos.porEstado[e] })),
            ],
            valor: estado,
            onCambio: (v) => cambiar({ estado: v as EstadoPedido | "" }),
          },
          {
            id: "fecha",
            titulo: "Fecha",
            opciones: OPCIONES_FECHA.map((o) => ({ id: o.id, etiqueta: o.etiqueta, cantidad: pedidosPorFecha[o.id] })),
            valor: fecha,
            onCambio: (v) => cambiar({ fecha: v as FiltroFecha }),
          },
        ]}
        orden={{
          opciones: ORDENES.map((o) => ({ id: o.id, etiqueta: o.etiqueta.replace("Nombre", "Obra").replace("Precio", "Costo") })),
          valor: orden,
          onCambio: (v) => cambiar({ orden: v }),
          etiquetaCorta: (v) => etiquetaCortaDeOrden(v).replace("Nombre", "Obra").replace("Precio", "Costo"),
        }}
        interruptores={cantidadAnulados > 0 ? [{ id: "anulados", etiqueta: `Mostrar anulados (${cantidadAnulados})`, valor: mostrarAnulados, onCambio: (v) => cambiar({ mostrarAnulados: v }) }] : []}
        agregar={{ etiqueta: "Armar pedido nuevo", texto: "Armar pedido", href: "/dashboard/catalogo/pedido" }}
        resultados={visibles?.length ?? 0}
        contador={visibles && !error ? `${visibles.length} ${hayFiltros && pedidos ? `de ${pedidos.length - (mostrarAnulados ? 0 : cantidadAnulados)} pedidos` : visibles.length === 1 ? "pedido" : "pedidos"}` : undefined}
        hayFiltros={hayFiltros}
        onLimpiar={() => setFiltros(SIN_FILTROS)}
      />

      {error && <Aviso tono="error">{error}</Aviso>}
      {!error && pedidos === null && <ListaCargando />}

      {!error && visibles && visibles.length === 0 && (
        <ListaVacia
          accion={
            hayFiltros ? (
              <button type="button" onClick={() => setFiltros(SIN_FILTROS)} className={botonDe("secundario", "px-4")}>
                Limpiar filtros
              </button>
            ) : (
              <Link href="/dashboard/catalogo/pedido" className={botonDe("primario", "px-4")}>
                Armar el primero
              </Link>
            )
          }
        >
          {hayFiltros ? "Ningún pedido coincide con el filtro." : "Todavía no hay pedidos guardados."}
        </ListaVacia>
      )}

      {!error && visibles && visibles.length > 0 && (
        <>
          <div className={LISTA}>
            <div aria-hidden="true" className={`${LISTA_ENCABEZADO} ${COLUMNAS}`}>
              <span>N°</span>
              <span>Fecha</span>
              <span>Obra</span>
              <span className="text-center">Pileta</span>
              <span className="text-center">Proveedores</span>
              <span className="text-right">Costo</span>
              <span className="text-center">Estado</span>
              <span className="text-center">Abrir</span>
            </div>
            <ul className={LISTA_SEPARADORES}>
              {visibles.map((p) => (
                <FilaPedido key={p.id} pedido={p} onAbrir={abrir} />
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
const FilaPedido = memo(function FilaPedido({ pedido: p, onAbrir }: { pedido: PedidoGuardado; onAbrir: (p: PedidoGuardado) => void }) {
  const proveedores = proveedoresDePedido(p);
  const num = numeroFormateado(p.numero);
  return (
    <li
      onClick={alTocarFila(() => onAbrir(p))}
      className={`${LISTA_FILA} ${COLUMNAS} ${p.estado === "cancelado" || estaAnulado(p) ? "opacity-70" : ""}`}
    >
      <div className="min-w-0 flex-1 lg:contents">
        <p className="flex items-baseline gap-2 lg:contents">
          <span className="whitespace-nowrap font-semibold tabular-nums text-[#244B5A]">{num}</span>
          <span className={`whitespace-nowrap tabular-nums ${TEXTO_SECUNDARIO}`}>{fechaDocumento(new Date(p.created_at))}</span>
        </p>
        <div className="min-w-0 lg:order-none">
          <p className="line-clamp-2 break-words lg:truncate font-medium text-gray-900" title={p.obra || undefined}>
            {p.obra || <span className="font-normal text-[#4A5861]">Sin obra</span>}
          </p>
          {p.solicitante && <p className={`hidden truncate ${TEXTO_SECUNDARIO} lg:block`}>Pide: {p.solicitante}</p>}
        </div>
        <p className="hidden text-center text-gray-700 lg:block">{p.parametros.tamano}</p>
        <p className="hidden text-center tabular-nums text-gray-700 lg:block" title={proveedores.join(", ")}>
          {proveedores.length}
        </p>
        <p className={`${COLUMNA_NUMERO} text-left text-[13px] text-[#3E4A52] lg:text-right lg:text-sm lg:font-semibold lg:text-gray-900`}>
          <span className="lg:hidden">{p.parametros.tamano} · </span>
          {formatARSExacto(p.costo)}
        </p>
      </div>
      <div className="shrink-0 lg:flex lg:justify-center">
        {estaAnulado(p) ? (
          <EtiquetaAnulado />
        ) : (
          <Pastilla tono={TONO_ESTADO[p.estado]}>{ETIQUETA_ESTADO[p.estado]}</Pastilla>
        )}
      </div>
      <span className="flex shrink-0 justify-end lg:justify-center">
        <BotonLapiz nombre={num} etiqueta={`Abrir ${num}`} onClick={() => onAbrir(p)} />
      </span>
    </li>
  );
});
