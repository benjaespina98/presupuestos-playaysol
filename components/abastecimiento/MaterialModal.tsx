"use client";

import { useId, useState } from "react";
import { useController, useWatch, type Control } from "react-hook-form";
import { z } from "zod";
import { useZodForm } from "@/lib/forms/useZodForm";
import { MoneyField, NumberField, NumberInput, TextField, SelectField, CheckboxField, FieldShell } from "@/components/form";
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
import { Seccion, SeccionPlegable, ZonaActivo, InfoPopover } from "@/components/ui/SeccionForm";
import type { OpcionSelector } from "@/components/ui/SelectorHoja";
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
 *  que seguir apareciendo en el selector: si no, al guardar se perdería. */
function opciones(base: readonly string[], actual: string | null | undefined, vacioLabel: string): OpcionSelector[] {
  const lista = actual && !base.includes(actual) ? [...base, actual] : [...base];
  return [{ value: "", label: vacioLabel }, ...lista.map((v) => ({ value: v, label: v }))];
}

/**
 * "Cuándo se pide": los textos que se ven. Los VALORES (lo que se guarda y lo que usa el cálculo del pedido,
 * `factorDeAplica` en lib/domain/abastecimiento/pedido.ts) no cambian:
 *   Siempre → va en todas las obras · Losetas / Deck → sólo si el borde es ese · Luz → una por cada luz (se multiplica
 *   por la cantidad de luces) · Luz (fija) → una sola vez si hay al menos una luz · Luz cama de agua → sólo si se
 *   eligió esa luz · Baño químico → sólo si se eligió. Cualquier otro valor (o vacío) se comporta como "Siempre".
 */
const TEXTOS_APLICA: Record<(typeof APLICA)[number], { label: string; descripcion: string }> = {
  Siempre: { label: "Siempre", descripcion: "Va en todas las obras" },
  Losetas: { label: "Losetas", descripcion: "Solo si el borde es de losetas" },
  Deck: { label: "Deck", descripcion: "Solo si el borde es de deck" },
  Luz: { label: "Por luz", descripcion: "Se multiplica por la cantidad de luces" },
  "Luz (fija)": { label: "Una vez si hay luces", descripcion: "Una sola, si el pedido lleva luces" },
  "Luz cama de agua": { label: "Luz de cama de agua", descripcion: "Solo si se elige esa luz" },
  "Baño químico": { label: "Baño químico", descripcion: "Solo si el pedido lleva baño químico" },
};

export function opcionesAplica(actual: string | null | undefined): OpcionSelector[] {
  const lista: OpcionSelector[] = APLICA.map((v) => ({ value: v, label: TEXTOS_APLICA[v].label, descripcion: TEXTOS_APLICA[v].descripcion }));
  if (actual && !(APLICA as readonly string[]).includes(actual)) lista.push({ value: actual, label: actual, descripcion: "Valor cargado a mano" });
  return [{ value: "", label: "Sin definir", descripcion: "Se pide en todas las obras, como “Siempre”" }, ...lista];
}

