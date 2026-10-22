"use client";

import { useRef, useState } from "react";
import type { FieldErrors, FieldPath, FieldValues, UseFormRegister } from "react-hook-form";
import { SelectorHoja, type OpcionSelector } from "@/components/ui/SelectorHoja";
import { FieldShell, describedBy } from "./FieldShell";

const CLASE_BOTON =
  "flex min-h-12 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-base text-gray-900 " +
  "hover:border-[#244B5A] focus-visible:border-[#244B5A] disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-600 " +
  "data-[invalid=true]:border-[#B42318]";

/**
 * Selector del portal: un botón que abre una lista propia (hoja inferior en el celular, con opciones de 48 px,
 * la actual con tilde y cierre al elegir; con buscador si hay más de 8). El nombre largo hace salto de línea,
 * no se corta.
 *
 * Por debajo sigue habiendo un `<select>` real (oculto) cableado a React Hook Form: es el que guarda el valor,
 * el que se asocia al label y el que usan los lectores de pantalla y los tests. La lista sólo cambia su valor y
 * avisa con un evento `change`.
 */
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
  disabled,
}: {
  register: UseFormRegister<TFieldValues>;
  errors: FieldErrors<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  hint?: string;
  required?: boolean;
  options: OpcionSelector[];
  /** Si se pasa, aparece como primera opción deshabilitada/vacía. */
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const error = errors[name]?.message as string | undefined;
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const [valor, setValor] = useState("");
  const [abierto, setAbierto] = useState(false);
  const reg = register(name);

  const elegida = options.find((o) => o.value === valor);
  const texto = elegida?.label ?? (valor === "" ? (placeholder ?? "Elegir…") : valor);

  function elegir(v: string) {
    const el = selectRef.current;
    setAbierto(false);
    if (!el) return;
    el.value = v;
    setValor(v);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  return (
    <FieldShell label={label} htmlFor={name} hint={hint} error={error} required={required}>
      <select
        id={name}
        tabIndex={-1}
        defaultValue=""
        className="sr-only"
        aria-invalid={!!error}
        aria-describedby={describedBy(name, hint, error)}
        disabled={disabled}
        {...reg}
        ref={(el) => {
          reg.ref(el);
          selectRef.current = el;
          if (el) setValor(el.value);
        }}
        onChange={(e) => {
          setValor(e.target.value);
          return reg.onChange(e);
        }}
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
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={`${label}: ${texto}`}
        data-invalid={!!error}
        disabled={disabled}
        onClick={() => setAbierto(true)}
        className={className ? `${CLASE_BOTON} ${className}` : CLASE_BOTON}
        style={error ? undefined : { borderColor: "var(--borde-control)" }}
      >
        <span className="min-w-0 break-words">{texto}</span>
        <svg className="h-5 w-5 shrink-0 text-[#244B5A]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
        </svg>
      </button>
      {abierto && (
        <SelectorHoja
          titulo={label}
          opciones={options.filter((o) => !(placeholder && o.value === ""))}
          valor={valor}
          onElegir={elegir}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </FieldShell>
  );
}
