"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";

export interface OpcionSelector {
  value: string;
  label: string;
  /** Una línea gris debajo: qué significa la opción. */
  descripcion?: string;
}

/** Más opciones que esto: la lista lleva buscador. */
export const MAX_SIN_BUSCADOR = 8;

/**
 * Lista de opciones propia, en hoja inferior (celular) o cuadro centrado (escritorio): opciones de 48 px, la
 * actual marcada con tilde, se cierra al elegir. Con más de 8 opciones, con buscador.
 * Escape o tocar afuera la cierra sin tocar la hoja de edición que la abrió.
 */
export function SelectorHoja({
  titulo,
  opciones,
  valor,
  onElegir,
  onCerrar,
}: {
  titulo: string;
  opciones: readonly OpcionSelector[];
  valor: string;
  onElegir: (valor: string) => void;
  onCerrar: () => void;
}) {
  const id = useId();
  const [q, setQ] = useState("");
  const conBuscador = opciones.length > MAX_SIN_BUSCADOR;
  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? opciones.filter((o) => `${o.label} ${o.descripcion ?? ""}`.toLowerCase().includes(t)) : opciones;
  }, [opciones, q]);

  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onCerrar();
    }
    window.addEventListener("keydown", alTeclear, true);
    return () => window.removeEventListener("keydown", alTeclear, true);
  }, [onCerrar]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#244B5A]/45 sm:items-center sm:p-4" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        className="flex max-h-[80dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-sm sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#D9DFE3] px-5 py-2">
          <h3 id={`${id}-t`} className="text-lg font-bold text-[#244B5A]">
            {titulo}
          </h3>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar lista"
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-xl text-[#3E4A52] hover:bg-[#EAF0F2] active:bg-[#D5E0E4]"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        {conBuscador && (
          <div className="border-b border-[#D9DFE3] px-5 py-2">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar…"
              aria-label={`Buscar en ${titulo}`}
              className="min-h-12 w-full rounded-lg border bg-white px-3 text-base"
            />
          </div>
        )}
        <ul role="listbox" aria-label={titulo} className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {visibles.map((o) => {
            const actual = o.value === valor;
            return (
              <li key={o.value} role="option" aria-selected={actual}>
                <button
                  type="button"
                  onClick={() => onElegir(o.value)}
                  className={`flex min-h-12 w-full items-center gap-3 px-5 py-2 text-left hover:bg-[#EAF0F2] active:bg-[#D5E0E4] ${actual ? "bg-[#F1F6F8]" : ""}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className={`block break-words text-base text-[#1F2A30] ${actual ? "font-semibold" : ""}`}>{o.label}</span>
                    {o.descripcion && <span className="block break-words text-[13px] leading-snug text-[#4A5861]">{o.descripcion}</span>}
                  </span>
                  <span aria-hidden="true" className={`w-5 shrink-0 text-lg text-[#244B5A] ${actual ? "" : "invisible"}`}>
                    ✓
                  </span>
                </button>
              </li>
            );
          })}
          {visibles.length === 0 && <li className="px-5 py-6 text-center text-sm text-[#4A5861]">Ninguna opción coincide.</li>}
        </ul>
      </div>
    </div>,
    document.body
  );
}
