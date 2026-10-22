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
  "min-h-12 w-full rounded-lg border border-[#7D8892] px-3 py-2 text-base text-gray-900 placeholder:text-gray-500 hover:border-[#244B5A] focus:border-[#244B5A] focus:outline-none focus:ring-2 focus:ring-celeste/40 disabled:bg-gray-100 disabled:text-gray-600";

export const CLASE_BOTON_PRIMARIO = `${boton.base} ${boton.primario} w-full`;

export const CLASE_BOTON_PELIGRO = `${boton.base} ${boton.peligroLleno} w-full`;

export const CLASE_BOTON_SECUNDARIO = `${boton.base} ${boton.secundario} w-full font-medium`;
