"use client";

import type {
  FieldErrors,
  FieldPath,
  FieldValues,
  UseFormRegister,
} from "react-hook-form";
import { FieldShell, describedBy } from "./FieldShell";

const CLASE_BASE =
  "block w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 " +
  "focus:border-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/30 " +
  "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 " +
  "aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:ring-red-500/30";

/** Selector nativo (`<select>`), no un combobox custom: en mobile el nativo
 *  abre el picker del sistema operativo, que es más cómodo de tocar que
 *  cualquier lista que se pueda dibujar a mano. */
export function SelectField<TFieldValues extends FieldValues>({
  register,
  errors,
  name,
  label,
  hint,
  required,
  options,
  placeholder,
  className,
  ...rest
}: {
  register: UseFormRegister<TFieldValues>;
  errors: FieldErrors<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  hint?: string;
  required?: boolean;
  options: { value: string; label: string }[];
  /** Si se pasa, aparece como primera opción deshabilitada/vacía. */
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const error = errors[name]?.message as string | undefined;

  return (
    <FieldShell label={label} htmlFor={name} hint={hint} error={error} required={required}>
      <select
        id={name}
        aria-invalid={!!error}
        aria-describedby={describedBy(name, hint, error)}
        defaultValue=""
        className={className ? `${CLASE_BASE} ${className}` : CLASE_BASE}
        {...register(name)}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
