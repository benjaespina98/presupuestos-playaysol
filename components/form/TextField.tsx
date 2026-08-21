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
  "placeholder:text-gray-400 focus:border-[#1B3A5C] focus:outline-none focus:ring-2 " +
  "focus:ring-[#1B3A5C]/30 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 " +
  "aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:ring-red-500/30";

/**
 * Texto libre (descripciones, nombres, observaciones). A diferencia de
 * MoneyField/NumberField no necesita `useController`: no hay formato que
 * separar del dato, así que `register` de RHF alcanza y es más liviano.
 *
 * `multiline` cambia el elemento a `<textarea>` para las descripciones largas
 * del catálogo (algunas ocupan varias líneas) — mismo campo, mismo label y
 * mismo manejo de error que la versión de una línea, así que no vale la pena
 * un componente aparte solo por el tag del DOM.
 */
export function TextField<TFieldValues extends FieldValues>({
  register,
  errors,
  name,
  label,
  hint,
  required,
  type = "text",
  multiline = false,
  rows = 3,
  className,
  ...rest
}: {
  register: UseFormRegister<TFieldValues>;
  errors: FieldErrors<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  hint?: string;
  required?: boolean;
  type?: "text" | "email" | "tel" | "search";
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  const error = errors[name]?.message as string | undefined;
  const claseFinal = className ? `${CLASE_BASE} ${className}` : CLASE_BASE;

  return (
    <FieldShell label={label} htmlFor={name} hint={hint} error={error} required={required}>
      {multiline ? (
        <textarea
          id={name}
          rows={rows}
          aria-invalid={!!error}
          aria-describedby={describedBy(name, hint, error)}
          className={claseFinal}
          {...register(name)}
          {...rest}
        />
      ) : (
        <input
          id={name}
          type={type}
          aria-invalid={!!error}
          aria-describedby={describedBy(name, hint, error)}
          className={claseFinal}
          {...register(name)}
          {...rest}
        />
      )}
    </FieldShell>
  );
}
