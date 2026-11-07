"use client";

import { useEffect, useMemo, useState } from "react";
import { listarActividad } from "@/lib/actividad";
import { ETIQUETA_AREA, filtrarEventos, type AreaActividad, type EventoActividad, type FiltroQuien } from "@/lib/domain/actividad/evento";
import { useEstadoPersistente } from "@/lib/useEstadoPersistente";
import { PanelPortal } from "@/components/PanelPortal";
import { EncabezadoPagina } from "@/components/catalogo/EncabezadoPagina";
import { Aviso } from "@/components/ui/Aviso";
import { ListaCargando, ListaVacia } from "@/components/ui/EstadoLista";
import { LISTA_SEPARADORES, TEXTO_SECUNDARIO } from "@/components/ui/lista";
import { Pastilla } from "@/components/ui/Pastilla";
import { Segmentado } from "@/components/ui/Segmentado";

interface Filtros {
  area: AreaActividad | "";
  quien: FiltroQuien;
}
const SIN_FILTROS: Filtros = { area: "", quien: "todos" };
const PASO = 100;

const AREAS = [
  { id: "" as const, texto: "Todo" },
  ...(Object.keys(ETIQUETA_AREA) as AreaActividad[]).map((id) => ({ id, texto: ETIQUETA_AREA[id] })),
];
const QUIEN = [
  { id: "todos" as const, texto: "Todos" },
  { id: "personas" as const, texto: "Personas" },
  { id: "sistema" as const, texto: "Sistema" },
];

function fechaHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Actividad: el registro de todo lo que se hizo en el portal (precios, stock, presupuestos, pedidos, compras), con
 * quién lo hizo y cuándo. Lo que no hizo una persona figura como "Sistema".
 */
export default function ActividadPage() {
  const [eventos, setEventos] = useState<EventoActividad[] | null>(null);
  const [truncado, setTruncado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useEstadoPersistente<Filtros>("actividad", SIN_FILTROS);
  const [visibles, setVisibles] = useState(PASO);

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

  const filtrados = useMemo(() => filtrarEventos(eventos ?? [], filtros), [eventos, filtros]);

  return (
    <PanelPortal>
      <EncabezadoPagina titulo="Actividad" descripcion="Todo lo que se hizo en el portal: quién, cuándo y qué. Lo que no hizo una persona figura como Sistema." />

      <div className="space-y-3">
        <Segmentado etiqueta="Qué" opciones={AREAS} valor={filtros.area} onCambio={(area) => { setFiltros({ ...filtros, area }); setVisibles(PASO); }} envolver />
        <Segmentado etiqueta="Quién" opciones={QUIEN} valor={filtros.quien} onCambio={(quien) => { setFiltros({ ...filtros, quien }); setVisibles(PASO); }} lleno />
      </div>

      {error && (
        <Aviso tono="error" className="mt-3">
          {error}
        </Aviso>
      )}
      {truncado && (
        <Aviso tono="aviso" className="mt-3">
          Se muestran los cambios más recientes.
        </Aviso>
      )}
      {!error && eventos === null && (
        <div className="mt-3">
          <ListaCargando />
        </div>
      )}

      {eventos && (
        <div className="mt-3">
          {filtrados.length === 0 ? (
            <ListaVacia>No hay actividad con estos filtros.</ListaVacia>
          ) : (
            <>
              <ul className={`${LISTA_SEPARADORES} overflow-hidden rounded-lg border border-[#D9DFE3] bg-[#FFFFFF]`}>
                {filtrados.slice(0, visibles).map((e) => (
                  <li key={e.id} className="px-4 py-2.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <p className="min-w-0 break-words text-[15px] font-semibold text-gray-900">{e.titulo}</p>
                      <p className={TEXTO_SECUNDARIO}>{fechaHora(e.fecha)}</p>
                    </div>
                    {e.detalle && <p className={`mt-0.5 break-words ${TEXTO_SECUNDARIO}`}>{e.detalle}</p>}
                    <p className={`mt-1 flex flex-wrap items-center gap-2 ${TEXTO_SECUNDARIO}`}>
                      {e.sistema ? <Pastilla tono="info">Sistema</Pastilla> : <span className="font-medium text-[#1F2A30]">{e.quien}</span>}
                      <span aria-hidden="true">·</span>
                      <span>{ETIQUETA_AREA[e.area]}</span>
                    </p>
                  </li>
                ))}
              </ul>
              {filtrados.length > visibles && (
                <button
                  type="button"
                  onClick={() => setVisibles((v) => v + PASO)}
                  className="mt-3 min-h-12 w-full rounded-lg border border-[#7D8892] bg-[#FFFFFF] px-4 text-base font-semibold text-[#1F2A30] hover:bg-[#EAF0F2] active:bg-[#D5E0E4]"
                >
                  Ver más ({filtrados.length - visibles} restantes)
                </button>
              )}
            </>
          )}
        </div>
      )}
    </PanelPortal>
  );
}
