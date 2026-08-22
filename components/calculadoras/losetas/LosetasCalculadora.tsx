"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useWatch } from "react-hook-form";
import { useZodForm } from "@/lib/forms/useZodForm";
import { NumberField, TextField, CheckboxField, SelectField } from "@/components/form";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { calcularLoseta } from "@/lib/domain/precios/losetas";
import { calcularGeometriaPlano, ajustarLucesPos, type LuzPos } from "@/lib/domain/plano/losetas";
import { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import type { PresupuestoLeido } from "@/lib/domain/presupuesto/adaptadores";
import { guardarPresupuesto, actualizarPresupuesto } from "@/lib/presupuestos";
import { armarNombreArchivo } from "@/lib/documentos/nombreArchivo";
import { PlanoLosetasSvg } from "./PlanoLosetasSvg";
import { LosetasFormSchema, formularioVacio, type LosetasForm } from "./schema";
import { IconCloudUpload, IconImage } from "@/components/icons";
import { FloatingSaveBar } from "@/components/calculadoras/FloatingSaveBar";

/**
 * Losetas — "Plano de Piscina": editor SVG interactivo, no un documento con
 * líneas de precio. Reemplaza a app/dashboard/losetas/{calculator,markup,
 * script,styles}.ts (Fase 5, Lote 6).
 *
 * Los materiales (nombre + precio $/m²) son SOLO para la tarjeta de costo
 * extra en pantalla: el legacy nunca los guardó ni los leyó del catálogo —
 * cada presupuesto arranca con los mismos dos materiales en $0 — así que acá
 * se preserva exactamente ese comportamiento (ver `materialesPorDefecto`).
 */

function medidasDesdePresupuesto(leido: PresupuestoLeido): LosetasForm {
  const base = formularioVacio();
  const m = leido.presupuesto.medidas as Record<string, unknown>;
  const num = (v: unknown, def: number) => (typeof v === "number" && Number.isFinite(v) ? v : def);
  const str = (v: unknown, def: string) => (typeof v === "string" && v ? v : def);
  const bool = (v: unknown) => v === true;
  const lucesPos: LuzPos[] = Array.isArray(m.lucesPos)
    ? (m.lucesPos as { x?: unknown; y?: unknown }[]).map((p) => ({ x: num(p?.x, 0), y: num(p?.y, 0) }))
    : [];
  const escaleraPos = (["solar", "opuesto", "lateral1", "lateral2"] as const).includes(m.escaleraPos as never)
    ? (m.escaleraPos as LosetasForm["escaleraPos"])
    : base.escaleraPos;
  const tipoPileta = m.tipoPileta === "fibra" ? "fibra" : "hormigon";
  const revestimiento = (["", "ceramicos", "travertino", "pintura", "otro"] as const).includes(
    m.revestimiento as never
  )
    ? (m.revestimiento as LosetasForm["revestimiento"])
    : "";

  return {
    ...base,
    nombre: leido.presupuesto.cliente.nombre || "",
    largo: num(m.largo, 0),
    ancho: num(m.ancho, 0),
    incluido: num(m.bordeIncluido, 0.5),
    solar: num(m.solar, 0),
    opuesto: num(m.opuesto, 0),
    lateral1: num(m.lateral1, 0),
    lateral2: num(m.lateral2, 0),
    solarHumedo: bool(m.solarHumedo),
    solarHumedoAncho: num(m.solarHumedoAncho, 0),
    escalera: bool(m.escalera),
    escaleraPos,
    tipoPileta,
    labios: num(m.labios, 0.2),
    luces: bool(m.luces),
    cantLuces: num(m.cantLuces, 0),
    lucesPos,
    revestimiento,
    revestimientoOtro: str(m.revestimientoOtro, ""),
    colorAgua: str(m.colorAgua, "#A6D1EC"),
    colorLoseta: str(m.colorLoseta, "#F7E6D3"),
    lblSolar: str(m.lblSolar, "Solar"),
    lblOpuesto: str(m.lblOpuesto, "Opuesto"),
    lblLateral1: str(m.lblLateral1, "Lateral 1"),
    lblLateral2: str(m.lblLateral2, "Lateral 2"),
  };
}

function medidasParaSnapshot(v: LosetasForm) {
  return {
    largo: v.largo,
    ancho: v.ancho,
    bordeIncluido: v.incluido,
    solar: v.solar,
    opuesto: v.opuesto,
    lateral1: v.lateral1,
    lateral2: v.lateral2,
    solarHumedo: v.solarHumedo,
    solarHumedoAncho: v.solarHumedoAncho,
    escalera: v.escalera,
    escaleraPos: v.escaleraPos,
    tipoPileta: v.tipoPileta,
    labios: v.labios,
    luces: v.luces,
    cantLuces: v.cantLuces,
    lucesPos: v.lucesPos,
    revestimiento: v.revestimiento,
    revestimientoOtro: v.revestimientoOtro,
    colorAgua: v.colorAgua,
    colorLoseta: v.colorLoseta,
    lblSolar: v.lblSolar,
    lblOpuesto: v.lblOpuesto,
    lblLateral1: v.lblLateral1,
    lblLateral2: v.lblLateral2,
  };
}

const REVESTIMIENTO_OPCIONES = [
  { value: "", label: "Sin especificar" },
  { value: "ceramicos", label: "Cerámicos" },
  { value: "travertino", label: "Travertino" },
  { value: "pintura", label: "Pintura" },
  { value: "otro", label: "Otro" },
];
const ESCALERA_OPCIONES = [
  { value: "solar", label: "Lado del solar" },
  { value: "opuesto", label: "Lado opuesto" },
  { value: "lateral1", label: "Lateral 1" },
  { value: "lateral2", label: "Lateral 2" },
];
const TIPO_PILETA_OPCIONES = [
  { value: "hormigon", label: "Hormigón" },
  { value: "fibra", label: "Fibra" },
];

export function LosetasCalculadora({
  presupuestoId = null,
  presupuestoInicial = null,
}: {
  presupuestoId?: string | null;
  presupuestoInicial?: PresupuestoLeido | null;
}) {
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [errorExport, setErrorExport] = useState<string | null>(null);
  const [confirmarLimpiar, setConfirmarLimpiar] = useState(false);
  const clientCaptureRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);

  const {
    control,
    register,
    handleSubmit,
    getValues,
    setValue,
    reset,
    formState: { errors },
  } = useZodForm(LosetasFormSchema, {
    defaultValues: presupuestoInicial ? medidasDesdePresupuesto(presupuestoInicial) : formularioVacio(),
  });

  const materiales = useFieldArray({ control, name: "materiales" });
  const valoresForm = useWatch({ control });

  // Ajusta lucesPos a la cantidad actual cada vez que se prende/apaga o
  // cambia la cantidad — conservando las posiciones ya elegidas (mismo
  // criterio que `ensureLucesPos` en el legacy). No depende de `lucesPos`
  // en el array de dependencias a propósito: si dependiera, cada arrastre
  // (que también cambia lucesPos) dispararía el efecto de nuevo.
  const luces = valoresForm.luces;
  const cantLuces = valoresForm.cantLuces;
  useEffect(() => {
    const actuales = getValues("lucesPos") ?? [];
    const ajustadas = ajustarLucesPos(actuales, !!luces, cantLuces ?? 0);
    const cambiaron =
      ajustadas.length !== actuales.length || ajustadas.some((p, i) => p.x !== actuales[i]?.x || p.y !== actuales[i]?.y);
    if (cambiaron) setValue("lucesPos", ajustadas, { shouldDirty: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [luces, cantLuces]);

  const num = (v: unknown) => (typeof v === "number" ? v : 0);

  const resultado = useMemo(
    () =>
      calcularLoseta({
        largo: num(valoresForm.largo),
        ancho: num(valoresForm.ancho),
        bordeIncluido: num(valoresForm.incluido),
        solar: num(valoresForm.solar),
        opuesto: num(valoresForm.opuesto),
        lateral1: num(valoresForm.lateral1),
        lateral2: num(valoresForm.lateral2),
        materiales: (valoresForm.materiales ?? [])
          .filter((m): m is NonNullable<typeof m> => !!m)
          .map((m) => ({ nombre: m.nombre ?? "", precioPorM2: num(m.precioPorM2) })),
      }),
    [valoresForm]
  );

  const geometriaEntrada = useMemo(
    () => ({
      largo: num(valoresForm.largo),
      ancho: num(valoresForm.ancho),
      solar: num(valoresForm.solar),
      opuesto: num(valoresForm.opuesto),
      lateral1: num(valoresForm.lateral1),
      lateral2: num(valoresForm.lateral2),
      solarHumedo: !!valoresForm.solarHumedo,
      solarHumedoAncho: num(valoresForm.solarHumedoAncho),
      escalera: !!valoresForm.escalera,
      escaleraPos: valoresForm.escaleraPos ?? "solar",
      tipoPileta: valoresForm.tipoPileta ?? "hormigon",
      labios: num(valoresForm.labios),
      luces: !!valoresForm.luces,
      cantLuces: num(valoresForm.cantLuces),
      lucesPos: (valoresForm.lucesPos ?? []).map((p) => ({ x: num(p?.x), y: num(p?.y) })),
      revestimiento: valoresForm.revestimiento ?? "",
      revestimientoOtro: valoresForm.revestimientoOtro ?? "",
      colorAgua: valoresForm.colorAgua || "#A6D1EC",
      colorLoseta: valoresForm.colorLoseta || "#F7E6D3",
      lblSolar: valoresForm.lblSolar || "Solar",
      lblOpuesto: valoresForm.lblOpuesto || "Opuesto",
      lblLateral1: valoresForm.lblLateral1 || "Lateral 1",
      lblLateral2: valoresForm.lblLateral2 || "Lateral 2",
    }),
    [valoresForm]
  );

  const geometriaEditor = useMemo(
    () => calcularGeometriaPlano(geometriaEntrada, { viewW: 680, viewHmax: 420, showDims: false, interactive: true }),
    [geometriaEntrada]
  );
  const geometriaCliente = useMemo(
    () => calcularGeometriaPlano(geometriaEntrada, { viewW: 1000, viewHmax: 650, showDims: true, interactive: false }),
    [geometriaEntrada]
  );

  function onMoverLuz(indice: number, pos: LuzPos) {
    setValue(`lucesPos.${indice}`, pos, { shouldDirty: true });
  }

  function snapshotDesdeValores(v: LosetasForm): PresupuestoV1 {
    return PresupuestoV1.parse({
      v: 1,
      tipo: "losetas",
      fecha: "",
      validezDias: "",
      cliente: { nombre: v.nombre },
      medidas: medidasParaSnapshot(v),
      lineas: [],
      preciosBase: {},
      totales: [],
      detalle: "",
      variacionEncabezado: "teal",
      modoPrecio: "ambos",
      fotos: [],
    });
  }

  async function onSubmit(valores: LosetasForm) {
    setGuardando(true);
    setErrorGuardado(null);
    setGuardadoOk(false);
    try {
      const snapshot = snapshotDesdeValores(valores);
      const { error } = presupuestoId
        ? await actualizarPresupuesto(presupuestoId, snapshot, valores.nombre)
        : await guardarPresupuesto("losetas", snapshot, valores.nombre);
      if (error) throw error;
      setGuardadoOk(true);
    } catch (err) {
      setErrorGuardado(err instanceof Error ? err.message : String(err));
    } finally {
      setGuardando(false);
    }
  }

  async function onExportarCliente() {
    setExportando(true);
    setErrorExport(null);
    try {
      const logo = logoRef.current;
      if (logo && !logo.complete) {
        try {
          await logo.decode();
        } catch {
          /* si falla, se exporta igual sin logo */
        }
      }
      await new Promise((res) => requestAnimationFrame(res));

      const { default: html2canvas } = await import("html2canvas");
      const target = clientCaptureRef.current;
      if (!target) throw new Error("No se encontró el plano a exportar.");

      const canvas = await html2canvas(target, { backgroundColor: "#ffffff", scale: 3, useCORS: true });
      const link = document.createElement("a");
      link.download = armarNombreArchivo("Loseta", getValues("nombre") || "", "") + "_cliente.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      setErrorExport(err instanceof Error ? err.message : String(err));
    } finally {
      setExportando(false);
    }
  }

  function limpiarFormulario() {
    reset(formularioVacio());
    setGuardadoOk(false);
    setErrorGuardado(null);
    setConfirmarLimpiar(false);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid grid-cols-1 gap-6 pb-20 sm:pb-0 lg:grid-cols-[minmax(0,1fr)_460px] print:block print:pb-0">
      <div className="space-y-6">
        {presupuestoInicial && !presupuestoInicial.preciosCongelados && (
          <p role="status" className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Este plano es de antes de que se empezara a guardar todo su detalle. Se recuperó lo que había
            guardado en ese momento; los campos que no existían todavía arrancan en su valor por defecto.
          </p>
        )}

        <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Presupuesto</h2>
          <TextField register={register} errors={errors} name="nombre" label="Cliente o referencia" placeholder="Ej: Gómez, Martín" />
        </section>

        <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Medidas de la pileta</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField control={control} name="largo" label="Largo (m)" />
            <NumberField control={control} name="ancho" label="Ancho (m)" />
          </div>
          <NumberField
            control={control}
            name="incluido"
            label="Borde que ya viene incluido (m)"
            hint="Ancho de loseta perimetral que entra en el precio base, igual en los cuatro lados. Todo lo que exceda esta medida es lo que se cotiza aparte."
          />
        </section>

        <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Ancho final del borde, lado por lado</h2>
          <p className="text-xs text-gray-500">
            Cargá la medida <b>terminada</b> de cada lado, incluyendo el borde que ya viene incluido. Un lado que
            quede en la medida estándar lleva ese mismo valor.
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <NumberField control={control} name="solar" label="Solar (m)" />
            <NumberField control={control} name="opuesto" label="Opuesto (m)" />
            <NumberField control={control} name="lateral1" label="Lateral 1 (m)" />
            <NumberField control={control} name="lateral2" label="Lateral 2 (m)" />
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Detalles de la pileta</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField register={register} errors={errors} name="tipoPileta" label="Tipo" options={TIPO_PILETA_OPCIONES} />
            <SelectField register={register} errors={errors} name="revestimiento" label="Revestimiento interior" options={REVESTIMIENTO_OPCIONES} />
          </div>

          {valoresForm.tipoPileta === "fibra" && (
            <NumberField
              control={control}
              name="labios"
              label="Ancho de labios (m)"
              hint="Ya está dentro del largo × ancho de arriba. No cambia los m² a cotizar: solo dibuja el espejo de agua real dentro de la medida exterior."
            />
          )}
          {valoresForm.revestimiento === "otro" && (
            <TextField register={register} errors={errors} name="revestimientoOtro" label="¿Cuál?" placeholder="Ej: Liner, gresite..." />
          )}

          <div className="grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-3">
            <div className="space-y-2">
              <CheckboxField register={register} errors={errors} name="solarHumedo" label="Solar húmedo" />
              {valoresForm.solarHumedo && <NumberField control={control} name="solarHumedoAncho" label="Ancho (m)" />}
            </div>
            <div className="space-y-2">
              <CheckboxField register={register} errors={errors} name="escalera" label="Escalera" />
              {valoresForm.escalera && (
                <SelectField register={register} errors={errors} name="escaleraPos" label="Ubicación" options={ESCALERA_OPCIONES} />
              )}
            </div>
            <div className="space-y-2">
              <CheckboxField register={register} errors={errors} name="luces" label="Luces" />
              {valoresForm.luces && (
                <NumberField control={control} name="cantLuces" label="Cantidad" hint="Arrastralas en el plano para ubicarlas." />
              )}
            </div>
          </div>
        </section>

        <details className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-gray-900">
            Apariencia del plano <span className="font-normal text-gray-500">— colores y nombres de los lados</span>
          </summary>
          <div className="space-y-4 border-t border-gray-100 p-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="colorAgua" className="mb-1 block text-xs text-gray-500">Color del agua</label>
                <input id="colorAgua" type="color" className="h-10 w-full cursor-pointer rounded-md border border-gray-300" {...register("colorAgua")} />
              </div>
              <div>
                <label htmlFor="colorLoseta" className="mb-1 block text-xs text-gray-500">Color de la loseta</label>
                <input id="colorLoseta" type="color" className="h-10 w-full cursor-pointer rounded-md border border-gray-300" {...register("colorLoseta")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <TextField register={register} errors={errors} name="lblSolar" label="Nombre del lado solar" />
              <TextField register={register} errors={errors} name="lblOpuesto" label="Nombre del lado opuesto" />
              <TextField register={register} errors={errors} name="lblLateral1" label="Nombre del lateral 1" />
              <TextField register={register} errors={errors} name="lblLateral2" label="Nombre del lateral 2" />
            </div>
          </div>
        </details>

        <section className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">
            Materiales y precios <span className="font-normal text-gray-500">— uso interno, no sale en la imagen del cliente</span>
          </h2>
          <div className="grid grid-cols-[1fr_120px_auto] gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <span>Material</span>
            <span>Precio $/m²</span>
            <span />
          </div>
          <div className="space-y-2">
            {materiales.fields.map((field, i) => (
              <div key={field.id} className="grid grid-cols-[1fr_120px_auto] items-center gap-2">
                <label className="sr-only" htmlFor={`materiales.${i}.nombre`}>
                  Nombre del material
                </label>
                <input
                  id={`materiales.${i}.nombre`}
                  type="text"
                  placeholder="Nombre del material"
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                  {...register(`materiales.${i}.nombre` as const)}
                />
                <NumberField control={control} name={`materiales.${i}.precioPorM2`} label="" className="mt-0" />
                <button
                  type="button"
                  onClick={() => materiales.remove(i)}
                  disabled={materiales.fields.length <= 1}
                  className="min-h-11 rounded-md px-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => materiales.append({ nombre: "", precioPorM2: 0 })}
            className="min-h-11 w-full rounded-md border border-dashed border-gray-400 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            + Agregar material
          </button>
          <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
            {resultado.costos.map((c, i) => (
              <div key={i} className="rounded-md border border-gray-200 bg-white p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Costo extra — {c.nombre || "Sin nombre"}</div>
                <div className="mt-1 text-lg font-bold text-[#1B3A5C]">${c.total.toLocaleString("es-AR")}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div>
        <div className="space-y-4 lg:sticky lg:top-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <PlanoLosetasSvg geometria={geometriaEditor} interactive ariaLabel="Editor del plano de la piscina" onMoverLuz={onMoverLuz} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">m² ya incluidos</div>
              <div className="mt-1 text-2xl font-bold text-[#1B3A5C]">{resultado.m2Incluidos.toLocaleString("es-AR")} m²</div>
            </div>
            <div className="rounded-lg border border-[#C0522D] bg-[#FDF6F3] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">m² extra a cotizar</div>
              <div className="mt-1 text-2xl font-bold text-[#C0522D]">{resultado.m2ACotizar.toLocaleString("es-AR")} m²</div>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            {errorGuardado && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo guardar: {errorGuardado}</p>
            )}
            {guardadoOk && !errorGuardado && (
              <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">Presupuesto guardado en la nube.</p>
            )}
            {errorExport && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Error generando la imagen: {errorExport}</p>
            )}

            {/* "Guardar" es la acción primaria (persiste el trabajo) en las 5
                calculadoras por igual — antes acá abajo era al revés
                (terracotta = exportar arriba, navy outline = guardar abajo),
                la única de las 5 con esa jerarquía invertida. */}
            <button
              type="submit"
              disabled={guardando}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-[#1B3A5C] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#142c46] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IconCloudUpload className="h-4 w-4" />
              {guardando ? "Guardando..." : "Guardar en la nube"}
            </button>

            <button
              type="button"
              onClick={onExportarCliente}
              disabled={exportando}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-[#1B3A5C] px-4 text-sm font-medium text-[#1B3A5C] transition-colors hover:bg-[#1B3A5C]/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IconImage className="h-4 w-4" />
              {exportando ? "Generando..." : "Imagen para el cliente"}
            </button>
            <p className="text-xs text-gray-500">La imagen sale a escala, con las medidas y sin precios: lista para mandar por chat.</p>

            <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
              <a href="/dashboard/historial?tipo=losetas" className="min-h-11 rounded-md px-4 py-2.5 text-center text-sm font-medium text-[#1B3A5C] hover:bg-gray-100">
                Historial
              </a>
              <button
                type="button"
                onClick={() => setConfirmarLimpiar(true)}
                className="min-h-11 rounded-md px-4 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100"
              >
                Limpiar formulario
              </button>
            </div>
          </div>
        </div>
      </div>

      {/*
        Capturado por html2canvas — fuera de pantalla, nunca visible.

        SOLO colores hex explícitos acá adentro (`text-[#...]`/`bg-[#...]`/
        `border-[#...]`), nunca los tokens de paleta de Tailwind (`bg-white`,
        `border-gray-200`, `text-gray-500`, etc.): en Tailwind v4 esos tokens
        se generan en `oklch()`, y html2canvas 1.4.1 sólo entiende
        rgb/rgba/hex/hsl — con un color de paleta en este árbol, "Imagen para
        el cliente" tira "Attempting to parse an unsupported color function
        oklch/lab" y no exporta nada. El resto de la pantalla (fuera de este
        div) no lo sufre porque nunca se rasteriza.

        Los hex de acá son los mismos que usaba el plano legacy
        (`app/dashboard/losetas/styles.ts`, ya borrado) — no son un cambio de
        paleta, son ESOS MISMOS colores escritos a mano para esquivar oklch.
      */}
      <div
        ref={clientCaptureRef}
        aria-hidden="true"
        style={{ position: "fixed", top: -99999, left: -99999, width: 1100 }}
        className="bg-[#ffffff] p-12 font-sans"
      >
        <div className="mb-7 flex items-center justify-between border-b border-[#E1E7EC] pb-4">
          <div>
            <div className="text-xl font-bold text-[#1B3A5C]">Plano de Piscina</div>
            <div className="mt-1 text-sm text-[#6B7680]">{valoresForm.nombre || ""}</div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- capturada por html2canvas, no puede depender de next/image */}
          <img ref={logoRef} src="/logo-mark.png" alt="Playa y Sol" className="h-14" />
        </div>
        <div className="rounded-lg border border-[#E1E7EC] bg-[#FAFBFC] p-7">
          <PlanoLosetasSvg geometria={geometriaCliente} interactive={false} ariaLabel="Plano de la piscina para el cliente" />
        </div>
        <div className="mt-6 border-t border-[#E1E7EC] pt-4 text-xs text-[#1B3A5C]">
          Playa y Sol S.A.S. — Corrientes 1210, Villa María
        </div>
      </div>

      <ConfirmDialog
        open={confirmarLimpiar}
        title="¿Limpiar todos los campos?"
        message="Se va a empezar un presupuesto nuevo. Lo que hayas cargado acá se pierde."
        confirmLabel="Limpiar"
        danger
        onConfirm={limpiarFormulario}
        onCancel={() => setConfirmarLimpiar(false)}
      />

      <FloatingSaveBar guardando={guardando} />
    </form>
  );
}
