"use client";

import { useId, useState } from "react";
import { MOTIVO_MAX, validarMotivo } from "@/lib/anulacion";

/**
 * Confirmación de "Anular" con motivo obligatorio. Mismo lenguaje visual que
 * `ConfirmDialog` (que no tiene campo de texto). Anular no borra: el registro
 * queda visible y exportable pero congelado (ver lib/anulacion.ts).
 *
 * `onConfirmar` recibe el motivo ya validado y recortado, y devuelve un mensaje
 * de error (el diálogo queda abierto para corregir) o `null` si salió bien.
 */
export function AnularDialog({
  open,
  titulo,
  mensaje,
  onConfirmar,
  onCancel,
}: {
  open: boolean;
  titulo: string;
  mensaje: string;
  onConfirmar: (motivo: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  if (!open) return null;
  // El contenido se monta cada vez que se abre: el motivo y los errores arrancan limpios.
  return <Contenido titulo={titulo} mensaje={mensaje} onConfirmar={onConfirmar} onCancel={onCancel} />;
}

function Contenido({
  titulo,
  mensaje,
  onConfirmar,
  onCancel,
}: {
  titulo: string;
  mensaje: string;
  onConfirmar: (motivo: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const idCampo = useId();
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    const v = validarMotivo(motivo);
    if (v.error !== null) {
      setError(v.error);
      return;
    }
    setEnviando(true);
    setError(null);
    const fallo = await onConfirmar(v.motivo);
    setEnviando(false);
    if (fallo) setError(fallo);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#244B5A]/45 p-4"
      onClick={enviando ? undefined : onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${idCampo}-titulo`}
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={`${idCampo}-titulo`} className="mb-2 text-base font-bold text-[#244B5A]">
          {titulo}
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-gray-600">{mensaje}</p>

        <label htmlFor={idCampo} className="mb-1 block text-sm font-medium text-gray-700">
          Motivo de la anulación
        </label>
        <textarea
          id={idCampo}
          autoFocus
          rows={3}
          maxLength={MOTIVO_MAX}
          value={motivo}
          disabled={enviando}
          onChange={(e) => {
            setMotivo(e.target.value);
            setError(null);
          }}
          aria-invalid={error !== null}
          aria-describedby={error ? `${idCampo}-error` : undefined}
          placeholder="Por ejemplo: cargado dos veces, el cliente no avanzó…"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#244B5A] focus:outline-none focus:ring-1 focus:ring-[#244B5A] disabled:opacity-50"
        />
        <p className="mt-1 text-right text-xs text-gray-400">
          {motivo.length}/{MOTIVO_MAX}
        </p>
        {error && (
          <p id={`${idCampo}-error`} role="alert" className="mt-1 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={enviando}
            onClick={confirmar}
            className="w-full rounded-md bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-50"
          >
            {enviando ? "Un momento..." : "Anular"}
          </button>
          <button
            type="button"
            disabled={enviando}
            onClick={onCancel}
            className="w-full rounded-md border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 disabled:opacity-50"
          >
            No, conservarlo
          </button>
        </div>
      </div>
    </div>
  );
}
