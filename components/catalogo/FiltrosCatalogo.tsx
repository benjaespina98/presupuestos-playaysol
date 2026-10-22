"use client";

import { SECCIONES, type SeccionId } from "@/lib/domain/catalogo/secciones";
import type { FiltroStock } from "@/lib/domain/catalogo/item";
import { Buscador, FiltrosPlegables } from "@/components/ui/FiltrosPlegables";
import { BarraFiltros } from "./BarraFiltros";

export interface FiltrosCatalogoProps {
  busqueda: string;
  onBusqueda: (v: string) => void;
  seccion: SeccionId | "";
  onSeccion: (v: SeccionId | "") => void;
  /** Cuántos ítems hay por sección con el resto de los filtros aplicados. */
  conteos: { total: number; porSeccion: Partial<Record<SeccionId, number>> };
  stock: FiltroStock | "";
  onStock: (v: FiltroStock | "") => void;
  /** Ítems por disponibilidad; si ninguno lleva stock, el filtro se oculta. */
  conteosStock: Record<FiltroStock, number>;
  incluirInactivos: boolean;
  onIncluirInactivos: (v: boolean) => void;
  modoConsulta: boolean;
  onModoConsulta: (v: boolean) => void;
  hayFiltros: boolean;
  onLimpiar: () => void;
}

export const CLASE_SELECT =
  "min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-[#244B5A] focus:outline-none focus:ring-2 focus:ring-[#244B5A]/20 sm:w-auto";


/**
 * Filtros del Catálogo de precios, pensados para encontrar rápido lo que más se
 * consulta. En la barra fija (se queda arriba al bajar):
 *
 *  1. La búsqueda (y el stock, ver abajo).
 *  2. Las secciones como accesos directos de un toque: piscinas de hormigón,
 *     piscinas de fibra Indusplast, cobertores, cercos, climatización,
 *     revestimientos y otros, cada una con su cantidad.
 *     Se acomodan en varias líneas si no entran: todas quedan a la vista.
 *  3. El stock, en un desplegable junto a la búsqueda (sólo si algún ítem lo lleva):
 *     con stock / agotado / a pedido.
 *
 * Debajo, sin quedarse fija: los interruptores ("desactivados", "modo
 * consulta") y "Limpiar filtros". Es controlada: el estado vive en la página.
 */
export function FiltrosCatalogo({
  busqueda,
  onBusqueda,
  seccion,
  onSeccion,
  conteos,
  stock,
  onStock,
  conteosStock,
  incluirInactivos,
  onIncluirInactivos,
  modoConsulta,
  onModoConsulta,
  hayFiltros,
  onLimpiar,
}: FiltrosCatalogoProps) {
  // Sólo las secciones con algo adentro (más la elegida, para poder des-elegirla).
  const seccionesVisibles = SECCIONES.filter((s) => (conteos.porSeccion[s.id] ?? 0) > 0 || s.id === seccion);
  const hayStock = conteosStock.disponible + conteosStock.agotado > 0 || stock !== "";

  const filtrosActivos = [seccion, stock, incluirInactivos, modoConsulta].filter(Boolean).length;

  return (
    <BarraFiltros>
      <FiltrosPlegables
        filtrosActivos={filtrosActivos}
        buscador={
          <Buscador
            valor={busqueda}
            onCambio={onBusqueda}
            placeholder="Buscar: Caribe 550, cerco, cobertor..."
            etiqueta="Buscar en el catálogo"
          />
        }
      >
        {hayStock && (
          <select
            value={stock}
            onChange={(e) => onStock(e.target.value as FiltroStock | "")}
            aria-label="Filtrar por stock"
            className={CLASE_SELECT}
          >
            <option value="">Stock: todos</option>
            <option value="disponible">Con stock ({conteosStock.disponible})</option>
            <option value="agotado">Agotado ({conteosStock.agotado})</option>
            <option value="sin-control">A pedido ({conteosStock["sin-control"]})</option>
          </select>
        )}

        <div
          role="group"
          aria-label="Filtrar por sección"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden"
        >
          <Chip activo={seccion === ""} onClick={() => onSeccion("")} cantidad={conteos.total}>
            Todo
          </Chip>
          {seccionesVisibles.map((s) => (
            <Chip key={s.id} activo={seccion === s.id} onClick={() => onSeccion(seccion === s.id ? "" : s.id)} cantidad={conteos.porSeccion[s.id] ?? 0}>
              {s.etiqueta}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-0.5">
          <Interruptor checked={incluirInactivos} onChange={onIncluirInactivos}>
            Mostrar desactivados
          </Interruptor>
          <Interruptor checked={modoConsulta} onChange={onModoConsulta}>
            Modo consulta rápida
          </Interruptor>
          {hayFiltros && (
            <button
              type="button"
              onClick={onLimpiar}
              className="min-h-11 rounded-lg px-3 text-sm font-medium text-marca hover:bg-marca/8 sm:ml-auto"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </FiltrosPlegables>
    </BarraFiltros>
  );
}

export function Chip({
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
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B5A]/30 ${
        activo
          ? "border-[#244B5A] bg-[#244B5A] text-white shadow-sm"
          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      {children}
      <span className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${activo ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
        {cantidad}
      </span>
    </button>
  );
}

/** Interruptor accesible: un checkbox real (por eso se prueba con su label) con
 *  el aspecto de un switch. */
export function Interruptor({
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
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className="relative h-5 w-9 shrink-0 rounded-full bg-gray-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-[#244B5A] peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-[#244B5A]/30"
      />
      {children}
    </label>
  );
}
