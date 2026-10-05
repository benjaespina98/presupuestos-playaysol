"use client";

import { CATEGORIAS, type Categoria } from "@/lib/domain/catalogo/categorias";
import { LINEAS_PISCINA, type LineaPiscina } from "@/lib/domain/catalogo/listas";
import type { TipoCalculadora } from "@/lib/presupuestos";
import { IconSearch } from "@/components/icons";
import { TITULOS_TIPO } from "./titulos-tipo";

export interface FiltrosCatalogoProps {
  busqueda: string;
  onBusqueda: (v: string) => void;
  categoria: Categoria | "";
  onCategoria: (v: Categoria | "") => void;
  tipo: TipoCalculadora | "";
  onTipo: (v: TipoCalculadora | "") => void;
  linea: LineaPiscina | "";
  onLinea: (v: LineaPiscina | "") => void;
  /** Piscinas completas por línea; vacío = no hay ninguna, se oculta el grupo. */
  conteosLinea: Partial<Record<LineaPiscina, number>>;
  incluirInactivos: boolean;
  onIncluirInactivos: (v: boolean) => void;
  modoConsulta: boolean;
  onModoConsulta: (v: boolean) => void;
  /** Cuántos ítems hay por categoría con el resto de los filtros aplicados. */
  conteos: { total: number; porCategoria: Partial<Record<Categoria, number>> };
  hayFiltros: boolean;
  onLimpiar: () => void;
}

/**
 * Barra de filtros del Catálogo: búsqueda, categorías como chips con contador,
 * calculadora, y dos interruptores. Es controlada: el estado vive en la página
 * (que además lo usa para filtrar), acá sólo se dibuja y se avisa lo que cambió.
 */
export function FiltrosCatalogo({
  busqueda,
  onBusqueda,
  categoria,
  onCategoria,
  tipo,
  onTipo,
  linea,
  onLinea,
  conteosLinea,
  incluirInactivos,
  onIncluirInactivos,
  modoConsulta,
  onModoConsulta,
  conteos,
  hayFiltros,
  onLimpiar,
}: FiltrosCatalogoProps) {
  // Sólo las categorías con algo adentro (más la elegida, para poder des-elegirla).
  const categoriasVisibles = CATEGORIAS.filter(
    (c) => (conteos.porCategoria[c] ?? 0) > 0 || c === categoria
  );

  const lineasVisibles = LINEAS_PISCINA.filter(
    (l) => (conteosLinea[l.id] ?? 0) > 0 || l.id === linea
  );

  return (
    <div className="mb-5 space-y-3 md:sticky md:top-0 md:z-20 md:-mx-4 md:bg-gray-50/90 md:px-4 md:py-3 md:backdrop-blur">
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={busqueda}
          onChange={(e) => onBusqueda(e.target.value)}
          placeholder="Buscar por nombre o clave..."
          aria-label="Buscar en el catálogo"
          className="min-h-12 w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-11 text-sm text-gray-900 shadow-sm transition-shadow placeholder:text-gray-400 focus:border-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20"
        />
        {busqueda && (
          <button
            type="button"
            onClick={() => onBusqueda("")}
            aria-label="Limpiar búsqueda"
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-lg leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ×
          </button>
        )}
      </div>

      <div
        role="group"
        aria-label="Filtrar por categoría"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0"
      >
        <Chip activo={categoria === ""} onClick={() => onCategoria("")} cantidad={conteos.total}>
          Todas
        </Chip>
        {categoriasVisibles.map((c) => (
          <Chip
            key={c}
            activo={categoria === c}
            onClick={() => onCategoria(categoria === c ? "" : c)}
            cantidad={conteos.porCategoria[c] ?? 0}
          >
            {c}
          </Chip>
        ))}
      </div>

      {lineasVisibles.length > 0 && (
        <div
          role="group"
          aria-label="Filtrar piscinas completas por línea"
          className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0"
        >
          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Piscinas completas
          </span>
          {lineasVisibles.map((l) => (
            <Chip
              key={l.id}
              activo={linea === l.id}
              onClick={() => onLinea(linea === l.id ? "" : l.id)}
              cantidad={conteosLinea[l.id] ?? 0}
            >
              {l.etiqueta}
            </Chip>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <select
          value={tipo}
          onChange={(e) => onTipo(e.target.value as TipoCalculadora | "")}
          aria-label="Filtrar por calculadora"
          className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20 sm:w-auto"
        >
          <option value="">Todas las calculadoras</option>
          {(Object.keys(TITULOS_TIPO) as TipoCalculadora[]).map((t) => (
            <option key={t} value={t}>
              {TITULOS_TIPO[t]}
            </option>
          ))}
        </select>

        <Interruptor checked={incluirInactivos} onChange={onIncluirInactivos}>
          Mostrar dados de baja
        </Interruptor>

        {hayFiltros && (
          <button
            type="button"
            onClick={onLimpiar}
            className="min-h-11 rounded-lg px-3 text-sm font-medium text-[#1B3A5C] hover:bg-[#1B3A5C]/8"
          >
            Limpiar filtros
          </button>
        )}

        <div className="sm:ml-auto">
          <Interruptor checked={modoConsulta} onChange={onModoConsulta}>
            Modo consulta rápida
          </Interruptor>
        </div>
      </div>
    </div>
  );
}

function Chip({
  activo,
  onClick,
  cantidad,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  cantidad: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3A5C]/30 ${
        activo
          ? "border-[#1B3A5C] bg-[#1B3A5C] text-white shadow-sm"
          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      {children}
      <span
        className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
          activo ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
        }`}
      >
        {cantidad}
      </span>
    </button>
  );
}

/** Interruptor accesible: un checkbox real (por eso se prueba con su label) con
 *  el aspecto de un switch. */
function Interruptor({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-gray-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-5 w-9 shrink-0 rounded-full bg-gray-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-[#1B3A5C] peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-[#1B3A5C]/30"
      />
      {children}
    </label>
  );
}