/** Un campo de cantidad por tamaño: grande, con la unidad adentro, "No pide" si está vacío y resaltado si cambió. */
function CampoCantidad({
  control,
  indice,
  tamano,
  unidad,
  original,
}: {
  control: Control<MaterialForm>;
  indice: number;
  tamano: string;
  unidad: string;
  original: number | null;
}) {
  const name = `cantidades.${indice}` as const;
  const {
    field: { ref, value, onChange, onBlur, name: nombre },
    fieldState,
  } = useController({ control, name });
  const actual = (value as number | null) ?? null;
  const cambiado = (actual ?? null) !== (original ?? null);
  return (
    <FieldShell label={tamano} htmlFor={name} error={fieldState.error?.message}>
      <div className="relative" data-cambiado={cambiado ? "true" : undefined}>
        <NumberInput
          id={name}
          name={nombre}
          ref={ref}
          value={actual}
          onValueChange={onChange}
          onBlur={onBlur}
          emptyValue="null"
          placeholder="No pide"
          aria-invalid={!!fieldState.error}
          className={unidad ? "pr-12" : undefined}
        />
        {unidad && actual !== null && (
          <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-[#4A5861]">
            {unidad}
          </span>
        )}
        {cambiado && (
          <span
            aria-hidden="true"
            title="Cambiado: todavía no se guardó"
            className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-[#244B5A]"
          />
        )}
      </div>
    </FieldShell>
  );
}

/**
 * Alta y edición de un material (artículo de compra). `material` null = alta.
 * Secciones: Datos (nombre, proveedor, rubro), Precio (precio, unidad, USD de referencia), Pedidos (cuándo se pide y
 * cantidad por tamaño de pileta) y Notas (plegable). "Activo" va aparte, al final: desactivar es apagarlo, los
 * materiales no se borran.
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
  const unidad = (useWatch({ control, name: "unidad" }) as string) || "";
  const originales = aFormulario(material).cantidades;

  async function onSubmit(valores: MaterialForm) {
    setErrorGuardado(null);
    const { item, error } = await guardarMaterial(material?.id ?? null, aDatosMaterial(valores), material ? material.precio : undefined);
    if (error || !item) {
      // Se conserva lo cargado: el formulario no se desmonta.
      setErrorGuardado(error ?? "No se pudo guardar el material.");
      return;
    }
    onGuardado(item, material === null);
  }

  const opcionesProveedor: OpcionSelector[] = [
    { value: "", label: "Sin proveedor" },
    ...proveedores
      .filter((p) => p.activo || p.id === material?.proveedor_id)
      .map((p) => ({ value: p.id, label: p.activo ? p.nombre : `${p.nombre} (desactivado)` })),
  ];

  const actualizado = material?.updated_at ? formatFechaRelativa(material.updated_at) : "";

  return (
    <Hoja
      titulo={material ? "Editar material" : "Agregar material"}
      subtitulo={material?.nombre}
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
          soloConCambios={material !== null}
          etiqueta={material ? "Guardar cambios" : "Agregar material"}
          etiquetaGuardando={material ? "Guardando..." : "Agregando..."}
        />
      }
    >
      <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <Seccion titulo="Datos">
          <TextField register={register} errors={errors} name="nombre" label="Nombre" required autoFocus />
          <SelectField register={register} errors={errors} name="proveedor_id" label="Proveedor" options={opcionesProveedor} />
          <SelectField register={register} errors={errors} name="rubro" label="Rubro" options={opciones(RUBROS_MATERIAL, material?.rubro, "Sin rubro")} />
        </Seccion>

        <Seccion titulo="Precio">
          <div className="grid grid-cols-2 gap-3">
            <MoneyField control={control} name="precio" label="Precio" hint="Vacío = a confirmar" />
            <SelectField register={register} errors={errors} name="unidad" label="Unidad" options={opciones(UNIDADES_MATERIAL, material?.unidad, "Sin unidad")} />
          </div>
          <NumberField control={control} name="usd_ref" label="USD de referencia" hint="Solo si cotiza en dólares" emptyValue="null" />
        </Seccion>

        <Seccion titulo="Pedidos">
          <SelectField register={register} errors={errors} name="aplica" label="Cuándo se pide" options={opcionesAplica(material?.aplica)} />
          <div>
            <p className="flex items-center gap-1 text-[15px] font-medium text-[#1F2A30]">
              Cantidad por tamaño de pileta{unidad ? <span className="font-normal text-[#4A5861]"> · en {unidad}</span> : null}
              <InfoPopover etiqueta="Cómo se usan estas cantidades">
                Es la cantidad base de este material para cada tamaño de pileta. Se multiplica según “Cuándo se pide” y por la cantidad de obras. Un tamaño vacío
                significa que ese material no se pide para esa pileta.
              </InfoPopover>
            </p>
            <p className="mb-2 mt-0.5 text-[13px] leading-snug text-[#4A5861]">Se aplica a todos los pedidos nuevos.</p>
            <div className="grid grid-cols-3 gap-3">
              {TAMANOS.map((t, i) => (
                <CampoCantidad key={t} control={control as unknown as Control<MaterialForm>} indice={i} tamano={t} unidad={unidad} original={originales[i] ?? null} />
              ))}
            </div>
          </div>
        </Seccion>

        <SeccionPlegable titulo="Notas" abierta={!!material?.notas}>
          <TextField register={register} errors={errors} name="notas" label="Notas" multiline rows={3} />
        </SeccionPlegable>

        <ZonaActivo>
          <CheckboxField register={register} errors={errors} name="activo" label="Activo" hint="Si lo desactivás, sale de los pedidos nuevos; no se pierde." />
        </ZonaActivo>

        {actualizado && <p className="text-[13px] text-[#4A5861]">Actualizado {actualizado}</p>}
      </form>
    </Hoja>
  );
}
