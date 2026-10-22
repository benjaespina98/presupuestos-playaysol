"use client";

import type {
  FieldErrors,
  FieldPath,
  FieldValues,
  UseFormRegister,
} from "react-hook-form";
import { FieldShell, describedBy } from "./FieldShell";

const CLASE_BASE =
  "block min-h-12 w-full rounded-lg border border-gray-300 bg-[#FFFFFF] px-3 py-2.5 text-base text-gray-900 hover:border-gray-400 " +
  "placeholder:text-[#6B7680] focus:border-[#244B5A] focus:outline-none focus:ring-2 " +
  "focus:ring-celeste/40 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 " +
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
  autoComplete?: string;
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
