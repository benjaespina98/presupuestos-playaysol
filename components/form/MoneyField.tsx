"use client";

import { useController, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { FieldShell, describedBy } from "./FieldShell";
import { MoneyInput, type MoneyInputProps } from "./MoneyInput";

/**
 * MoneyInput cableado a React Hook Form. Es la pieza que van a usar los
 * formularios de la Fase 4 — MoneyInput en sí queda libre para casos sueltos.
 *
 * `useController` (no `register`) porque el valor real es `number | null`, no
 * el string del input: RHF necesita que alguien le arme ese puente, y ese
 * "alguien" es este componente, no cada pantalla que lo use.
 */
export function MoneyField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  hint,
  required,
  emptyValue,
  ...rest
}: {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  hint?: string;
  required?: boolean;
} & Omit<
  MoneyInputProps,
  "value" | "onValueChange" | "onBlur" | "name" | "id" | "aria-invalid" | "aria-describedby"
>) {
  const {
    field: { ref: campoRef, name: campoNombre, value: campoValor, onChange, onBlur },
    fieldState,
  } = useController({ control, name });

  return (
    <FieldShell label={label} htmlFor={name} hint={hint} error={fieldState.error?.message} required={required}>
      <MoneyInput
        id={name}
        name={campoNombre}
        value={(campoValor as number | null) ?? null}
        onValueChange={onChange}
        onBlur={onBlur}
        emptyValue={emptyValue}
        aria-invalid={!!fieldState.error}
        aria-describedby={describedBy(name, hint, fieldState.error?.message)}
        ref={campoRef}
        {...rest}
      />
    </FieldShell>
  );
}
