"use client";

// Modal de confirmación propio, con la identidad de marca (navy, mismo lenguaje visual
// que public/catalogo-modal.js) en vez del confirm() nativo del navegador — inconsistente
// visualmente y no personalizable (título/aclaración/jerarquía de botones).
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1B3A5C]/45 p-4"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-2 text-base font-bold text-[#1B3A5C]">{title}</h2>
        <p className="mb-6 text-sm leading-relaxed text-gray-600">{message}</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            autoFocus
            disabled={loading}
            onClick={onConfirm}
            className={`w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${
              danger
                ? "bg-red-600 hover:bg-red-700 focus-visible:outline-red-600"
                : "bg-[#1B3A5C] hover:bg-[#142c46] focus-visible:outline-[#1B3A5C]"
            }`}
          >
            {loading ? "Un momento..." : confirmLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="w-full rounded-md border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
