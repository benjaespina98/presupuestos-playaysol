"use client";

import { forwardRef } from "react";
import { formatNumero, parseARS } from "@/lib/format/ars";
import { useMaskedNumberInput } from "./useMaskedNumberInput";

/**
 * Campo numérico sin símbolo de moneda: metros, m², cantidades. Mismo motor
 * que MoneyInput (comparten `useMaskedNumberInput`) pero con `formatNumero`
 * en vez de `formatARS` y, a diferencia de un precio, vacío es 0 por default
 * — así se comportan las medidas hoy (`parseARSOCero` en el legacy): un campo
 * de metros en blanco es "no hay nada cargado ahí", no "a cotizar".
 */
export interface NumberInputProps {
  value: number | null;
  onValueChange: (value: number | null) => void;
  onBlur?: () => void;
  id?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  /** default "zero": una medida vacía es 0. Pasar "null" para un numérico que
   *  sí distingue "sin cargar" de cero (poco común, pero existe). */
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

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  { value, onValueChange, onBlur, emptyValue = "zero", placeholder = "0", className, ...rest },
  ref
) {
  const { texto, handleChange, handleFocus, handleBlur } = useMaskedNumberInput({
    value,
    onValueChange,
    format: formatNumero,
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
