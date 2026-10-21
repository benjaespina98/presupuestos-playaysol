"use client";

import { useId, type ReactNode } from "react";

/**
 * El marco común de los diálogos de stock (Ingreso, Venta, Ajustar conteo,
 * Historial): mismo lenguaje visual que `ConfirmDialog` y `AnularDialog`. En el
 * celular sube desde abajo y ocupa el ancho; desde sm es un cuadro centrado.
 * Mientras `ocupado` no se cierra tocando afuera (no se pierde una operación a medias).
 */
export function MarcoDialogo({
  titulo,
  subtitulo,
  ocupado = false,
  ancho = "sm:max-w-sm",
  onCerrar,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  ocupado?: boolean;
  ancho?: string;
  onCerrar: () => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#1B3A5C]/45 sm:items-center sm:p-4"
      onClick={ocupado ? undefined : onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        className={`max-h-[92dvh] w-full overflow-y-auto rounded-t-xl bg-white p-5 shadow-2xl sm:rounded-xl sm:p-6 ${ancho}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={`${id}-titulo`} className="text-base font-bold text-[#1B3A5C]">
          {titulo}
        </h2>
        {subtitulo && <p className="mb-3 mt-0.5 text-sm text-gray-500">{subtitulo}</p>}
        {!subtitulo && <div className="mb-3" />}
        {children}
      </div>
    </div>
  );
}

export const CLASE_INPUT =
  "min-h-11 w-full rounded-md border border-gray-300 px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C] disabled:opacity-50";

export const CLASE_BOTON_PRIMARIO =
  "min-h-11 w-full rounded-md bg-[#1B3A5C] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#142c46] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B3A5C] disabled:cursor-not-allowed disabled:opacity-50";

export const CLASE_BOTON_PELIGRO =
  "min-h-11 w-full rounded-md bg-red-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-50";

export const CLASE_BOTON_SECUNDARIO =
  "min-h-11 w-full rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 disabled:cursor-not-allowed disabled:opacity-50";
