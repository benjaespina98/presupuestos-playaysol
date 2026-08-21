"use client";

import { useController, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { FieldShell, describedBy } from "./FieldShell";
import { NumberInput, type NumberInputProps } from "./NumberInput";

/** NumberInput cableado a React Hook Form. Ver MoneyField: mismo motivo para
 *  usar `useController` en vez de `register`. */
export function NumberField<TFieldValues extends FieldValues>({
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
  NumberInputProps,
  "value" | "onValueChange" | "onBlur" | "name" | "id" | "aria-invalid" | "aria-describedby"
>) {
  const {
    field: { ref: campoRef, name: campoNombre, value: campoValor, onChange, onBlur },
    fieldState,
  } = useController({ control, name });

  return (
    <FieldShell label={label} htmlFor={name} hint={hint} error={fieldState.error?.message} required={required}>
      <NumberInput
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
