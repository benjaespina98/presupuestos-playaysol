"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { listarActividad } from "@/lib/actividad";
import {
  ETIQUETA_AREA,
  SIN_FILTROS,
  SOLO_SISTEMA,
  filtrarEventos,
  personasDe,
  quienDe,
  type AreaActividad,
  type EventoActividad,
  type FiltroActividad,
  type PeriodoActividad,
} from "@/lib/domain/actividad/evento";
import { useEstadoPersistente } from "@/lib/useEstadoPersistente";
import { PanelPortal } from "@/components/PanelPortal";
import { EncabezadoPagina } from "@/components/catalogo/EncabezadoPagina";
import { Aviso } from "@/components/ui/Aviso";
import { BarraHerramientas } from "@/components/ui/BarraHerramientas";
import { ListaCargando, ListaVacia } from "@/components/ui/EstadoLista";
import { LISTA, LISTA_ENCABEZADO, LISTA_SEPARADORES, TEXTO_SECUNDARIO } from "@/components/ui/lista";
import { Pastilla } from "@/components/ui/Pastilla";
import { botonDe } from "@/components/ui/botones";

const PASO = 100;
const AREAS = Object.keys(ETIQUETA_AREA) as AreaActividad[];
const PERIODOS: { id: PeriodoActividad; etiqueta: string }[] = [
  { id: "hoy", etiqueta: "Hoy" },
  { id: "7", etiqueta: "Últimos 7 días" },
  { id: "30", etiqueta: "Últimos 30 días" },
  { id: "todo", etiqueta: "Todo" },
];

/** Las mismas columnas en el encabezado y en cada fila (desde lg): Fecha · Quién · Área · Qué se hizo · Detalle. */
const COLUMNAS = "lg:grid-cols-[9.5rem_13rem_7.5rem_minmax(0,1.1fr)_minmax(0,1fr)]";

function fechaHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dia = d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const hora = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${dia} ${hora}`;
}

/**
 * Actividad: el registro de todo lo que se hizo en el portal (precios, stock, presupuestos, pedidos, compras), con
 * quién lo hizo y cuándo. Lo que no hizo una persona figura como "Sistema". Una fila fina por hecho.
 */
export default function ActividadPage() {
  const [eventos, setEventos] = useState<EventoActividad[] | null>(null);
  const [truncado, setTruncado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltrosGuardados] = useEstadoPersistente<FiltroActividad>("actividad:filtros", SIN_FILTROS);
  const [cuantos, setCuantos] = useState(PASO);

  function cambiar(parcial: Partial<FiltroActividad>) {
    setFiltrosGuardados({ ...filtros, ...parcial });
    setCuantos(PASO);
  }

  useEffect(() => {
    let cancelado = false;
    listarActividad().then((r) => {
      if (cancelado) return;
      if (r.error !== null) setError(r.error);
      else {
        setEventos(r.eventos);
        setTruncado(r.truncado);
      }
    });
    return () => {
      cancelado = true;
    };
  }, []);

  const todos = useMemo(() => eventos ?? [], [eventos]);
  const filtrados = useMemo(() => filtrarEventos(todos, filtros), [todos, filtros]);
  const personas = useMemo(() => personasDe(todos), [todos]);
  const hayFiltros = !!(filtros.busqueda || filtros.area || filtros.quien || filtros.periodo !== SIN_FILTROS.periodo);

  // Cuántos resultados daría cada opción de un menú, con el resto de los filtros puestos.
  const conteos = useMemo(() => {
    const porArea = filtrarEventos(todos, filtros, "area");
    const porQuien = filtrarEventos(todos, filtros, "quien");
    const porPeriodo = filtrarEventos(todos, filtros, "periodo");
    return {
      area: (a: AreaActividad) => porArea.filter((e) => e.area === a).length,
      sistema: porQuien.filter((e) => e.sistema).length,
      persona: (p: string) => porQuien.filter((e) => !e.sistema && e.quien === p).length,
      periodo: (p: PeriodoActividad) => filtrarEventos(todos, { ...filtros, periodo: p }, undefined).length,
      porArea: porArea.length,
      porQuien: porQuien.length,
      porPeriodo: porPeriodo.length,
    };
  }, [todos, filtros]);

  return (
    <PanelPortal compacto amplio>
      <EncabezadoPagina titulo="Actividad" descripcion="Todo lo que se hizo en el portal: qué, quién y cuándo. Lo que no hizo una persona figura como Sistema." />

      <BarraHerramientas
        buscador={{ valor: filtros.busqueda, onCambio: (busqueda) => cambiar({ busqueda }), placeholder: "Buscar en la actividad", etiqueta: "Buscar en la actividad" }}
        secciones={[
          {
            id: "area",
            titulo: "Qué",
            opciones: [{ id: "", etiqueta: "Todo", cantidad: conteos.porArea }, ...AREAS.map((a) => ({ id: a as string, etiqueta: ETIQUETA_AREA[a], cantidad: conteos.area(a) }))],
            valor: filtros.area,
            onCambio: (v) => cambiar({ area: v as AreaActividad | "" }),
          },
          {
            id: "quien",
            titulo: "Quién",
            opciones: [
              { id: "", etiqueta: "Todos", cantidad: conteos.porQuien },
              { id: SOLO_SISTEMA, etiqueta: "Sistema", cantidad: conteos.sistema },
              ...personas.map((p) => ({ id: quienDe(p), etiqueta: p, cantidad: conteos.persona(p) })),
            ],
            valor: filtros.quien,
            onCambio: (v) => cambiar({ quien: v }),
          },
          {
            id: "periodo",
            titulo: "Cuándo",
            opciones: PERIODOS.map((p) => ({ id: p.id as string, etiqueta: p.etiqueta, cantidad: conteos.periodo(p.id) })),
            valor: filtros.periodo,
            valorTodos: SIN_FILTROS.periodo,
            onCambio: (v) => cambiar({ periodo: v as PeriodoActividad }),
          },
        ]}
        resultados={filtrados.length}
        contador={eventos && !error ? `${filtrados.length} ${filtrados.length === 1 ? "hecho" : "hechos"}` : undefined}
        hayFiltros={hayFiltros}
        onLimpiar={() => {
          setFiltrosGuardados(SIN_FILTROS);
          setCuantos(PASO);
        }}
      />

      {error && <Aviso tono="error">{error}</Aviso>}
      {truncado && <Aviso tono="aviso">Se muestran los cambios más recientes.</Aviso>}
      {!error && eventos === null && <ListaCargando />}

      {!error && eventos && filtrados.length === 0 && (
        <ListaVacia
          accion={
            hayFiltros ? (
              <button type="button" onClick={() => setFiltrosGuardados(SIN_FILTROS)} className={botonDe("secundario", "px-4")}>
                Limpiar filtros
              </button>
            ) : undefined
          }
        >
          {hayFiltros ? "No hay actividad con estos filtros." : "Todavía no hay actividad."}
        </ListaVacia>
      )}

      {!error && eventos && filtrados.length > 0 && (
        <>
          <div className={LISTA}>
            <div aria-hidden="true" className={`${LISTA_ENCABEZADO} ${COLUMNAS}`}>
              <span>Fecha</span>
              <span>Quién</span>
              <span>Área</span>
              <span>Qué se hizo</span>
              <span>Detalle</span>
            </div>
            <ul className={LISTA_SEPARADORES}>
              {filtrados.slice(0, cuantos).map((e) => (
                <FilaActividad key={e.id} e={e} />
              ))}
            </ul>
          </div>
          {filtrados.length > cuantos && (
            <button type="button" onClick={() => setCuantos((v) => v + PASO)} className={`${botonDe("secundario", "px-4")} mt-3 w-full`}>
              Ver más ({filtrados.length - cuantos} restantes)
            </button>
          )}
        </>
      )}
    </PanelPortal>
  );
}

/**
 * Una fila fina. Celular: la frase arriba (hasta dos renglones) y, abajo, quién · área · fecha; el detalle en un
 * renglón. Desde lg: una fila de la grilla, todo en una línea (el texto largo se corta y se lee completo al apoyar
 * el mouse).
 */
const FilaActividad = memo(function FilaActividad({ e }: { e: EventoActividad }) {
  const quien = e.sistema ? <Pastilla tono="info">Sistema</Pastilla> : <span className="truncate font-medium text-[#1F2A30]">{e.quien}</span>;
  return (
    <li className={`grid grid-cols-1 gap-y-0.5 px-4 py-2 text-sm leading-5 hover:bg-[#F4F8F9] lg:items-center lg:gap-x-4 lg:py-0 lg:min-h-[2.75rem] ${COLUMNAS}`}>
      <p className={`hidden tabular-nums lg:block ${TEXTO_SECUNDARIO} lg:text-sm`}>{fechaHora(e.fecha)}</p>
      <p className={`order-2 flex min-w-0 items-center gap-2 ${TEXTO_SECUNDARIO} lg:order-none lg:text-sm lg:text-[#1F2A30]`}>
        {quien}
        <span className="lg:hidden" aria-hidden="true">
          · {ETIQUETA_AREA[e.area]} · {fechaHora(e.fecha)}
        </span>
      </p>
      <p className={`hidden truncate lg:block ${TEXTO_SECUNDARIO} lg:text-sm`}>{ETIQUETA_AREA[e.area]}</p>
      <p className="order-1 line-clamp-2 min-w-0 break-words font-medium text-gray-900 lg:order-none lg:truncate" title={e.titulo}>
        {e.titulo}
      </p>
      <p className={`order-3 truncate ${TEXTO_SECUNDARIO} lg:order-none lg:text-sm`} title={e.detalle ?? undefined}>
        {e.detalle ?? ""}
      </p>
    </li>
  );
});
