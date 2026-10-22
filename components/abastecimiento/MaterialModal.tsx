"use client";

import { useId, useState } from "react";
import { z } from "zod";
import { useZodForm } from "@/lib/forms/useZodForm";
import { MoneyField, NumberField, TextField, SelectField, CheckboxField } from "@/components/form";
import { guardarMaterial } from "@/lib/abastecimiento";
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
import { Hoja, PieAcciones } from "@/components/ui/Hoja";
import { formatFechaRelativa } from "@/lib/format/fecha";

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
    // Un USD de referencia de 0 no existe: es "sin cotización en dólares". Guardarlo en 0 hacía que la
    // planilla mostrara $0 (USD × tipo de cambio) en vez del precio en pesos.
    usd_ref: f.usd_ref !== null && f.usd_ref > 0 ? f.usd_ref : null,
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
 * Lo esencial va a la vista (nombre, proveedor, rubro, precio, unidad); el resto, en "Más opciones".
 * En la edición vive "desactivar" (apagar Activo), separado al final. Los materiales no se borran.
 */
export function MaterialModal({
  material,
  proveedores,
  onClose,
  onGuardado,
}: {
  material: Material | null;
  proveedores: Proveedor[];
  onClose: () => void;
  onGuardado: (m: Material, alta: boolean) => void;
}) {
  const formId = useId();
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useZodForm(MaterialFormSchema, { defaultValues: aFormulario(material) });

  async function onSubmit(valores: MaterialForm) {
    setErrorGuardado(null);
    const { item, error } = await guardarMaterial(
      material?.id ?? null,
      aDatosMaterial(valores),
      material ? material.precio : undefined
    );
    if (error || !item) {
      // Se conserva lo cargado: el formulario no se desmonta.
      setErrorGuardado(error ?? "No se pudo guardar el material.");
      return;
    }
    onGuardado(item, material === null);
  }

  const opcionesProveedor = [
    { value: "", label: "Sin proveedor" },
    ...proveedores
      .filter((p) => p.activo || p.id === material?.proveedor_id)
      .map((p) => ({ value: p.id, label: p.activo ? p.nombre : `${p.nombre} (desactivado)` })),
  ];

  // Si lo que está en "Más opciones" ya tiene datos, se abre solo para que no quede escondido.
  const masOpcionesConDatos = !!(material && (material.usd_ref || material.notas || (material.aplica && material.aplica !== "Siempre")));
  const actualizado = material?.updated_at ? formatFechaRelativa(material.updated_at) : "";

  return (
    <Hoja
      titulo={material ? "Editar material" : "Agregar material"}
      ocupado={isSubmitting}
      hayCambios={isDirty}
      ancho="lg"
      onCerrar={onClose}
      aviso={
        errorGuardado ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorGuardado}
          </p>
        ) : undefined
      }
      pie={
        <PieAcciones
          formId={formId}
          guardando={isSubmitting}
          etiqueta={material ? "Guardar cambios" : "Agregar material"}
          etiquetaGuardando={material ? "Guardando..." : "Agregando..."}
        />
      }
    >
      <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <TextField register={register} errors={errors} name="nombre" label="Nombre" required autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <SelectField register={register} errors={errors} name="proveedor_id" label="Proveedor" options={opcionesProveedor} />
          <SelectField register={register} errors={errors} name="rubro" label="Rubro" options={opciones(RUBROS_MATERIAL, material?.rubro, "Sin rubro")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MoneyField control={control} name="precio" label="Precio" hint="Vacío = a confirmar" />
          <SelectField register={register} errors={errors} name="unidad" label="Unidad" options={opciones(UNIDADES_MATERIAL, material?.unidad, "Sin unidad")} />
        </div>

        <details open={masOpcionesConDatos} className="group rounded-xl border border-gray-200 bg-gray-50/60">
          <summary className="flex min-h-11 list-none items-center justify-between gap-2 rounded-xl px-4 text-sm font-semibold text-gray-700 hover:bg-gray-100/70 [&::-webkit-details-marker]:hidden">
            Más opciones
            <span aria-hidden="true" className="text-gray-400 transition-transform group-open:rotate-180">
              ▾
            </span>
          </summary>
          <div className="space-y-4 border-t border-gray-200 px-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <NumberField control={control} name="usd_ref" label="USD de referencia" hint="Si cotiza en dólares" emptyValue="null" />
              <SelectField
                register={register}
                errors={errors}
                name="aplica"
                label="Cuándo se pide"
                hint="Siempre, por borde o por luz"
                options={opciones(APLICA, material?.aplica, "Sin definir")}
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">Cantidad a pedir por tamaño de pileta</p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {TAMANOS.map((t, i) => (
                  <NumberField key={t} control={control} name={`cantidades.${i}`} label={t} placeholder="—" emptyValue="null" />
                ))}
              </div>
            </div>
            <TextField register={register} errors={errors} name="notas" label="Notas" multiline rows={2} />
          </div>
        </details>

        <div className="rounded-xl border border-gray-200 px-4 py-1">
          <CheckboxField
            register={register}
            errors={errors}
            name="activo"
            label="Activo"
            hint="Desactivado: sale de los pedidos nuevos; no se pierde."
          />
        </div>

        {actualizado && <p className="text-xs text-gray-400">Actualizado {actualizado}</p>}
      </form>
    </Hoja>
  );
}
