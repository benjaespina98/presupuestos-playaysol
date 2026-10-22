"use client";

import { useId, useState } from "react";
import { z } from "zod";
import { useZodForm } from "@/lib/forms/useZodForm";
import { TextField, CheckboxField } from "@/components/form";
import { guardarProveedor } from "@/lib/abastecimiento";
import type { DatosProveedor, Proveedor } from "@/lib/domain/abastecimiento/proveedor";
import { Hoja, PieAcciones } from "@/components/ui/Hoja";
import { Seccion, SeccionPlegable, ZonaActivo } from "@/components/ui/SeccionForm";
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

  return (
    <Hoja
      titulo={proveedor ? "Editar proveedor" : "Agregar proveedor"}
      subtitulo={proveedor?.nombre}
      ocupado={isSubmitting}
      hayCambios={isDirty}
      ancho="lg"
      alto="completo"
      onCerrar={onClose}
      aviso={
        errorGuardado ? (
          <p role="alert" className="rounded-lg border border-[#FDA29B] bg-[#FEF3F2] px-3 py-2 text-[15px] font-medium text-[#B42318]">
            No se guardó: {errorGuardado} Lo que cargaste sigue acá.
          </p>
        ) : undefined
      }
      pie={
        <PieAcciones
          formId={formId}
          guardando={isSubmitting}
          soloConCambios={proveedor !== null}
          etiqueta={proveedor ? "Guardar cambios" : "Agregar proveedor"}
          etiquetaGuardando={proveedor ? "Guardando..." : "Agregando..."}
        />
      }
    >
      <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <Seccion titulo="Datos">
          <TextField register={register} errors={errors} name="nombre" label="Nombre" required autoFocus />
          <TextField register={register} errors={errors} name="rubro" label="Rubro" placeholder="Ej: Corralón" />
        </Seccion>

        <Seccion titulo="Contacto">
          <TextField register={register} errors={errors} name="contacto" label="Persona de contacto" />
          <TextField register={register} errors={errors} name="telefono" label="Teléfono" type="tel" hint="Si hay más de uno, separalos con /" />
        </Seccion>

        <Seccion titulo="Condiciones">
          <TextField register={register} errors={errors} name="forma_pago" label="Forma de pago" />
          <TextField register={register} errors={errors} name="plazo" label="Plazo de entrega" placeholder="Ej: 10-15 días" />
        </Seccion>

        <SeccionPlegable titulo="Notas" abierta={!!proveedor?.notas}>
          <TextField register={register} errors={errors} name="notas" label="Qué se le compra / notas" multiline rows={3} />
        </SeccionPlegable>

        <ZonaActivo>
          <CheckboxField register={register} errors={errors} name="activo" label="Activo" hint="Si lo desactivás, no aparece en pedidos nuevos; no se pierde." />
          {sinMateriales && <p className="pb-2 pl-14 text-[13px] leading-snug text-[#4A5861]">{sinMateriales.trim()}</p>}
        </ZonaActivo>

        {actualizado && <p className="text-[13px] text-[#4A5861]">Actualizado {actualizado}</p>}
      </form>
    </Hoja>
  );
}
