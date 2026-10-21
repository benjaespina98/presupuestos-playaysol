"use client";


/**
 * Piezas compartidas por los modales de Proveedores y Materiales (y con el
 * mismo aspecto que los del catálogo de precios): el marco y los botones de
 * guardar/cancelar. Cada modal sólo
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
