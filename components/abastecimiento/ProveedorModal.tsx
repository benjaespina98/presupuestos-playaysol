"use client";

import { useState } from "react";
import { z } from "zod";
import { useZodForm } from "@/lib/forms/useZodForm";
import { TextField, CheckboxField } from "@/components/form";
import { eliminarProveedor, guardarProveedor } from "@/lib/abastecimiento";
import type { DatosProveedor, Proveedor } from "@/lib/domain/abastecimiento/proveedor";
import { BotonesGuardar, ModalShell, ZonaEliminar } from "./modal-partes";

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
 * Alta y edición de un proveedor, en un modal. `proveedor` null = alta. En la
 * edición viven también "dar de baja" (apagar Activo) y "Eliminar": igual que
 * en el catálogo de precios, el listado sólo tiene Editar.
 *
 * Se monta con `key` desde la pantalla, así cada proveedor abre un form nuevo.
 */
export function ProveedorModal({
  proveedor,
  cantidadMateriales = 0,
  onClose,
  onGuardado,
  onEliminado,
}: {
  proveedor: Proveedor | null;
  /** Cuántos materiales le compra la empresa: se avisa antes de eliminar. */
  cantidadMateriales?: number;
  onClose: () => void;
  onGuardado: (p: Proveedor, alta: boolean) => void;
  onEliminado: (p: Proveedor) => void;
}) {
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useZodForm(ProveedorFormSchema, { defaultValues: aFormulario(proveedor) });

  async function onSubmit(valores: ProveedorForm) {
    setErrorGuardado(null);
    const { item, error } = await guardarProveedor(proveedor?.id ?? null, aDatosProveedor(valores));
    if (error || !item) {
      setErrorGuardado(error ?? "No se pudo guardar el proveedor.");
      return;
    }
    onGuardado(item, proveedor === null);
  }

  async function eliminar(): Promise<string | null> {
    if (!proveedor) return null;
    const { error } = await eliminarProveedor(proveedor.id);
    if (error) return error;
    onEliminado(proveedor);
    return null;
  }

  const sinMateriales =
    cantidadMateriales === 0
      ? ""
      : ` Sus ${cantidadMateriales} ${cantidadMateriales === 1 ? "material queda" : "materiales quedan"} sin proveedor.`;

  return (
    <ModalShell
      titulo={proveedor ? "Editar proveedor" : "Agregar proveedor"}
      subtitulo={proveedor ? undefined : "Queda disponible para todo el equipo al cargar materiales."}
      ocupado={isSubmitting}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <TextField register={register} errors={errors} name="nombre" label="Nombre" required autoFocus />
        <TextField register={register} errors={errors} name="rubro" label="Rubro" placeholder="Ej: Corralón, Equipos de filtrado" />
        <TextField register={register} errors={errors} name="contacto" label="Contacto" placeholder="Persona de contacto" />
        <TextField register={register} errors={errors} name="telefono" label="Teléfono" type="tel" />
        <TextField register={register} errors={errors} name="forma_pago" label="Forma de pago" />
        <TextField register={register} errors={errors} name="plazo" label="Plazo de entrega" placeholder="Ej: 10-15 días" />
        <TextField register={register} errors={errors} name="notas" label="Qué se le compra / notas" multiline rows={3} />
        <CheckboxField
          register={register}
          errors={errors}
          name="activo"
          label="Activo"
          hint="Desactivalo para dar de baja al proveedor sin perderlo: deja de ofrecerse al cargar materiales nuevos."
        />

        {errorGuardado && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorGuardado}
          </p>
        )}

        <BotonesGuardar
          guardando={isSubmitting}
          etiqueta={proveedor ? "Guardar cambios" : "Agregar proveedor"}
          etiquetaGuardando={proveedor ? "Guardando..." : "Agregando..."}
          onCancelar={onClose}
        />
      </form>

      {proveedor && (
        <ZonaEliminar
          etiqueta="Eliminar proveedor"
          titulo="¿Eliminar este proveedor?"
          mensaje={`Se elimina "${proveedor.nombre}" para todo el equipo y no se puede deshacer.${sinMateriales} Si sólo querés ocultarlo, desactivalo en lugar de eliminarlo.`}
          deshabilitado={isSubmitting}
          onEliminar={eliminar}
        />
      )}
    </ModalShell>
  );
}
