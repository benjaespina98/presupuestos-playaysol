"use client";

import { useState } from "react";
import { useZodForm } from "@/lib/forms/useZodForm";
import { MoneyField, TextField, SelectField, CheckboxField } from "@/components/form";
import { crearItemCatalogo } from "@/lib/catalogo";
import { CATEGORIAS, UNIDADES } from "@/lib/domain/catalogo/categorias";
import type { ItemCatalogo } from "@/lib/domain/catalogo/item";
import { NuevoItemSchema, nuevoItemFormVacio, aNuevoItem, type NuevoItemForm } from "./nuevo-item.schema";
import { TITULOS_TIPO } from "./titulos-tipo";

const OPCIONES_TIPO = (Object.keys(TITULOS_TIPO) as (keyof typeof TITULOS_TIPO)[]).map((tipo) => ({
  value: tipo,
  label: TITULOS_TIPO[tipo],
}));

const OPCIONES_CATEGORIA = [
  { value: "", label: "Sin clasificar" },
  ...CATEGORIAS.map((c) => ({ value: c, label: c })),
];

const OPCIONES_UNIDAD = [
  { value: "", label: "Sin unidad" },
  ...UNIDADES.map((u) => ({ value: u, label: u })),
];

/**
 * Alta de un ítem nuevo del catálogo — antes esta pantalla sólo dejaba
 * editar lo que ya existía (via seed/migración/`actualizarCatalogoItem`
 * cableado a mano); no había forma de cargar un producto/opcional nuevo
 * desde la propia UI.
 *
 * Misma estructura visual que EditarItemModal.tsx, pero con `tipo`/`clave`
 * (acá SÍ se cargan: recién se están definiendo, no son la identidad de una
 * fila existente todavía — ver el comentario de `CambiosItemCatalogo` en
 * lib/catalogo.ts).
 */
export function CrearItemModal({
  onClose,
  onCreado,
}: {
  onClose: () => void;
  onCreado: (item: ItemCatalogo) => void;
}) {
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useZodForm(NuevoItemSchema, { defaultValues: nuevoItemFormVacio() });

  async function onSubmit(valores: NuevoItemForm) {
    setErrorGuardado(null);
    const nuevo = aNuevoItem(valores);
    if (!nuevo) {
      setError("clave", { message: "Ingresá al menos una letra o un número" });
      return;
    }
    const { item, error } = await crearItemCatalogo(nuevo);
    if (error || !item) {
      setErrorGuardado(error ?? "No se pudo crear el ítem.");
      return;
    }
    onCreado(item);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1B3A5C]/45 p-4"
      onClick={isSubmitting ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="crear-item-titulo"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="crear-item-titulo" className="mb-1 text-base font-bold text-[#1B3A5C]">
          Nuevo ítem del catálogo
        </h2>
        <p className="mb-4 text-xs text-gray-500">
          Queda disponible para todo el equipo en la calculadora que elijas.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <SelectField register={register} errors={errors} name="tipo" label="Calculadora" options={OPCIONES_TIPO} />
          <TextField
            register={register}
            errors={errors}
            name="clave"
            label="Clave"
            placeholder="Ej: cerco_reforzado"
            hint="Identificador interno, sin espacios ni tildes — se normaliza solo al guardar."
            autoFocus
          />
          <TextField
            register={register}
            errors={errors}
            name="descripcion"
            label="Descripción"
            multiline
            rows={3}
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
          <CheckboxField register={register} errors={errors} name="activo" label="Activo" />

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
              {isSubmitting ? "Creando..." : "Crear ítem"}
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
