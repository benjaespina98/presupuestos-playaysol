"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { LIMITE_MOVIMIENTOS, listarMovimientosGeneral } from "@/lib/stock";
import { ETIQUETA_TIPO, cantidadConSigno } from "@/lib/domain/stock/movimientos";
import { agotadosAhora, delPeriodo, quienHizo, resumirMovimientos, type MovimientoConItem, type PeriodoMovimientos } from "@/lib/domain/stock/resumen";
import { useEstadoPersistente } from "@/lib/useEstadoPersistente";
import { PanelPortal } from "@/components/PanelPortal";
import { EncabezadoPagina } from "@/components/catalogo/EncabezadoPagina";
import { Aviso } from "@/components/ui/Aviso";
import { ListaCargando, ListaVacia } from "@/components/ui/EstadoLista";
import { LISTA_SEPARADORES, TEXTO_SECUNDARIO } from "@/components/ui/lista";
import { Pastilla } from "@/components/ui/Pastilla";
import { Segmentado } from "@/components/ui/Segmentado";

type Tipo = "" | "ingreso" | "venta" | "ajuste";
interface Filtros {
  periodo: PeriodoMovimientos;
  tipo: Tipo;
}
const SIN_FILTROS: Filtros = { periodo: "30", tipo: "" };

const PERIODOS = [
  { id: "hoy" as const, texto: "Hoy" },
  { id: "7" as const, texto: "7 días" },
  { id: "30" as const, texto: "30 días" },
  { id: "todo" as const, texto: "Todo" },
];
const TIPOS = [
  { id: "" as const, texto: "Todos" },
  { id: "venta" as const, texto: "Ventas" },
  { id: "ingreso" as const, texto: "Ingresos" },
  { id: "ajuste" as const, texto: "Ajustes" },
];

function fechaHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fecha(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Movimientos de stock: el registro de todo lo que se sumó, restó o corrigió (cuándo, quién, cuánto y cómo quedó), con
 * métricas del período elegido y la lista de lo que hoy está sin stock con la fecha en que se agotó.
 */
export default function MovimientosPage() {
  const [movimientos, setMovimientos] = useState<MovimientoConItem[] | null>(null);
  const [truncado, setTruncado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useEstadoPersistente<Filtros>("stock:movimientos", SIN_FILTROS);

  useEffect(() => {
    let cancelado = false;
    listarMovimientosGeneral().then((r) => {
      if (cancelado) return;
      if (r.error !== null) setError(r.error);
      else {
        setMovimientos(r.movimientos);
        setTruncado(r.truncado);
      }
    });
    return () => {
      cancelado = true;
    };
  }, []);

  const delPeriodoElegido = useMemo(() => delPeriodo(movimientos ?? [], filtros.periodo), [movimientos, filtros.periodo]);
  const resumen = useMemo(() => resumirMovimientos(delPeriodoElegido), [delPeriodoElegido]);
  const agotados = useMemo(() => agotadosAhora(movimientos ?? []), [movimientos]);
  const visibles = useMemo(
    () => (filtros.tipo ? delPeriodoElegido.filter((m) => m.tipo === filtros.tipo) : delPeriodoElegido),
    [delPeriodoElegido, filtros.tipo]
  );

  return (
    <PanelPortal>
      <EncabezadoPagina titulo="Movimientos de stock" descripcion="Quién sumó o restó stock, cuándo y cuánto." />

      <div className="space-y-3">
        <Segmentado etiqueta="Período" opciones={PERIODOS} valor={filtros.periodo} onCambio={(periodo) => setFiltros({ ...filtros, periodo })} lleno />
        <Segmentado etiqueta="Tipo de movimiento" opciones={TIPOS} valor={filtros.tipo} onCambio={(tipo) => setFiltros({ ...filtros, tipo })} lleno />
      </div>

      {error && (
        <Aviso tono="error" className="mt-3">
          {error}
        </Aviso>
      )}
      {truncado && (
        <Aviso tono="aviso" className="mt-3">
          Se muestran los últimos {LIMITE_MOVIMIENTOS} movimientos.
        </Aviso>
      )}

      {!error && movimientos === null && (
        <div className="mt-3">
          <ListaCargando />
        </div>
      )}

      {movimientos && (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Metrica titulo="Vendidas" valor={resumen.vendidas} />
            <Metrica titulo="Ingresadas" valor={resumen.ingresadas} />
            <Metrica titulo="Movimientos" valor={resumen.movimientos} />
            <Metrica titulo="Sin stock ahora" valor={agotados.length} aviso={agotados.length > 0} />
          </dl>

          {(resumen.masVendidos.length > 0 || resumen.porPersona.length > 0) && (
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {resumen.masVendidos.length > 0 && (
                <Tarjeta titulo="Más vendidas">
                  {resumen.masVendidos.slice(0, 5).map((f) => (
                    <Linea key={f.nombre} izquierda={f.nombre} derecha={`${f.unidades} ${f.unidades === 1 ? "unidad" : "unidades"}`} />
                  ))}
                </Tarjeta>
              )}
              {resumen.porPersona.length > 0 && (
                <Tarjeta titulo="Quién movió stock">
                  {resumen.porPersona.map((f) => (
                    <Linea key={f.nombre} izquierda={f.nombre} derecha={`${f.cantidad} ${f.cantidad === 1 ? "movimiento" : "movimientos"}`} />
                  ))}
                </Tarjeta>
              )}
            </div>
          )}

          {agotados.length > 0 && (
            <div className="mt-3">
              <Tarjeta titulo="Sin stock ahora: cuándo se agotaron">
                {agotados.map((a) => (
                  <Linea key={a.itemId} izquierda={a.nombre} derecha={`${fecha(a.fecha)}${a.quien ? ` · ${a.quien}` : ""}`} />
                ))}
              </Tarjeta>
            </div>
          )}

          <h2 className="mb-2 mt-5 text-base font-bold text-[#244B5A]">Registro</h2>
          {visibles.length === 0 ? (
            <ListaVacia>No hay movimientos en este período.</ListaVacia>
          ) : (
            <ul className={`${LISTA_SEPARADORES} overflow-hidden rounded-lg border border-[#D9DFE3] bg-[#FFFFFF]`}>
              {visibles.map((m) => (
                <li key={m.id} className={`px-4 py-2.5 ${m.anulado ? "bg-[#F4F6F7]" : ""}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <p className="min-w-0 break-words text-[15px] font-semibold text-gray-900">
                      <span className={m.anulado ? "line-through" : ""}>{m.itemNombre}</span>{" "}
                      <span className={`tabular-nums ${m.cantidad < 0 ? "text-[#B42318]" : "text-[#05603A]"} ${m.anulado ? "line-through" : ""}`}>
                        {cantidadConSigno(m.cantidad)}
                      </span>
                      {m.anulado && <Pastilla className="ml-2 align-middle">Anulado</Pastilla>}
                    </p>
                    <p className={TEXTO_SECUNDARIO}>{fechaHora(m.creado_at)}</p>
                  </div>
                  <p className={`mt-0.5 ${TEXTO_SECUNDARIO}`}>
                    {ETIQUETA_TIPO[m.tipo]} · {quienHizo(m)} · Quedó en{" "}
                    <span className={`font-semibold tabular-nums ${m.stock_resultante < 0 ? "text-[#B42318]" : "text-[#1F2A30]"}`}>{m.stock_resultante}</span>
                    {m.motivo ? ` · ${m.motivo}` : ""}
                    {m.referencia ? ` · ${m.referencia}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </PanelPortal>
  );
}

function Metrica({ titulo, valor, aviso = false }: { titulo: string; valor: number; aviso?: boolean }) {
  return (
    <div className={`rounded-lg border px-4 py-3 ${aviso ? "border-[#FEC84B] bg-[#FFFAEB]" : "border-[#D9DFE3] bg-[#FFFFFF]"}`}>
      <dt className={TEXTO_SECUNDARIO}>{titulo}</dt>
      <dd className="text-2xl font-bold tabular-nums text-[#244B5A]">{valor}</dd>
    </div>
  );
}

function Tarjeta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-[#D9DFE3] bg-[#FFFFFF]">
      <h3 className="flex h-9 items-center border-b border-[#D9DFE3] bg-[#F4F8F9] px-4 text-[13px] font-bold uppercase tracking-wide text-[#244B5A]">{titulo}</h3>
      <ul className={LISTA_SEPARADORES}>{children}</ul>
    </section>
  );
}

function Linea({ izquierda, derecha }: { izquierda: string; derecha: string }) {
  return (
    <li className="flex items-baseline justify-between gap-3 px-4 py-2 text-[15px]">
      <span className="min-w-0 break-words font-medium text-gray-900">{izquierda}</span>
      <span className={`shrink-0 tabular-nums ${TEXTO_SECUNDARIO}`}>{derecha}</span>
    </li>
  );
}
