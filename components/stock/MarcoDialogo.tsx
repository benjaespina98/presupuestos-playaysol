"use client";

import type { ReactNode } from "react";
import { boton } from "@/components/ui/botones";
import { Hoja } from "@/components/ui/Hoja";

/**
 * El marco común de los diálogos de stock (Ingreso, Venta, Ajustar conteo, Historial): es la hoja
 * compartida del portal (components/ui/Hoja). En el celular sube desde abajo con el encabezado y el
 * pie fijos; desde sm es un cuadro centrado. Mientras `ocupado` no se cierra (no se pierde una
 * operación a medias). `pie` son las acciones, que quedan siempre a la vista.
 */
export function MarcoDialogo({
  titulo,
  subtitulo,
  ocupado = false,
  ancho = "sm:max-w-sm",
  pie,
  onCerrar,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  ocupado?: boolean;
  ancho?: string;
  pie?: ReactNode;
  onCerrar: () => void;
  children: ReactNode;
}) {
  const tamano = /2xl|xl/.test(ancho) ? "xl" : /lg/.test(ancho) ? "lg" : /md/.test(ancho) ? "md" : "sm";
  return (
    <Hoja titulo={titulo} subtitulo={subtitulo} ocupado={ocupado} ancho={tamano} pie={pie} onCerrar={onCerrar}>
      {children}
    </Hoja>
  );
}

export const CLASE_INPUT =
  "min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 hover:border-gray-400 focus:border-marca focus:outline-none focus:ring-2 focus:ring-celeste/40 disabled:opacity-50";

export const CLASE_BOTON_PRIMARIO = `${boton.base} ${boton.primario} w-full`;

export const CLASE_BOTON_PELIGRO =
  "inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 active:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50";

export const CLASE_BOTON_SECUNDARIO = `${boton.base} ${boton.secundario} w-full font-medium`;
