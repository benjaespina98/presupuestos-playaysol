"use client";

import { useState } from "react";
import { useZodForm } from "@/lib/forms/useZodForm";
import { MoneyField, TextField, SelectField, CheckboxField } from "@/components/form";
import { actualizarItemCatalogo } from "@/lib/catalogo";
import { CATEGORIAS } from "@/lib/domain/catalogo/categorias";
import { UNIDADES } from "@/lib/domain/catalogo/categorias";
import type { ItemCatalogo } from "@/lib/domain/catalogo/item";
import type { TipoCalculadora } from "@/lib/presupuestos";
import { aCambios, aFormulario, EditarItemSchema, type EditarItemForm } from "./editar-item.schema";

const TITULOS_TIPO: Record<TipoCalculadora, string> = {
  piscinas: "Piscinas",
  cercos: "Cercos",
  cobertores: "Cobertores",
  losetas: "Plano de Piscina",
  revestimientos: "Revestimientos",
};

const OPCIONES_CATEGORIA = [
  { value: "", label: "Sin clasificar" },
  ...CATEGORIAS.map((c) => ({ value: c, label: c })),
];

const OPCIONES_UNIDAD = [
  { value: "", label: "Sin unidad" },
  ...UNIDADES.map((u) => ({ value: u, label: u })),
];

/**
 * Formulario de edición de un ítem existente del catálogo, en un modal.
 *
 * Se monta con `key={item.id}` desde la pantalla que lo usa (ver
 * app/dashboard/catalogo/page.tsx): así cada ítem abre una instancia de form
 * nueva con sus propios `defaultValues`, sin necesitar `reset()` ni un efecto
 * para sincronizar — al cambiar de ítem, React desmonta y monta de nuevo.
 */
export function EditarItemModal({
  item,
  onClose,
  onGuardado,
}: {
  item: ItemCatalogo;
  onClose: () => void;
  onGuardado: (item: ItemCatalogo) => void;
}) {
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useZodForm(EditarItemSchema, { defaultValues: aFormulario(item) });

  async function onSubmit(valores: EditarItemForm) {
    setErrorGuardado(null);
    const cambios = aCambios(valores);
    const { error } = await actualizarItemCatalogo(item.id, cambios);
    if (error) {
      setErrorGuardado(error);
      return;
    }
    onGuardado({ ...item, ...cambios });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1B3A5C]/45 p-4"
      onClick={isSubmitting ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="editar-item-titulo"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="editar-item-titulo" className="mb-1 text-base font-bold text-[#1B3A5C]">
          Editar ítem
        </h2>
        <p className="mb-4 text-xs text-gray-500">
          {item.clave} · {TITULOS_TIPO[item.tipo]}
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <TextField
            register={register}
            errors={errors}
            name="descripcion"
            label="Descripción"
            multiline
            rows={3}
            autoFocus
          />
          <MoneyField
            control={control}
            name="precio"
            label="Precio"
            hint="Vacío = a cotizar (sin precio fijo)"
          />
          <SelectField
            register={register}
            errors={errors}
            name="categoria"
            label="Categoría"
            options={OPCIONES_CATEGORIA}
          />
          <SelectField
            register={register}
            errors={errors}
            name="unidad"
            label="Unidad"
            options={OPCIONES_UNIDAD}
          />
          <CheckboxField
            register={register}
            errors={errors}
            name="activo"
            label="Activo"
            hint="Si está apagado, no aparece en el listado del catálogo (no afecta las calculadoras)."
          />

          {errorGuardado && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorGuardado}
            </p>
          )}

          <div className="flex flex-col gap-2 pt-2 sm:flex-row-reverse">
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-11 w-full rounded-md bg-[#1B3A5C] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#142c46] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B3A5C] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
            >
              {isSubmitting ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-11 w-full rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
