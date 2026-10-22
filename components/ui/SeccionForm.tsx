"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Piezas comunes de los formularios dentro de la hoja de edición: secciones con título corto y separación
 * clara, una sección plegable (para lo secundario, como las notas), la zona "Activo" separada al final y un
 * ícono de información con popover para las explicaciones largas (en el formulario queda una línea como máximo).
 */

export function Seccion({ titulo, children, ayuda }: { titulo: string; children: ReactNode; ayuda?: ReactNode }) {
  return (
    <fieldset className="space-y-4 border-t border-[#D9DFE3] pt-4 first:border-t-0 first:pt-0">
      <legend className="mb-3 flex items-center gap-1 text-[13px] font-bold uppercase tracking-wide text-[#244B5A]">
        {titulo}
        {ayuda}
      </legend>
      {children}
    </fieldset>
  );
}

/** Una sección que arranca cerrada (o abierta si ya tiene datos): "Notas". */
export function SeccionPlegable({ titulo, abierta = false, children }: { titulo: string; abierta?: boolean; children: ReactNode }) {
  return (
    <details open={abierta} className="group rounded-xl border border-[#D9DFE3]">
      <summary className="flex min-h-12 list-none items-center justify-between gap-2 rounded-xl px-4 text-base font-semibold text-[#1F2A30] hover:bg-[#F4F8F9] [&::-webkit-details-marker]:hidden">
        {titulo}
        <span aria-hidden="true" className="text-[#4A5861] transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="space-y-4 border-t border-[#D9DFE3] px-4 py-4">{children}</div>
    </details>
  );
}

/** La zona "Activo", separada al final: un switch y una línea de ayuda. */
export function ZonaActivo({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-[#D9DFE3] bg-[#F7F9FA] px-4 py-2">{children}</div>;
}

/** Un ícono "i" que abre un cuadro con una explicación más larga. Se cierra tocando afuera o con Escape. */
export function InfoPopover({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const alTocar = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setAbierto(false);
      }
    };
    document.addEventListener("mousedown", alTocar);
    document.addEventListener("keydown", alTeclear, true);
    return () => {
      document.removeEventListener("mousedown", alTocar);
      document.removeEventListener("keydown", alTeclear, true);
    };
  }, [abierto]);

  return (
    <span ref={caja} className="relative inline-flex normal-case tracking-normal">
      <button
        type="button"
        aria-label={etiqueta}
        aria-expanded={abierto}
        aria-controls={abierto ? id : undefined}
        onClick={() => setAbierto((a) => !a)}
        className="-my-3 flex h-11 w-11 items-center justify-center rounded-full text-[#244B5A] hover:bg-[#EAF0F2] active:bg-[#D5E0E4]"
      >
        <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[13px] font-bold leading-none">
          i
        </span>
      </button>
      {abierto && (
        <span
          id={id}
          role="note"
          className="absolute left-0 top-full z-20 mt-1 block w-64 rounded-xl border border-[#D9DFE3] bg-white p-3 text-[13px] font-normal leading-snug text-[#1F2A30] shadow-xl"
        >
          {children}
        </span>
      )}
    </span>
  );
}
