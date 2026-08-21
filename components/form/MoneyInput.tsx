"use client";

import { forwardRef } from "react";
import { formatARS, parseARS } from "@/lib/format/ars";
import { useMaskedNumberInput } from "./useMaskedNumberInput";

/**
 * Campo de importe: separa el número (lo que se guarda) de "$ 1.500.000" (lo
 * que se ve). Es un componente controlado y agnóstico de React Hook Form a
 * propósito — el pegamento con RHF vive en MoneyField, así que esto también
 * sirve suelto (filtros, un total editable fuera de un form, etc.).
 *
 * El parseo/formateo usa `parseARS`/`formatARS` de lib/format/ars — no hay
 * ninguna lógica de números acá adentro, solo el manejo de foco/cursor que le
 * corresponde a un input y no a una función pura.
 */
export interface MoneyInputProps {
  value: number | null;
  onValueChange: (value: number | null) => void;
  onBlur?: () => void;
  id?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  /** "null" (default): vacío es "a cotizar", como un precio. "zero": vacío es
   *  0, para un importe que siempre tiene que sumar algo. */
  emptyValue?: "null" | "zero";
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  className?: string;
}

const CLASE_BASE =
  "block w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 " +
  "placeholder:text-gray-400 focus:border-[#1B3A5C] focus:outline-none focus:ring-2 " +
  "focus:ring-[#1B3A5C]/30 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 " +
  "aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:ring-red-500/30";

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { value, onValueChange, onBlur, emptyValue = "null", placeholder = "$ 0", className, ...rest },
  ref
) {
  const { texto, handleChange, handleFocus, handleBlur } = useMaskedNumberInput({
    value,
    onValueChange,
    format: formatARS,
    parse: parseARS,
    emptyValue,
  });

  return (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      value={texto}
      onChange={(e) => handleChange(e.target.value)}
      onFocus={handleFocus}
      onBlur={() => {
        handleBlur();
        onBlur?.();
      }}
      className={className ? `${CLASE_BASE} ${className}` : CLASE_BASE}
      {...rest}
    />
  );
});
