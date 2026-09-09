"use client";

import { useEffect, useMemo, useState } from "react";
import { useWatch } from "react-hook-form";
import { useZodForm } from "@/lib/forms/useZodForm";
import { NumberField, TextField, CheckboxField, SelectField } from "@/components/form";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { calcularGeometriaPlano, ajustarLucesPos, fmtM, type LuzPos } from "@/lib/domain/plano/losetas";
import { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import type { PresupuestoLeido } from "@/lib/domain/presupuesto/adaptadores";
import { guardarPresupuesto, actualizarPresupuesto } from "@/lib/presupuestos";
import { armarNombreArchivo } from "@/lib/documentos/nombreArchivo";
import { compartirOdescargarArchivo } from "@/lib/documentos/compartir";
import { generarImagenClientePlano, generarPdfClientePlano } from "@/lib/documentos/losetas/imagenCliente";
import { PlanoLosetasSvg } from "./PlanoLosetasSvg";
import { LosetasFormSchema, formularioVacio, type LosetasForm } from "./schema";
import { IconCloudUpload, IconImage, IconPrinter } from "@/components/icons";
import { FloatingSaveBar } from "@/components/calculadoras/FloatingSaveBar";

/**
 * Losetas — "Plano de Piscina": editor SVG interactivo, no un documento con
 * líneas de precio ni un presupuesto de marca. Reemplaza a
 * app/dashboard/losetas/{calculator,markup,script,styles}.ts (Fase 5, Lote 6).
 *
 * Acá sólo se genera el plano para el cliente — nunca se cotiza ni se
 * cotejan m² (eso vivía acá antes y se sacó a pedido, junto con el banner de
 * marca de los presupuestos: este plano no lleva ninguno de los dos).
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
    escaleraAncho: num(m.escaleraAncho, 0.5),
    escaleraEscalones: num(m.escaleraEscalones, 3),
    escaleraMedidaEscalon: num(m.escaleraMedidaEscalon, 0.3),
    escaleraMovible: bool(m.escaleraMovible),
    escaleraPosLibre: { x: num((m.escaleraPosLibre as { x?: unknown })?.x, 0.5), y: num((m.escaleraPosLibre as { y?: unknown })?.y, 0.5) },
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
    escaleraAncho: v.escaleraAncho,
    escaleraEscalones: v.escaleraEscalones,
    escaleraMedidaEscalon: v.escaleraMedidaEscalon,
    escaleraMovible: v.escaleraMovible,
    escaleraPosLibre: v.escaleraPosLibre,
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
  const [generandoImagen, setGenerandoImagen] = useState(false);
  const [errorImagen, setErrorImagen] = useState<string | null>(null);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [errorPdf, setErrorPdf] = useState<string | null>(null);
  const [confirmarLimpiar, setConfirmarLimpiar] = useState(false);

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
      escaleraAncho: num(valoresForm.escaleraAncho),
      escaleraEscalones: num(valoresForm.escaleraEscalones),
      escaleraMedidaEscalon: num(valoresForm.escaleraMedidaEscalon),
      escaleraMovible: !!valoresForm.escaleraMovible,
      escaleraPosLibre: { x: num(valoresForm.escaleraPosLibre?.x), y: num(valoresForm.escaleraPosLibre?.y) },
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

  function onMoverEscalera(pos: LuzPos) {
    setValue("escaleraPosLibre", pos, { shouldDirty: true });
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

  function parametrosImagenCliente() {
    return {
      geometria: geometriaCliente,
      nombreCliente: getValues("nombre") || "",
    };
  }

  async function onExportarImagen() {
    setGenerandoImagen(true);
    setErrorImagen(null);
    try {
      const blob = await generarImagenClientePlano(parametrosImagenCliente());
      const nombreArchivo = armarNombreArchivo("Loseta", getValues("nombre") || "", "") + "_cliente";
      await compartirOdescargarArchivo(blob, nombreArchivo, "image/png");
    } catch (err) {
      setErrorImagen(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerandoImagen(false);
    }
  }

  async function onExportarPdf() {
    setGenerandoPdf(true);
    setErrorPdf(null);
    try {
      const blob = await generarPdfClientePlano(parametrosImagenCliente());
      const nombreArchivo = armarNombreArchivo("Loseta", getValues("nombre") || "", "") + "_cliente";
      await compartirOdescargarArchivo(blob, nombreArchivo, "application/pdf");
    } catch (err) {
      setErrorPdf(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerandoPdf(false);
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
            hint="Igual en los cuatro lados."
          />
        </section>

        <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Ancho final del borde, lado por lado</h2>
          <p className="text-xs text-gray-500">
            Medida <b>terminada</b> de cada lado, incluyendo el borde de arriba.
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
                <>
                  <CheckboxField
                    register={register}
                    errors={errors}
                    name="escaleraMovible"
                    label="Ubicarla a mano"
                    hint="En vez de una franja fija, queda como un objeto chico que arrastrás en el plano — igual que las luces."
                  />
                  {valoresForm.escaleraMovible ? (
                    <NumberField
                      control={control}
                      name="escaleraAncho"
                      label="Tamaño (m)"
                      hint="Lado del cuadrado que representa la escalera."
                    />
                  ) : (
                    <>
                      <SelectField register={register} errors={errors} name="escaleraPos" label="Ubicación" options={ESCALERA_OPCIONES} />
                      <div className="grid grid-cols-2 gap-2">
                        <NumberField control={control} name="escaleraEscalones" label="Escalones" />
                        <NumberField control={control} name="escaleraMedidaEscalon" label="Medida (m)" />
                      </div>
                      <p className="text-xs text-gray-500">
                        {`Profundidad total: ${fmtM(num(valoresForm.escaleraEscalones) * num(valoresForm.escaleraMedidaEscalon))} m${
                          valoresForm.solarHumedo ? " — arranca justo después del solar húmedo si están del mismo lado." : "."
                        }`}
                      </p>
                    </>
                  )}
                </>
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
      </div>

      <div>
        <div className="space-y-4 lg:sticky lg:top-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <PlanoLosetasSvg
              geometria={geometriaEditor}
              interactive
              ariaLabel="Editor del plano de la piscina"
              onMoverLuz={onMoverLuz}
              onMoverEscalera={onMoverEscalera}
            />
          </div>

          {/* Vista previa de lo que sale en "Imagen"/"PDF" — mismo contenido
              que arma lib/documentos/losetas/imagenCliente.tsx (nombre del
              cliente incluido), visible en pantalla en vez de vivir sólo en
              un <div> oculto: así se nota antes de exportar si falta cargar
              el nombre o si una medida quedó mal, en vez de descubrirlo
              recién en el archivo descargado. */}
          <details className="rounded-lg border border-gray-200 bg-white shadow-sm" open>
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">
              Vista previa para el cliente
            </summary>
            <div className="space-y-3 border-t border-gray-100 p-4">
              <div className="flex items-center justify-between border-b-2 border-[#00829C] pb-2">
                <div>
                  <div className="text-sm font-bold uppercase tracking-wide text-[#244B5A]">Plano de Piscina</div>
                  <div className="text-xs text-gray-500">{valoresForm.nombre || "Sin nombre de cliente"}</div>
                </div>
              </div>
              <div className="rounded-lg border border-[#E1E7EC] bg-[#EEF2F6] p-4">
                <PlanoLosetasSvg geometria={geometriaCliente} interactive={false} ariaLabel="Vista previa del plano para el cliente" />
              </div>
            </div>
          </details>

          <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            {errorGuardado && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo guardar: {errorGuardado}</p>
            )}
            {guardadoOk && !errorGuardado && (
              <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">Presupuesto guardado en la nube.</p>
            )}
            {errorImagen && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo generar la imagen: {errorImagen}</p>
            )}
            {errorPdf && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo generar el PDF: {errorPdf}</p>
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

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onExportarImagen}
                disabled={generandoImagen}
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-[#1B3A5C] px-4 text-sm font-medium text-[#1B3A5C] transition-colors hover:bg-[#1B3A5C]/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <IconImage className="h-4 w-4" />
                {generandoImagen ? "Generando..." : "Imagen"}
              </button>
              <button
                type="button"
                onClick={onExportarPdf}
                disabled={generandoPdf}
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-[#1B3A5C] px-4 text-sm font-medium text-[#1B3A5C] transition-colors hover:bg-[#1B3A5C]/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <IconPrinter className="h-4 w-4" />
                {generandoPdf ? "Generando..." : "PDF"}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Salen a escala, con las medidas y el nombre del cliente, sin precios. En el celular, &quot;Imagen&quot; y
              &quot;PDF&quot; abren directo la hoja para compartir por WhatsApp.
            </p>

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
