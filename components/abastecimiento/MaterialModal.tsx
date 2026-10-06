"use client";

import { useState } from "react";
import { z } from "zod";
import { useZodForm } from "@/lib/forms/useZodForm";
import { MoneyField, NumberField, TextField, SelectField, CheckboxField } from "@/components/form";
import { eliminarMaterial, guardarMaterial } from "@/lib/abastecimiento";
import {
  APLICA,
  RUBROS_MATERIAL,
  TAMANOS,
  UNIDADES_MATERIAL,
  limpiarCantidades,
  type DatosMaterial,
  type Material,
} from "@/lib/domain/abastecimiento/material";
import type { Proveedor } from "@/lib/domain/abastecimiento/proveedor";
import { BotonesGuardar, ModalShell, ZonaEliminar } from "./modal-partes";

/** `cantidades` viaja como array en el orden de TAMANOS: un nombre de campo
 *  como "7x3.50" tiene un punto, y React Hook Form lo leería como una ruta. */
export const MaterialFormSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  proveedor_id: z.string(),
  unidad: z.string(),
  precio: z.number().nonnegative("El precio no puede ser negativo").nullable(),
  rubro: z.string(),
  aplica: z.string(),
  usd_ref: z.number().nonnegative("No puede ser negativo").nullable(),
  notas: z.string(),
  cantidades: z.array(z.number().nonnegative("No puede ser negativo").nullable()).length(TAMANOS.length),
  activo: z.boolean(),
});
export type MaterialForm = z.infer<typeof MaterialFormSchema>;

const vacio = (s: string) => s.trim() || null;

export function aDatosMaterial(f: MaterialForm): DatosMaterial {
  const porTamano: Record<string, number | null> = {};
  TAMANOS.forEach((t, i) => {
    porTamano[t] = f.cantidades[i] ?? null;
  });
  return {
    nombre: f.nombre.trim(),
    proveedor_id: vacio(f.proveedor_id),
    unidad: vacio(f.unidad),
    precio: f.precio,
    rubro: vacio(f.rubro),
    aplica: vacio(f.aplica),
    usd_ref: f.usd_ref,
    notas: vacio(f.notas),
    cantidades: limpiarCantidades(porTamano),
    activo: f.activo,
  };
}

function aFormulario(m: Material | null): MaterialForm {
  return {
    nombre: m?.nombre ?? "",
    proveedor_id: m?.proveedor_id ?? "",
    unidad: m?.unidad ?? "",
    precio: m?.precio ?? null,
    rubro: m?.rubro ?? "",
    aplica: m?.aplica ?? "",
    usd_ref: m?.usd_ref ?? null,
    notas: m?.notas ?? "",
    cantidades: TAMANOS.map((t) => m?.cantidades[t] ?? null),
    activo: m?.activo ?? true,
  };
}

/** Un valor que ya no está en las listas (dato viejo o cargado a mano) tiene
 *  que seguir apareciendo en el <select>: si no, al guardar se perdería. */
function opciones(base: readonly string[], actual: string | null | undefined, vacioLabel: string) {
  const lista = actual && !base.includes(actual) ? [...base, actual] : [...base];
  return [{ value: "", label: vacioLabel }, ...lista.map((v) => ({ value: v, label: v }))];
}

/**
 * Alta y edición de un material (artículo de compra). `material` null = alta.
 * En la edición viven "dar de baja" (apagar Activo) y "Eliminar".
 */
export function MaterialModal({
  material,
  proveedores,
  onClose,
  onGuardado,
  onEliminado,
}: {
  material: Material | null;
  proveedores: Proveedor[];
  onClose: () => void;
  onGuardado: (m: Material, alta: boolean) => void;
  onEliminado: (m: Material) => void;
}) {
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useZodForm(MaterialFormSchema, { defaultValues: aFormulario(material) });

  async function onSubmit(valores: MaterialForm) {
    setErrorGuardado(null);
    const { item, error } = await guardarMaterial(
      material?.id ?? null,
      aDatosMaterial(valores),
      material ? material.precio : undefined
    );
    if (error || !item) {
      setErrorGuardado(error ?? "No se pudo guardar el material.");
      return;
    }
    onGuardado(item, material === null);
  }

  async function eliminar(): Promise<string | null> {
    if (!material) return null;
    const { error } = await eliminarMaterial(material.id);
    if (error) return error;
    onEliminado(material);
    return null;
  }

  const opcionesProveedor = [
    { value: "", label: "Sin proveedor" },
    ...proveedores
      .filter((p) => p.activo || p.id === material?.proveedor_id)
      .map((p) => ({ value: p.id, label: p.activo ? p.nombre : `${p.nombre} (de baja)` })),
  ];

  return (
    <ModalShell
      titulo={material ? "Editar material" : "Agregar material"}
      subtitulo={material ? undefined : "Queda disponible para todo el equipo."}
      ancho="max-w-2xl"
      ocupado={isSubmitting}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <section className="space-y-4">
          <TextField register={register} errors={errors} name="nombre" label="Nombre" required autoFocus />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField register={register} errors={errors} name="proveedor_id" label="Proveedor" options={opcionesProveedor} />
            <SelectField
              register={register}
              errors={errors}
              name="rubro"
              label="Rubro"
              options={opciones(RUBROS_MATERIAL, material?.rubro, "Sin rubro")}
            />
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Precio</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <MoneyField control={control} name="precio" label="Precio" hint="Vacío = a confirmar" />
            <SelectField
              register={register}
              errors={errors}
              name="unidad"
              label="Unidad"
              options={opciones(UNIDADES_MATERIAL, material?.unidad, "Sin unidad")}
            />
            <NumberField control={control} name="usd_ref" label="USD de referencia" hint="Sólo si cotiza en dólares" />
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pedido</h3>
          <SelectField
            register={register}
            errors={errors}
            name="aplica"
            label="Cuándo se pide"
            hint="Siempre = va en todas las obras. Losetas / Deck = según el borde elegido. Luz = por cada luz."
            options={opciones(APLICA, material?.aplica, "Sin definir")}
          />
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Cantidad a pedir por tamaño de pileta</p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {TAMANOS.map((t, i) => (
                <NumberField key={t} control={control} name={`cantidades.${i}`} label={t} placeholder="—" />
              ))}
            </div>
          </div>
        </section>

        <TextField register={register} errors={errors} name="notas" label="Notas" multiline rows={2} />
        <CheckboxField
          register={register}
          errors={errors}
          name="activo"
          label="Activo"
          hint="Desactivalo para dar de baja el material sin perderlo."
        />

        {errorGuardado && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorGuardado}
          </p>
        )}

        <BotonesGuardar
          guardando={isSubmitting}
          etiqueta={material ? "Guardar cambios" : "Agregar material"}
          etiquetaGuardando={material ? "Guardando..." : "Agregando..."}
          onCancelar={onClose}
        />
      </form>

      {material && (
        <ZonaEliminar
          etiqueta="Eliminar material"
          titulo="¿Eliminar este material?"
          mensaje={`Se elimina "${material.nombre}" para todo el equipo y no se puede deshacer. Si sólo querés ocultarlo, desactivalo en lugar de eliminarlo.`}
          deshabilitado={isSubmitting}
          onEliminar={eliminar}
        />
      )}
    </ModalShell>
  );
}
