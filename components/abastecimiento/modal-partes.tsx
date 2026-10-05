"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

/**
 * Piezas compartidas por los modales de Proveedores y Materiales (y con el
 * mismo aspecto que los del catálogo de precios): el marco, los botones de
 * guardar/cancelar y la zona de eliminar con confirmación. Cada modal sólo
 * aporta sus campos.
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
  /** Mientras guarda o elimina no se puede cerrar tocando afuera. */
  ocupado?: boolean;
  ancho?: "max-w-md" | "max-w-2xl";
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1B3A5C]/45 p-4"
      onClick={ocupado ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-titulo"
        className={`max-h-[90vh] w-full ${ancho} overflow-y-auto rounded-xl bg-white p-6 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="modal-titulo" className="mb-1 text-base font-bold text-[#1B3A5C]">
          {titulo}
        </h2>
        {subtitulo && <p className="mb-4 text-xs text-gray-500">{subtitulo}</p>}
        {children}
      </div>
    </div>
  );
}

export function BotonesGuardar({
  guardando,
  etiqueta,
  etiquetaGuardando = "Guardando...",
  onCancelar,
}: {
  guardando: boolean;
  etiqueta: string;
  etiquetaGuardando?: string;
  onCancelar: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 pt-2 sm:flex-row-reverse">
      <button
        type="submit"
        disabled={guardando}
        className="min-h-11 w-full rounded-md bg-[#1B3A5C] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#142c46] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B3A5C] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
      >
        {guardando ? etiquetaGuardando : etiqueta}
      </button>
      <button
        type="button"
        onClick={onCancelar}
        disabled={guardando}
        className="min-h-11 w-full rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
      >
        Cancelar
      </button>
    </div>
  );
}

/**
 * "Eliminar" con confirmación, separado del resto del formulario. `onEliminar`
 * devuelve el error (o null si salió bien); el modal muestra el error y, si
 * salió bien, quien llama cierra y actualiza el listado.
 */
export function ZonaEliminar({
  etiqueta,
  titulo,
  mensaje,
  deshabilitado = false,
  onEliminar,
}: {
  etiqueta: string;
  titulo: string;
  mensaje: string;
  deshabilitado?: boolean;
  onEliminar: () => Promise<string | null>;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    setEliminando(true);
    setError(null);
    const e = await onEliminar();
    setEliminando(false);
    setConfirmando(false);
    if (e) setError(e);
  }

  return (
    <div className="mt-5 border-t border-gray-200 pt-4">
      {error && (
        <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        disabled={deshabilitado || eliminando}
        className="min-h-11 w-full rounded-md border border-red-200 px-4 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {etiqueta}
      </button>
      <ConfirmDialog
        open={confirmando}
        danger
        loading={eliminando}
        title={titulo}
        message={mensaje}
        confirmLabel="Sí, eliminar"
        cancelLabel="No, conservarlo"
        onConfirm={confirmar}
        onCancel={() => setConfirmando(false)}
      />
    </div>
  );
}
