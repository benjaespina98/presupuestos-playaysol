"use client";

import { useId, useState } from "react";
import { useZodForm } from "@/lib/forms/useZodForm";
import { MoneyField, TextField, SelectField, CheckboxField } from "@/components/form";
import { Hoja, PieAcciones } from "@/components/ui/Hoja";
import { Seccion, ZonaActivo } from "@/components/ui/SeccionForm";
import { HistorialStock } from "@/components/stock/HistorialStock";
import { actualizarItemCatalogo } from "@/lib/catalogo";
import { CATEGORIAS, UNIDADES } from "@/lib/domain/catalogo/categorias";
import type { ItemCatalogo } from "@/lib/domain/catalogo/item";
import type { ResultadoStock } from "@/lib/domain/stock/movimientos";
import { aCambios, aFormulario, EditarItemSchema, type EditarItemForm } from "./editar-item.schema";
import { TITULOS_TIPO } from "./titulos-tipo";
import { formatFechaRelativa } from "@/lib/format/fecha";

const OPCIONES_CATEGORIA = [
  { value: "", label: "Sin clasificar" },
  ...CATEGORIAS.map((c) => ({ value: c, label: c })),
];

const OPCIONES_UNIDAD = [
  { value: "", label: "Sin unidad" },
  ...UNIDADES.map((u) => ({ value: u, label: u })),
];

/**
 * Formulario de edición de un ítem existente del catálogo, en un diálogo (en el
 * celular sube desde abajo, como los de stock).
 *
 * Se monta con `key={item.id}` desde la pantalla que lo usa (ver
 * app/dashboard/catalogo/page.tsx): así cada ítem abre una instancia de form
 * nueva con sus propios `defaultValues`, sin necesitar `reset()` ni un efecto
 * para sincronizar — al cambiar de ítem, React desmonta y monta de nuevo.
 *
 * Acá viven las acciones sobre un ítem existente: guardar los cambios y
 * desactivarlo o reactivarlo (el interruptor "Activo": lo oculta sin perderlo).
 * Los ítems no se borran. Las unidades de stock NO se editan acá: se mueven con
 * Ingreso, Venta o Ajustar conteo desde la lista. Agregar un ítem nuevo es CrearItemModal.
 */
export function EditarItemModal({
  item,
  onClose,
  onGuardado,
  onStockCambio,
}: {
  item: ItemCatalogo;
  onClose: () => void;
  onGuardado: (item: ItemCatalogo) => void;
  /** Se anuló un movimiento desde el historial: el padre actualiza el stock de la lista. */
  onStockCambio?: (item: ItemCatalogo, resultado: ResultadoStock) => void;
}) {
  const formId = useId();
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [stockActual, setStockActual] = useState(item.stock);
  const [verHistorial, setVerHistorial] = useState(false);
  const {
    control,
    watch,
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useZodForm(EditarItemSchema, { defaultValues: aFormulario(item) });

  const llevaStock = watch("llevaStock");
  const nombre = item.descripcion || item.clave;

  async function onSubmit(valores: EditarItemForm) {
    setErrorGuardado(null);
    // El stock que se guarda es el de la base, no uno editado a mano: si cambió desde el historial, el último conocido.
    const cambios = aCambios(valores, stockActual);
    const { error } = await actualizarItemCatalogo(item.id, cambios);
    if (error) {
      setErrorGuardado(error);
      return;
    }
    onGuardado({ ...item, stock: stockActual, ...cambios });
  }

  return (
    <Hoja
      titulo="Editar ítem"
      subtitulo={`${nombre} · ${TITULOS_TIPO[item.tipo]}`}
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
      pie={<PieAcciones formId={formId} guardando={isSubmitting} soloConCambios etiqueta="Guardar cambios" />}
    >
      <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <Seccion titulo="Datos">
          <TextField register={register} errors={errors} name="descripcion" label="Descripción" multiline rows={3} autoFocus />
          <SelectField register={register} errors={errors} name="categoria" label="Categoría" options={OPCIONES_CATEGORIA} />
        </Seccion>

        <Seccion titulo="Precio">
          <div className="grid grid-cols-2 gap-3">
            <MoneyField control={control} name="precio" label="Precio" hint="Vacío = a cotizar" />
            <SelectField register={register} errors={errors} name="unidad" label="Unidad" options={OPCIONES_UNIDAD} />
          </div>
        </Seccion>

        <Seccion titulo="Stock">
          <CheckboxField
            register={register}
            errors={errors}
            name="llevaStock"
            label="Llevar stock"
            hint="Para lo que se guarda en el local, como las piscinas de fibra."
          />
          {llevaStock && (
            <div className="space-y-1.5 text-base">
              {stockActual === null ? (
                <p className="text-gray-700">Va a arrancar en 0 unidades.</p>
              ) : (
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-700">
                  <span>
                    Stock actual: <strong className="tabular-nums text-gray-900">{stockActual}</strong>
                  </span>
                  <span aria-hidden="true" className="text-gray-300">
                    ·
                  </span>
                  <button
                    type="button"
                    onClick={() => setVerHistorial(true)}
                    className="inline-flex min-h-11 items-center rounded-md px-2 font-semibold text-[#244B5A] underline underline-offset-2 hover:bg-[#EAF0F2] active:bg-[#D5E0E4]"
                  >
                    Ver historial
                  </button>
                </p>
              )}
              <p className="text-[13px] leading-snug text-[#4A5861]">
                Las unidades se mueven con Ingreso, Venta o Ajustar conteo, desde la lista del catálogo. Para dejar de llevar stock, el conteo tiene que estar en 0.
              </p>
            </div>
          )}
        </Seccion>

        <ZonaActivo>
          <CheckboxField register={register} errors={errors} name="activo" label="Activo" hint="Si lo desactivás, sale de presupuestos y pedidos nuevos; no se pierde." />
        </ZonaActivo>

        {item.updated_at && formatFechaRelativa(item.updated_at) && <p className="text-[13px] text-[#4A5861]">Actualizado {formatFechaRelativa(item.updated_at)}</p>}
      </form>

      {verHistorial && (
        <HistorialStock
          itemId={item.id}
          nombre={nombre}
          onCerrar={() => setVerHistorial(false)}
          onStockCambiado={(r) => {
            setStockActual(r.stock_resultante);
            onStockCambio?.(item, r);
          }}
        />
      )}
    </Hoja>
  );
}
