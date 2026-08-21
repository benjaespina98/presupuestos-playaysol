"use client";

import { useMemo, useState } from "react";
import { useFieldArray, useWatch } from "react-hook-form";
import { useZodForm } from "@/lib/forms/useZodForm";
import { MoneyField, NumberField, TextField, SelectField, CheckboxField } from "@/components/form";
import { calcularCerco, totalesAMostrar } from "@/lib/domain/precios/cercos";
import { crearLinea } from "@/lib/domain/precios/tipos";
import { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import { guardarPresupuesto } from "@/lib/presupuestos";
import { formatARS } from "@/lib/format/ars";
import type { CatalogoRow } from "@/lib/catalogo";
import { CercosFormSchema, formularioVacio, type CercosForm } from "./schema";

/** Etiqueta del/de los total(es), calcada de la que imprime el documento hoy
 *  (ver tests/oracle/fixtures/cercos.json) — no se reinventa el texto. */
function etiquetasTotal(modo: CercosForm["modoPrecio"]): string[] {
  if (modo === "sin") return ["TOTAL"];
  if (modo === "con") return ["TOTAL (incluye instalación)"];
  return ["TOTAL SIN INSTALACIÓN", "TOTAL CON INSTALACIÓN"];
}

const CLAVE_PRECIO_SIN = "precioSin";
const CLAVE_PRECIO_CON = "precioCon";

/** Arma los valores por defecto del form a partir del catálogo compartido: los
 *  dos precios base y la lista de opcionales (todo lo que no sea esas dos
 *  claves ni un texto reservado). */
function formularioDesdeCatalogo(catalogo: CatalogoRow[]): CercosForm {
  const base = formularioVacio();
  const porClave = new Map(catalogo.map((r) => [r.clave, r]));

  return {
    ...base,
    precioPorMlSinInstalacion: porClave.get(CLAVE_PRECIO_SIN)?.precio ?? base.precioPorMlSinInstalacion,
    precioPorMlConInstalacion: porClave.get(CLAVE_PRECIO_CON)?.precio ?? base.precioPorMlConInstalacion,
    opcionales: catalogo
      .filter((r) => r.clave !== CLAVE_PRECIO_SIN && r.clave !== CLAVE_PRECIO_CON && !r.clave.startsWith("__"))
      .map((r) => ({
        clave: r.clave,
        descripcion: r.descripcion ?? r.clave,
        precio: r.precio,
        incluida: false,
      })),
  };
}

export function CercosCalculadora({ catalogo }: { catalogo: CatalogoRow[] }) {
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [guardadoId, setGuardadoId] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useZodForm(CercosFormSchema, { defaultValues: formularioDesdeCatalogo(catalogo) });

  const adicionales = useFieldArray({ control, name: "adicionales" });
  const opcionales = useFieldArray({ control, name: "opcionales" });

  const metrosLineales = useWatch({ control, name: "metrosLineales" });
  const precioSin = useWatch({ control, name: "precioPorMlSinInstalacion" });
  const precioCon = useWatch({ control, name: "precioPorMlConInstalacion" });
  const modoPrecio = useWatch({ control, name: "modoPrecio" });
  const adicionalesEnVivo = useWatch({ control, name: "adicionales" });

  // Recalcula en cada tecla con el motor puro — nunca con una cuenta propia
  // acá adentro. Si mañana cambia la fórmula, cambia en lib/domain/precios y
  // esto la sigue sin tocarse.
  const resultado = useMemo(
    () =>
      calcularCerco({
        metrosLineales: metrosLineales ?? 0,
        precioPorMlSinInstalacion: precioSin ?? 0,
        precioPorMlConInstalacion: precioCon ?? 0,
        adicionales: (adicionalesEnVivo ?? [])
          .filter((a): a is NonNullable<typeof a> => !!a)
          .map((a) => ({ descripcion: a.descripcion ?? "", precio: a.precio ?? 0 })),
      }),
    [metrosLineales, precioSin, precioCon, adicionalesEnVivo]
  );
  const totales = totalesAMostrar(resultado, modoPrecio ?? "ambos");
  const etiquetas = etiquetasTotal(modoPrecio ?? "ambos");

  async function onSubmit(valores: CercosForm) {
    setGuardando(true);
    setErrorGuardado(null);
    setGuardadoId(null);
    try {
      const r = calcularCerco({
        metrosLineales: valores.metrosLineales,
        precioPorMlSinInstalacion: valores.precioPorMlSinInstalacion,
        precioPorMlConInstalacion: valores.precioPorMlConInstalacion,
        adicionales: valores.adicionales,
      });
      const totalesFinales = totalesAMostrar(r, valores.modoPrecio);

      const lineasAdicionales = valores.adicionales.map((a) =>
        crearLinea({
          clave: null,
          descripcion: a.descripcion,
          unidad: null,
          cantidad: 1,
          precioUnitario: a.precio,
          naturaleza: "cotiza",
          incluida: true,
          origen: "manual",
        })
      );
      const lineasOpcionales = valores.opcionales.map((o) =>
        crearLinea({
          clave: o.clave,
          descripcion: o.descripcion,
          unidad: null,
          cantidad: 1,
          precioUnitario: o.precio,
          naturaleza: "informativa",
          incluida: o.incluida,
          origen: "catalogo",
        })
      );

      const snapshot: PresupuestoV1 = PresupuestoV1.parse({
        v: 1,
        tipo: "cercos",
        fecha: valores.fecha,
        validezDias: valores.validezDias,
        cliente: valores.cliente,
        medidas: { metrosLineales: valores.metrosLineales },
        lineas: [...lineasAdicionales, ...lineasOpcionales],
        preciosBase: {
          precioPorMlSinInstalacion: valores.precioPorMlSinInstalacion,
          precioPorMlConInstalacion: valores.precioPorMlConInstalacion,
        },
        totales: totalesFinales,
        detalle: valores.detalle,
        variacionEncabezado: "teal",
        modoPrecio: valores.modoPrecio,
        fotos: [],
      });

      const { error } = await guardarPresupuesto("cercos", snapshot, valores.cliente.nombre);
      if (error) throw error;
      setGuardadoId(valores.cliente.nombre || "Sin nombre");
    } catch (err) {
      setErrorGuardado(err instanceof Error ? err.message : String(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Datos del cliente</h2>
          <TextField register={register} errors={errors} name="cliente.nombre" label="Señor/Sra" placeholder="Apellido, Nombre" />
          <TextField register={register} errors={errors} name="cliente.domicilio" label="Domicilio" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField register={register} errors={errors} name="cliente.localidad" label="Localidad" />
            <TextField register={register} errors={errors} name="cliente.telefono" label="Teléfono" type="tel" />
          </div>
          <TextField register={register} errors={errors} name="cliente.email" label="Email" type="email" />
          <TextField
            register={register}
            errors={errors}
            name="detalle"
            label="Detalle del recorrido a cercar"
            multiline
            rows={3}
            placeholder="Ej: perímetro completo de la piscina, incluye tramo de acceso lateral."
          />
          <TextField register={register} errors={errors} name="validezDias" label="Validez (días)" />
        </section>

        <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Cálculo</h2>
          <NumberField control={control} name="metrosLineales" label="Metros lineales a cercar (ml)" placeholder="Ej: 24" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MoneyField
              control={control}
              name="precioPorMlSinInstalacion"
              label="Precio /ml sin instalación"
              emptyValue="zero"
            />
            <MoneyField
              control={control}
              name="precioPorMlConInstalacion"
              label="Precio /ml con instalación"
              emptyValue="zero"
            />
          </div>
          <SelectField
            register={register}
            errors={errors}
            name="modoPrecio"
            label="¿Qué mostrar en el presupuesto?"
            options={[
              { value: "sin", label: "Solo SIN instalación" },
              { value: "con", label: "Solo CON instalación" },
              { value: "ambos", label: "Mostrar ambos" },
            ]}
          />

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Adicionales incluidos en el total
            </h3>
            <div className="space-y-3">
              {adicionales.fields.map((field, i) => (
                <div key={field.id} className="flex items-end gap-2 rounded-md border border-gray-100 p-3">
                  <div className="flex-1">
                    <TextField
                      register={register}
                      errors={errors}
                      name={`adicionales.${i}.descripcion`}
                      label="Descripción"
                    />
                  </div>
                  <div className="w-32">
                    <MoneyField control={control} name={`adicionales.${i}.precio`} label="Precio" />
                  </div>
                  <button
                    type="button"
                    onClick={() => adicionales.remove(i)}
                    className="min-h-11 rounded-md px-3 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => adicionales.append({ descripcion: "", precio: 0 })}
              className="mt-3 min-h-11 rounded-md border border-dashed border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              + Agregar ítem
            </button>
          </div>
        </section>

        {opcionales.fields.length > 0 && (
          <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Opcionales</h2>
            <p className="text-xs text-gray-500">
              Tildá los que van en este presupuesto. No suman al total: salen como anexo informativo.
            </p>
            {opcionales.fields.map((field, i) => (
              <CheckboxField
                key={field.id}
                register={register}
                errors={errors}
                name={`opcionales.${i}.incluida`}
                label={`${field.descripcion}${field.precio !== null ? ` — ${formatARS(field.precio)}` : " — a cotizar"}`}
              />
            ))}
          </section>
        )}
      </div>

      <div className="space-y-4">
        <section className="sticky top-4 space-y-3 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Resultado</h2>
          <dl className="space-y-1 text-sm text-gray-700">
            <div className="flex justify-between">
              <dt>Base sin instalación</dt>
              <dd>{formatARS(resultado.baseSinInstalacion)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Base con instalación</dt>
              <dd>{formatARS(resultado.baseConInstalacion)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Adicionales</dt>
              <dd>{formatARS(resultado.adicionales)}</dd>
            </div>
          </dl>
          <div className="space-y-1 border-t border-gray-100 pt-3">
            {totales.map((t, i) => (
              <div key={etiquetas[i]} className="flex justify-between text-base font-bold text-[#1B3A5C]">
                <span>{etiquetas[i]}</span>
                <span>{formatARS(t)}</span>
              </div>
            ))}
          </div>

          {errorGuardado && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              No se pudo guardar: {errorGuardado}
            </p>
          )}
          {guardadoId && !errorGuardado && (
            <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              Presupuesto guardado en la nube.
            </p>
          )}

          <button
            type="submit"
            disabled={guardando}
            className="min-h-11 w-full rounded-md bg-[#1B3A5C] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#142c46] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Guardar en la nube"}
          </button>
        </section>
      </div>
    </form>
  );
}
