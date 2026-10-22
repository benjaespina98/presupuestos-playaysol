"use client";

import { IconSearch } from "@/components/icons";

/**
 * Buscador con botón de limpiar. Un solo estilo para todas las pantallas con búsqueda (la barra compacta
 * de las listas está en `BarraListado`).
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
      <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4A5861]" />
      <input
        type="text"
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        placeholder={placeholder}
        aria-label={etiqueta}
        className="min-h-11 w-full truncate rounded-lg border bg-[#FFFFFF] py-2.5 pl-10 pr-11 text-base text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-celeste/30 sm:text-sm"
      />
      {valor && (
        <button
          type="button"
          onClick={() => onCambio("")}
          aria-label="Limpiar búsqueda"
          className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-xl leading-none text-[#4A5861] hover:text-[#1F2A30]"
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
  );
}
