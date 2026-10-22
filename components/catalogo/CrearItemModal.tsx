"use client";

import { useId, useState } from "react";
import { useZodForm } from "@/lib/forms/useZodForm";
import { MoneyField, NumberField, TextField, SelectField, CheckboxField } from "@/components/form";
import { crearItemCatalogo } from "@/lib/catalogo";
import { CATEGORIAS, UNIDADES } from "@/lib/domain/catalogo/categorias";
import type { ItemCatalogo } from "@/lib/domain/catalogo/item";
import { MODELOS_INDUSPLAST } from "@/lib/domain/catalogo/listas";
import { Hoja, PieAcciones } from "@/components/ui/Hoja";
import { NuevoItemSchema, nuevoItemFormVacio, aNuevoItem, datosDeAlta, type NuevoItemForm } from "./nuevo-item.schema";
import { TITULOS_TIPO } from "./titulos-tipo";

const OPCIONES_TIPO = (Object.keys(TITULOS_TIPO) as (keyof typeof TITULOS_TIPO)[]).map((tipo) => ({
  value: tipo,
  label: TITULOS_TIPO[tipo],
}));

const OPCIONES_CATEGORIA = [
  { value: "", label: "Sin clasificar" },
  ...CATEGORIAS.map((c) => ({ value: c, label: c })),
];

const OPCIONES_ALTA = [
  { value: "otro", label: "Otro ítem (cerco, cobertor, adicional...)" },
  { value: "hormigon", label: "Piscina de hormigón" },
  { value: "indusplast", label: "Piscina de fibra Indusplast" },
];

const OPCIONES_MODELO = MODELOS_INDUSPLAST.map((m) => ({ value: m, label: m.charAt(0).toUpperCase() + m.slice(1) }));

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
  const formId = useId();
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const {
    control,
    watch,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useZodForm(NuevoItemSchema, { defaultValues: nuevoItemFormVacio() });

  const llevaStock = watch("llevaStock");
  const alta = watch("alta");
  const esPiscina = alta !== "otro";
  // Lo que se va a guardar de una piscina (clave y nombre), para mostrarlo antes de agregar.
  const previa = esPiscina
    ? datosDeAlta({
        ...nuevoItemFormVacio(),
        alta,
        largo: watch("largo"),
        ancho: watch("ancho"),
        modelo: watch("modelo"),
        medida: watch("medida"),
      })
    : null;

  async function onSubmit(valores: NuevoItemForm) {
    setErrorGuardado(null);
    const nuevo = aNuevoItem(valores);
    if (!nuevo) {
      if (valores.alta === "hormigon") setError("largo", { message: "Ingresá el largo y el ancho de la piscina" });
      else if (valores.alta === "indusplast") setError("medida", { message: "Ingresá la medida (por ejemplo 750)" });
      else setError("descripcion", { message: "Ingresá una descripción (o una clave)" });
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
    <Hoja
      titulo="Agregar ítem al catálogo"
      subtitulo="Queda disponible para todo el equipo en la calculadora que elijas."
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
      pie={<PieAcciones formId={formId} guardando={isSubmitting} etiqueta="Agregar al catálogo" etiquetaGuardando="Agregando..." />}
    >
      <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <SelectField register={register} errors={errors} name="alta" label="¿Qué vas a agregar?" options={OPCIONES_ALTA} />

          {alta === "hormigon" && (
            <div className="grid grid-cols-2 gap-4">
              <NumberField control={control} name="largo" label="Largo (m)" emptyValue="null" />
              <NumberField control={control} name="ancho" label="Ancho (m)" emptyValue="null" />
            </div>
          )}
          {alta === "indusplast" && (
            <div className="grid grid-cols-2 gap-4">
              <SelectField register={register} errors={errors} name="modelo" label="Modelo" options={OPCIONES_MODELO} />
              <NumberField control={control} name="medida" label="Medida" hint="Ej: 750" emptyValue="null" />
            </div>
          )}
          {esPiscina && (
            <p className="rounded-md bg-[#EEF2F6] px-3 py-2 text-xs text-gray-600">
              {previa ? (
                <>
                  Se agrega como <b>{previa.descripcion.split(" — ")[0]}</b>, en Piscinas, unidad obra. Aparece solo en su sección
                  y en la planilla (clave <code>{previa.clave}</code>).
                </>
              ) : (
                "Completá las medidas: la clave, la categoría y la unidad se arman solas."
              )}
            </p>
          )}

          {!esPiscina && (
            <>
              <SelectField register={register} errors={errors} name="tipo" label="Calculadora" options={OPCIONES_TIPO} />
              <TextField
                register={register}
                errors={errors}
                name="descripcion"
                label="Descripción"
                multiline
                rows={3}
                autoFocus
              />
              <TextField
                register={register}
                errors={errors}
                name="clave"
                label="Clave (opcional)"
                placeholder="Se arma sola con la descripción"
                hint="Interna, sin espacios ni tildes; no se puede cambiar después."
              />
            </>
          )}
          <MoneyField
            control={control}
            name="precio"
            label="Precio"
            hint="Vacío = a cotizar (sin precio fijo)"
          />
          {!esPiscina && (
            <>
              <SelectField register={register} errors={errors} name="categoria" label="Categoría" options={OPCIONES_CATEGORIA} />
              <SelectField register={register} errors={errors} name="unidad" label="Unidad" options={OPCIONES_UNIDAD} />
            </>
          )}
          <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
            <CheckboxField
              register={register}
              errors={errors}
              name="llevaStock"
              label="Llevar stock"
              hint="Para lo que se guarda en el local, como las piscinas de fibra."
            />
            {llevaStock && (
              <p className="text-xs text-gray-500">Arranca en 0 unidades. Cargá lo que hay con «Ingreso» desde la lista del catálogo.</p>
            )}
          </div>
          <div className="rounded-xl border border-gray-200 px-4 py-1">
            <CheckboxField register={register} errors={errors} name="activo" label="Activo" hint="Desactivado: no aparece en presupuestos nuevos." />
          </div>
      </form>
    </Hoja>
  );
}
