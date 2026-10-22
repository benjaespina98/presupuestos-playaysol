"use client";

import { useId, useState } from "react";
import { z } from "zod";
import { useZodForm } from "@/lib/forms/useZodForm";
import { TextField, CheckboxField } from "@/components/form";
import { guardarProveedor } from "@/lib/abastecimiento";
import type { DatosProveedor, Proveedor } from "@/lib/domain/abastecimiento/proveedor";
import { Hoja, PieAcciones } from "@/components/ui/Hoja";
import { formatFechaRelativa } from "@/lib/format/fecha";

/** Los opcionales viajan como string (un <input> no puede valer null); `aDatos`
 *  los vuelve null cuando quedan vacíos. */
export const ProveedorFormSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  rubro: z.string(),
  contacto: z.string(),
  telefono: z.string(),
  forma_pago: z.string(),
  plazo: z.string(),
  notas: z.string(),
  activo: z.boolean(),
});
export type ProveedorForm = z.infer<typeof ProveedorFormSchema>;

const vacio = (s: string) => s.trim() || null;

export function aDatosProveedor(f: ProveedorForm): DatosProveedor {
  return {
    nombre: f.nombre.trim(),
    rubro: vacio(f.rubro),
    contacto: vacio(f.contacto),
    telefono: vacio(f.telefono),
    forma_pago: vacio(f.forma_pago),
    plazo: vacio(f.plazo),
    notas: vacio(f.notas),
    activo: f.activo,
  };
}

function aFormulario(p: Proveedor | null): ProveedorForm {
  return {
    nombre: p?.nombre ?? "",
    rubro: p?.rubro ?? "",
    contacto: p?.contacto ?? "",
    telefono: p?.telefono ?? "",
    forma_pago: p?.forma_pago ?? "",
    plazo: p?.plazo ?? "",
    notas: p?.notas ?? "",
    activo: p?.activo ?? true,
  };
}

/**
 * Alta y edición de un proveedor, en una hoja. `proveedor` null = alta. En la edición vive también
 * "desactivar" (apagar Activo), separado al final. Los proveedores no se borran.
 *
 * Se monta con `key` desde la pantalla, así cada proveedor abre un form nuevo.
 */
export function ProveedorModal({
  proveedor,
  cantidadMateriales = 0,
  onClose,
  onGuardado,
}: {
  proveedor: Proveedor | null;
  /** Cuántos materiales le compra la empresa: se avisa al desactivarlo. */
  cantidadMateriales?: number;
  onClose: () => void;
  onGuardado: (p: Proveedor, alta: boolean) => void;
}) {
  const formId = useId();
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useZodForm(ProveedorFormSchema, { defaultValues: aFormulario(proveedor) });

  async function onSubmit(valores: ProveedorForm) {
    setErrorGuardado(null);
    const { item, error } = await guardarProveedor(proveedor?.id ?? null, aDatosProveedor(valores));
    if (error || !item) {
      // Se conserva lo cargado: el formulario no se desmonta.
      setErrorGuardado(error ?? "No se pudo guardar el proveedor.");
      return;
    }
    onGuardado(item, proveedor === null);
  }

  const sinMateriales =
    cantidadMateriales === 0
      ? ""
      : ` Sus ${cantidadMateriales} ${cantidadMateriales === 1 ? "material sigue" : "materiales siguen"} cargados, con este proveedor.`;
  const actualizado = proveedor?.updated_at ? formatFechaRelativa(proveedor.updated_at) : "";
  const masOpcionesConDatos = !!(proveedor && (proveedor.forma_pago || proveedor.plazo || proveedor.notas));

  return (
    <Hoja
      titulo={proveedor ? "Editar proveedor" : "Agregar proveedor"}
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
          etiqueta={proveedor ? "Guardar cambios" : "Agregar proveedor"}
          etiquetaGuardando={proveedor ? "Guardando..." : "Agregando..."}
        />
      }
    >
      <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <TextField register={register} errors={errors} name="nombre" label="Nombre" required autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <TextField register={register} errors={errors} name="rubro" label="Rubro" placeholder="Ej: Corralón" />
          <TextField register={register} errors={errors} name="telefono" label="Teléfono" type="tel" />
        </div>
        <TextField register={register} errors={errors} name="contacto" label="Contacto" placeholder="Persona de contacto" />

        <details open={masOpcionesConDatos} className="group rounded-xl border border-gray-200 bg-gray-50/60">
          <summary className="flex min-h-11 list-none items-center justify-between gap-2 rounded-xl px-4 text-sm font-semibold text-gray-700 hover:bg-gray-100/70 [&::-webkit-details-marker]:hidden">
            Más opciones
            <span aria-hidden="true" className="text-gray-400 transition-transform group-open:rotate-180">
              ▾
            </span>
          </summary>
          <div className="space-y-4 border-t border-gray-200 px-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <TextField register={register} errors={errors} name="forma_pago" label="Forma de pago" />
              <TextField register={register} errors={errors} name="plazo" label="Plazo de entrega" placeholder="Ej: 10-15 días" />
            </div>
            <TextField register={register} errors={errors} name="notas" label="Qué se le compra / notas" multiline rows={3} />
          </div>
        </details>

        <div className="rounded-xl border border-gray-200 px-4 py-1">
          <CheckboxField
            register={register}
            errors={errors}
            name="activo"
            label="Activo"
            hint="Desactivado: no aparece en pedidos nuevos; no se pierde."
          />
          {sinMateriales && <p className="pb-2 pl-14 text-xs text-gray-500">{sinMateriales.trim()}</p>}
        </div>

        {actualizado && <p className="text-xs text-gray-400">Actualizado {actualizado}</p>}
      </form>
    </Hoja>
  );
}
