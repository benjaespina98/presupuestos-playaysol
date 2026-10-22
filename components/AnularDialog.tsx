"use client";

import { useId, useState } from "react";
import { MOTIVO_MAX, validarMotivo } from "@/lib/anulacion";
import { boton, botonDe } from "@/components/ui/botones";
import { Hoja } from "@/components/ui/Hoja";

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
    <Hoja
      titulo={titulo}
      rol="alertdialog"
      ancho="sm"
      ocupado={enviando}
      onCerrar={onCancel}
      pie={
        <div className="flex gap-2">
          <button type="button" disabled={enviando} onClick={onCancel} className={botonDe("secundario", "flex-1")}>
            No, conservarlo
          </button>
          <button
            type="button"
            disabled={enviando}
            onClick={confirmar}
            className={`${boton.base} flex-1 bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800`}
          >
            {enviando ? "Un momento..." : "Anular"}
          </button>
        </div>
      }
    >
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
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 hover:border-gray-400 focus:border-marca focus:outline-none focus:ring-2 focus:ring-celeste/40 disabled:opacity-50"
      />
      <p className="mt-1 text-right text-xs text-gray-400">
        {motivo.length}/{MOTIVO_MAX}
      </p>
      {error && (
        <p id={`${idCampo}-error`} role="alert" className="mt-1 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </Hoja>
  );
}
