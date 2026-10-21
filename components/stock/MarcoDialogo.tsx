"use client";

import { useId, type ReactNode } from "react";
import { boton } from "@/components/ui/botones";

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
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#244B5A]/45 sm:items-center sm:p-4"
      onClick={ocupado ? undefined : onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        className={`max-h-[92dvh] w-full overflow-y-auto rounded-t-xl bg-white p-5 shadow-2xl sm:rounded-xl sm:p-6 ${ancho}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={`${id}-titulo`} className="text-base font-bold text-[#244B5A]">
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
  "min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 hover:border-gray-400 focus:border-marca focus:outline-none focus:ring-2 focus:ring-celeste/40 disabled:opacity-50";

export const CLASE_BOTON_PRIMARIO = `${boton.base} ${boton.primario} w-full`;

export const CLASE_BOTON_PELIGRO =
  "inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 active:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50";

export const CLASE_BOTON_SECUNDARIO = `${boton.base} ${boton.secundario} w-full font-medium`;
