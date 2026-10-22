"use client";

import { boton, botonDe } from "@/components/ui/botones";
import { Hoja } from "@/components/ui/Hoja";

// Diálogo de confirmación propio, con la identidad de marca, en vez del confirm() nativo del
// navegador (inconsistente y no personalizable). Es la hoja compartida del portal: en el celular
// sube desde abajo con las acciones siempre a la vista.
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
    <Hoja
      titulo={title}
      rol="alertdialog"
      ancho="sm"
      ocupado={loading}
      onCerrar={onCancel}
      pie={
        <div className="flex gap-2">
          <button type="button" disabled={loading} onClick={onCancel} className={botonDe("secundario", "flex-1")}>
            {cancelLabel}
          </button>
          <button
            type="button"
            autoFocus
            disabled={loading}
            onClick={onConfirm}
            className={
              danger
                ? `${boton.base} flex-1 bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800`
                : botonDe("primario", "flex-1")
            }
          >
            {loading ? "Un momento..." : confirmLabel}
          </button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-gray-600">{message}</p>
    </Hoja>
  );
}
