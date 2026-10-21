"use client";

import { useState } from "react";
import { useZodForm } from "@/lib/forms/useZodForm";
import { MoneyField, TextField, SelectField, CheckboxField } from "@/components/form";
import { MarcoDialogo, CLASE_BOTON_PRIMARIO, CLASE_BOTON_SECUNDARIO } from "@/components/stock/MarcoDialogo";
import { HistorialStock } from "@/components/stock/HistorialStock";
import { actualizarItemCatalogo } from "@/lib/catalogo";
import { CATEGORIAS, UNIDADES } from "@/lib/domain/catalogo/categorias";
import type { ItemCatalogo } from "@/lib/domain/catalogo/item";
import type { ResultadoStock } from "@/lib/domain/stock/movimientos";
import { aCambios, aFormulario, EditarItemSchema, type EditarItemForm } from "./editar-item.schema";
import { TITULOS_TIPO } from "./titulos-tipo";

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
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [stockActual, setStockActual] = useState(item.stock);
  const [verHistorial, setVerHistorial] = useState(false);
  const {
    control,
    watch,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
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
    <MarcoDialogo
      titulo="Editar ítem"
      subtitulo={`${item.clave} · ${TITULOS_TIPO[item.tipo]}`}
      ocupado={isSubmitting}
      ancho="sm:max-w-lg"
      onCerrar={onClose}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <fieldset className="space-y-4">
          <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Datos</legend>
          <TextField register={register} errors={errors} name="descripcion" label="Descripción" multiline rows={3} autoFocus />
          <MoneyField control={control} name="precio" label="Precio" hint="Vacío = a cotizar (sin precio fijo)" />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField register={register} errors={errors} name="categoria" label="Categoría" options={OPCIONES_CATEGORIA} />
            <SelectField register={register} errors={errors} name="unidad" label="Unidad" options={OPCIONES_UNIDAD} />
          </div>
        </fieldset>

        <fieldset className="space-y-2 rounded-xl border border-gray-200 bg-gray-50/70 p-4">
          <legend className="-ml-1 bg-white px-1 text-xs font-bold uppercase tracking-wide text-gray-500">Stock</legend>
          <CheckboxField
            register={register}
            errors={errors}
            name="llevaStock"
            label="Llevar stock"
            hint="Para artículos que se guardan en el local, como las piscinas de fibra; los que se piden a pedido no lo llevan."
          />
          {llevaStock && (
            <div className="space-y-1.5 border-t border-gray-200 pt-3 text-sm">
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
                    className="min-h-11 rounded-md px-2 font-semibold text-marca underline decoration-marca/40 underline-offset-2 hover:bg-marca/8 hover:decoration-marca sm:min-h-9"
                  >
                    Ver historial
                  </button>
                </p>
              )}
              <p className="text-xs text-gray-500">
                Las unidades se mueven con Ingreso, Venta o Ajustar conteo, desde la lista del catálogo. Para dejar de llevar stock, el conteo tiene que estar en 0.
              </p>
            </div>
          )}
        </fieldset>

        <CheckboxField
          register={register}
          errors={errors}
          name="activo"
          label="Activo"
          hint="Desactivar lo oculta de los presupuestos y pedidos nuevos, sin perderlo ni tocar los ya hechos. Lo podés reactivar cuando quieras."
        />

        {errorGuardado && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorGuardado}
          </p>
        )}

        <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-col gap-2 border-t border-gray-100 bg-white px-5 py-4 sm:-mx-6 sm:-mb-6 sm:flex-row-reverse sm:px-6">
          <button type="submit" disabled={isSubmitting} className={`${CLASE_BOTON_PRIMARIO} sm:flex-1`}>
            {isSubmitting ? "Guardando..." : "Guardar cambios"}
          </button>
          <button type="button" onClick={onClose} disabled={isSubmitting} className={`${CLASE_BOTON_SECUNDARIO} sm:flex-1`}>
            Cancelar
          </button>
        </div>
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
    </MarcoDialogo>
  );
}
