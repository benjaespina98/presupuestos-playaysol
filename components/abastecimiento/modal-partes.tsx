"use client";

import { Hoja } from "@/components/ui/Hoja";

/**
 * Marco de los modales de abastecimiento que todavía no tienen acciones fijas (el detalle de un
 * pedido): es la hoja compartida del portal (components/ui/Hoja), con el encabezado fijo y el
 * cuerpo con scroll. Los formularios de Material y Proveedor usan la hoja directamente.
 */
export function ModalShell({
  titulo,
  subtitulo,
  ocupado = false,
  ancho = "max-w-md",
  onClose,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  /** Mientras guarda no se puede cerrar tocando afuera. */
  ocupado?: boolean;
  ancho?: "max-w-md" | "max-w-2xl";
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Hoja titulo={titulo} subtitulo={subtitulo} ocupado={ocupado} ancho={ancho === "max-w-2xl" ? "xl" : "md"} onCerrar={onClose}>
      {children}
    </Hoja>
  );
}
