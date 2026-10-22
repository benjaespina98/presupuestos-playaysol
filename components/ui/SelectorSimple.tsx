"use client";

import { useState } from "react";
import { SelectorHoja, type OpcionSelector } from "./SelectorHoja";

/**
 * El mismo selector de `SelectField` para los combos que no viven dentro de un formulario de React Hook Form
 * (tamaño de pileta, estado de un pedido, precio de lista): un botón que abre la lista propia en hoja inferior,
 * con opciones de 48 px y buscador si hay más de 8. Por debajo queda un `<select>` real (oculto), controlado,
 * que es el que se asocia al label y el que usan los lectores de pantalla y los tests.
 */
export function SelectorSimple({
  id,
  titulo,
  valor,
  opciones,
  onCambio,
  disabled = false,
  className = "",
}: {
  id: string;
  /** El nombre del campo (el de su label): título de la lista. */
  titulo: string;
  valor: string;
  opciones: OpcionSelector[];
  onCambio: (valor: string) => void;
  disabled?: boolean;
  /** Para colorear el botón (por ejemplo, el estado de un pedido). */
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const actual = opciones.find((o) => o.value === valor);
  return (
    <>
      <select id={id} tabIndex={-1} className="sr-only" value={valor} disabled={disabled} onChange={(e) => onCambio(e.target.value)}>
        {opciones.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={`${titulo}: ${actual?.label ?? valor}`}
        disabled={disabled}
        onClick={() => setAbierto(true)}
        style={{ borderColor: "var(--borde-control)" }}
        className={`flex min-h-12 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-base text-gray-900 hover:border-[#244B5A] disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-600 ${className}`}
      >
        <span className="min-w-0 break-words">{actual?.label ?? valor}</span>
        <svg className="h-5 w-5 shrink-0 text-[#244B5A]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
        </svg>
      </button>
      {abierto && (
        <SelectorHoja
          titulo={titulo}
          opciones={opciones}
          valor={valor}
          onElegir={(v) => {
            setAbierto(false);
            onCambio(v);
          }}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </>
  );
}
