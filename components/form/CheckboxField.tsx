"use client";

import type {
  FieldErrors,
  FieldPath,
  FieldValues,
  UseFormRegister,
} from "react-hook-form";

/**
 * Checkbox binario con pinta de switch — es lo que este dominio usa para "la
 * línea informativa está incluida en este presupuesto" (ver NaturalezaLinea en
 * lib/domain/precios/tipos.ts): una decisión de sí/no, no una lista de
 * opciones, así que un switch comunica mejor que una casilla cuadrada.
 *
 * Es un solo componente para las dos formas del bullet "checkbox/switch" del
 * plan de Fase 3: semánticamente es `<input type="checkbox">` (por eso
 * `role="switch"` alcanza sin reinventar nada), visualmente es un switch.
 */
export function CheckboxField<TFieldValues extends FieldValues>({
  register,
  errors,
  name,
  label,
  hint,
}: {
  register: UseFormRegister<TFieldValues>;
  errors: FieldErrors<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  hint?: string;
}) {
  const error = errors[name]?.message as string | undefined;
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = error ? `${name}-error` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="flex min-h-11 cursor-pointer items-center gap-3">
        <input
          id={name}
          type="checkbox"
          role="switch"
          aria-invalid={!!error}
          aria-describedby={errorId ?? hintId}
          className="peer sr-only"
          {...register(name)}
        />
        <span
          aria-hidden="true"
          className="relative h-6 w-11 shrink-0 rounded-full bg-gray-300 transition-colors
            peer-checked:bg-[#1B3A5C] peer-focus-visible:outline peer-focus-visible:outline-2
            peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#1B3A5C]
            before:absolute before:top-0.5 before:left-0.5 before:h-5 before:w-5 before:rounded-full
            before:bg-white before:transition-transform before:content-[''] peer-checked:before:translate-x-5"
        />
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </label>
      {hint && !error && (
        <p id={hintId} className="pl-14 text-xs text-gray-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="pl-14 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
