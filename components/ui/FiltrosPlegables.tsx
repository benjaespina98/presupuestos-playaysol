"use client";

import { useId, useState, type ReactNode } from "react";
import { IconSearch } from "@/components/icons";

/**
 * Buscador con botón de limpiar. Un solo estilo para todas las pantallas con búsqueda.
 */
export function Buscador({
  valor,
  onCambio,
  placeholder,
  etiqueta,
}: {
  valor: string;
  onCambio: (v: string) => void;
  placeholder: string;
  etiqueta: string;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        placeholder={placeholder}
        aria-label={etiqueta}
        className="min-h-11 w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-11 text-base text-gray-900 shadow-sm placeholder:text-gray-400 hover:border-gray-300 focus:border-marca focus:outline-none focus:ring-2 focus:ring-celeste/30 sm:text-sm"
      />
      {valor && (
        <button
          type="button"
          onClick={() => onCambio("")}
          aria-label="Limpiar búsqueda"
          className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-xl leading-none text-gray-400 hover:text-gray-700"
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
  );
}

/**
 * La barra de búsqueda y filtros de una lista. En el celular ocupa UNA fila: el buscador y un botón
 * "Filtros" (con la cantidad de filtros activos) que despliega el resto; en pantallas medianas y
 * grandes todo queda a la vista, como siempre.
 */
export function FiltrosPlegables({
  buscador,
  filtrosActivos,
  children,
}: {
  buscador: ReactNode;
  /** Cuántos filtros (sin contar la búsqueda) hay aplicados. */
  filtrosActivos: number;
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const id = useId();
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        {buscador}
        <button
          type="button"
          onClick={() => setAbierto(!abierto)}
          aria-expanded={abierto}
          aria-controls={`${id}-filtros`}
          className={`relative inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border px-3.5 text-sm font-semibold transition-colors md:hidden ${
            abierto || filtrosActivos > 0 ? "border-marca bg-marca/8 text-marca" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
          }`}
        >
          Filtros
          {filtrosActivos > 0 && (
            <span className="rounded-full bg-marca px-1.5 py-0.5 text-xs font-bold leading-none text-white tabular-nums">{filtrosActivos}</span>
          )}
        </button>
      </div>
      <div id={`${id}-filtros`} className={`${abierto ? "block" : "hidden"} space-y-2.5 md:block`}>
        {children}
      </div>
    </div>
  );
}
