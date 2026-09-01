"use client";

import type { FieldPath, FieldValues, UseFormRegister } from "react-hook-form";

/**
 * Elegir qué banner de marca lleva el documento — teal (el de siempre) o
 * navy (el Azul Institucional oficial, RGB 36,75,90). Antes esto estaba
 * cableado en duro a "teal" en las 4 calculadoras tradicionales
 * (`variacionEncabezado: "teal"` al armar el snapshot): el dato y el motor
 * de documento (HEADER_VARIANTS en cada Documento*.tsx / docx.ts / bloques.ts)
 * ya sabían mostrar cualquiera de las dos, sólo faltaba dejar elegir.
 *
 * Radios nativos (no un <select>): son 2 opciones fijas que conviene ver
 * las dos a la vez con su color real, no esconder una atrás de un picker —
 * mismo criterio que el switch de CheckboxField, adaptado a "elegí una de
 * dos tarjetas" en vez de "sí/no". Las miniaturas son el banner real
 * (recortado con `object-cover` a una tira angosta) para que el vendedor
 * vea el logo, no un swatch de color abstracto.
 */
const OPCIONES = [
  { value: "teal", label: "Teal", img: "/header-teal.png" },
  { value: "navy", label: "Navy institucional", img: "/header-navy.png" },
] as const;

export function VarianteEncabezadoField<TFieldValues extends FieldValues>({
  register,
  name,
}: {
  register: UseFormRegister<TFieldValues>;
  name: FieldPath<TFieldValues>;
}) {
  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-gray-700">Logo del presupuesto</span>
      <div role="radiogroup" aria-label="Logo del presupuesto" className="grid grid-cols-2 gap-2">
        {OPCIONES.map((op) => (
          <label
            key={op.value}
            className="flex min-h-11 cursor-pointer flex-col overflow-hidden rounded-md border border-gray-300 has-[:checked]:border-[#1B3A5C] has-[:checked]:ring-2 has-[:checked]:ring-[#1B3A5C]/30"
          >
            <input type="radio" value={op.value} className="peer sr-only" {...register(name)} />
            {/* eslint-disable-next-line @next/next/no-img-element -- miniatura del banner real, no la app */}
            <img src={op.img} alt="" aria-hidden="true" className="h-8 w-full object-cover" />
            <span className="px-2 py-1.5 text-center text-xs font-medium text-gray-700 peer-checked:text-[#1B3A5C]">
              {op.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
