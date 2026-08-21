"use client";

import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useWatch } from "react-hook-form";
import { useZodForm } from "@/lib/forms/useZodForm";
import { MoneyField, NumberField, TextField, CheckboxField } from "@/components/form";
import { calcularRevestimiento } from "@/lib/domain/precios/revestimientos";
import { crearLinea, type LineaPresupuesto } from "@/lib/domain/precios/tipos";
import { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import type { PresupuestoLeido } from "@/lib/domain/presupuesto/adaptadores";
import { guardarPresupuesto, actualizarPresupuesto, subirFotoPresupuesto } from "@/lib/presupuestos";
import { formatARS } from "@/lib/format/ars";
import type { CatalogoRow } from "@/lib/catalogo";
import { esTextoCompartido } from "@/lib/domain/catalogo/categorias";
import { leerTextosCompartidos } from "@/lib/documentos/textosCompartidos";
import { TEXTOS_POR_DEFECTO_REVESTIMIENTOS, generarDocxRevestimientos } from "@/lib/documentos/revestimientos/docx";
import { armarNombreArchivo } from "@/lib/documentos/nombreArchivo";
import { imprimirConNombre } from "@/lib/documentos/imprimir";
import { redimensionarImagen, MAX_DIM_SUBIDA, CALIDAD_SUBIDA } from "@/lib/documentos/imagenes";
import { DocumentoRevestimiento } from "./DocumentoRevestimiento";
import { RevestimientoFormSchema, formularioVacio, type RevestimientoForm } from "./schema";
import { AccionesDocumento } from "@/components/calculadoras/AccionesDocumento";
import { FloatingSaveBar } from "@/components/calculadoras/FloatingSaveBar";
import { CamposObligatoriosHint } from "@/components/calculadoras/CamposObligatoriosHint";

/**
 * `porM2` no vive en `catalogo_items`: es fija por material, igual que
 * `defaultOptionales` en el legacy. Sólo el disqueado se cobra por obra
 * (precio fijo); todo lo demás, por m².
 */
const CLAVES_POR_OBRA = new Set(["disqueado_revestimiento_previo"]);
function porM2DeClave(clave: string): boolean {
  return !CLAVES_POR_OBRA.has(clave);
}

function formularioDesdeCatalogo(catalogo: CatalogoRow[]): RevestimientoForm {
  const base = formularioVacio();
  return {
    ...base,
    materiales: catalogo
      .filter((r) => !esTextoCompartido(r.clave))
      .map((r) => ({
        clave: r.clave,
        descripcion: r.descripcion ?? r.clave,
        precio: r.precio,
        porM2: porM2DeClave(r.clave),
        incluida: false,
      })),
  };
}

function formularioDesdePresupuesto(leido: PresupuestoLeido, catalogo: CatalogoRow[]): RevestimientoForm {
  const base = formularioDesdeCatalogo(catalogo);
  const { presupuesto, preciosCongelados, clavesIncluidas } = leido;
  const medidas = presupuesto.medidas as {
    largo?: number;
    ancho?: number;
    profMin?: number;
    profMax?: number;
    escalera?: number;
    desperdicio?: number;
    adicionalesM2?: { label: string; m2: number }[];
  };

  const comunes = {
    fecha: presupuesto.fecha,
    validezDias: presupuesto.validezDias,
    cliente: presupuesto.cliente,
    detalle: presupuesto.detalle,
    largo: Number(medidas.largo ?? 0),
    ancho: Number(medidas.ancho ?? 0),
    profMin: Number(medidas.profMin ?? 0),
    profMax: Number(medidas.profMax ?? 0),
    escalera: Number(medidas.escalera ?? 0),
    desperdicio: Number(medidas.desperdicio ?? 0),
    adicionalesM2: medidas.adicionalesM2 ?? [],
  };

  if (!preciosCongelados) {
    return {
      ...base,
      ...comunes,
      materiales: base.materiales.map((m) => ({ ...m, incluida: clavesIncluidas.includes(m.clave) })),
    };
  }

  const adicionales = presupuesto.lineas
    .filter((l) => l.naturaleza === "cotiza")
    .map((l) => ({ descripcion: l.descripcion, precio: l.precioUnitario ?? 0 }));

  const congeladasPorClave = new Map(
    presupuesto.lineas
      .filter((l): l is LineaPresupuesto & { clave: string } => l.naturaleza === "alternativa" && !!l.clave)
      .map((l) => [l.clave, l])
  );

  return {
    ...comunes,
    adicionales,
    materiales: base.materiales.map((m) => {
      const congelada = congeladasPorClave.get(m.clave);
      return congelada
        ? {
            clave: m.clave,
            descripcion: congelada.descripcion,
            precio: congelada.precioUnitario,
            porM2: m.porM2,
            incluida: congelada.incluida,
          }
        : m;
    }),
  };
}

interface FotoEnEdicion {
  id: string;
  blob: Blob | null;
  url: string;
  caption: string;
  width: number | null;
  height: number | null;
  storageUrl: string | null;
}

async function fotosIniciales(presupuesto: PresupuestoV1["fotos"]): Promise<FotoEnEdicion[]> {
  const resultado: FotoEnEdicion[] = [];
  for (const f of presupuesto) {
    if (!f.storageUrl) continue;
    try {
      const resp = await fetch(f.storageUrl);
      if (!resp.ok) continue;
      const blob = await resp.blob();
      resultado.push({
        id: f.id,
        blob,
        url: URL.createObjectURL(blob),
        caption: f.caption,
        width: f.width,
        height: f.height,
        storageUrl: f.storageUrl,
      });
    } catch {
      // Sin conexión o la foto ya no está: se saltea, no rompe el resto de la carga.
    }
  }
  return resultado;
}

/** Arma las líneas `alternativa` (una por material del catálogo) con el
 *  total YA calculado por el motor (precio × m² o precio fijo, según
 *  corresponda) — nunca se deja que `crearLinea` multiplique por cantidad,
 *  porque para "por m²" el precio unitario no es el total por unidad. */
function lineasMateriales(
  materiales: RevestimientoForm["materiales"],
  resultado: ReturnType<typeof calcularRevestimiento>
): LineaPresupuesto[] {
  const totalPorClave = new Map(resultado.alternativas.map((a) => [a.clave, a.total]));
  return materiales.map((m) =>
    crearLinea({
      clave: m.clave,
      descripcion: m.descripcion,
      unidad: m.porM2 ? "m²" : "obra",
      cantidad: 1,
      precioUnitario: m.precio,
      total: m.incluida ? (totalPorClave.get(m.clave) ?? null) : null,
      naturaleza: "alternativa",
      incluida: m.incluida,
      origen: "catalogo",
    })
  );
}

export function RevestimientoCalculadora({
  catalogo,
  presupuestoId = null,
  presupuestoInicial = null,
}: {
  catalogo: CatalogoRow[];
  presupuestoId?: string | null;
  presupuestoInicial?: PresupuestoLeido | null;
}) {
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [generandoWord, setGenerandoWord] = useState(false);
  const [errorWord, setErrorWord] = useState<string | null>(null);
  const [fotos, setFotos] = useState<FotoEnEdicion[]>([]);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const textos = useMemo(() => leerTextosCompartidos(catalogo, TEXTOS_POR_DEFECTO_REVESTIMIENTOS), [catalogo]);

  useEffect(() => {
    if (!presupuestoInicial) return;
    let cancelado = false;
    fotosIniciales(presupuestoInicial.presupuesto.fotos).then((f) => {
      if (!cancelado) setFotos(f);
    });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useZodForm(RevestimientoFormSchema, {
    defaultValues: presupuestoInicial
      ? formularioDesdePresupuesto(presupuestoInicial, catalogo)
      : formularioDesdeCatalogo(catalogo),
  });

  const adicionalesM2 = useFieldArray({ control, name: "adicionalesM2" });
  const adicionales = useFieldArray({ control, name: "adicionales" });
  const materiales = useFieldArray({ control, name: "materiales" });

  const valoresForm = useWatch({ control });

  const resultado = useMemo(() => {
    const m = (v: unknown) => (typeof v === "number" ? v : 0);
    return calcularRevestimiento({
      largo: m(valoresForm.largo),
      ancho: m(valoresForm.ancho),
      profMin: m(valoresForm.profMin),
      profMax: m(valoresForm.profMax),
      escalera: m(valoresForm.escalera),
      desperdicio: m(valoresForm.desperdicio),
      adicionalesM2: (valoresForm.adicionalesM2 ?? [])
        .filter((a): a is NonNullable<typeof a> => !!a)
        .map((a) => m(a.m2)),
      materiales: (valoresForm.materiales ?? [])
        .filter((mat): mat is NonNullable<typeof mat> => !!mat)
        .map((mat) => ({
          clave: mat.clave ?? null,
          descripcion: mat.descripcion ?? "",
          precio: mat.precio ?? null,
          porM2: mat.porM2 ?? true,
          incluida: !!mat.incluida,
        })),
      adicionales: (valoresForm.adicionales ?? [])
        .filter((a): a is NonNullable<typeof a> => !!a)
        .map((a) => ({ descripcion: a?.descripcion ?? "", precio: a?.precio ?? 0 })),
    });
  }, [valoresForm]);

  const snapshotEnVivo: PresupuestoV1 = useMemo(() => {
    const lineasAdicionales = (valoresForm.adicionales ?? [])
      .filter((a): a is NonNullable<typeof a> => !!a)
      .map((a) =>
        crearLinea({
          clave: null,
          descripcion: a.descripcion ?? "",
          unidad: null,
          cantidad: 1,
          precioUnitario: a.precio ?? 0,
          naturaleza: "cotiza",
          incluida: true,
          origen: "manual",
        })
      );
    const materialesForm = (valoresForm.materiales ?? []).filter(
      (m): m is NonNullable<typeof m> => !!m
    ) as RevestimientoForm["materiales"];

    return PresupuestoV1.parse({
      v: 1,
      tipo: "revestimientos",
      fecha: valoresForm.fecha ?? "",
      validezDias: valoresForm.validezDias ?? "",
      cliente: valoresForm.cliente ?? {},
      medidas: {
        largo: valoresForm.largo ?? 0,
        ancho: valoresForm.ancho ?? 0,
        profMin: valoresForm.profMin ?? 0,
        profMax: valoresForm.profMax ?? 0,
        escalera: valoresForm.escalera ?? 0,
        desperdicio: valoresForm.desperdicio ?? 0,
        adicionalesM2: valoresForm.adicionalesM2 ?? [],
      },
      lineas: [...lineasAdicionales, ...lineasMateriales(materialesForm, resultado)],
      preciosBase: {},
      totales: resultado.alternativas.length >= 2 ? resultado.alternativas.map((a) => a.total + resultado.adicionales) : [resultado.totalUnico],
      detalle: valoresForm.detalle ?? "",
      variacionEncabezado: "teal",
      modoPrecio: "ambos",
      fotos: fotos.map((f) => ({ id: f.id, caption: f.caption, width: f.width, height: f.height, storageUrl: f.storageUrl })),
    });
  }, [valoresForm, resultado, fotos]);

  async function onSubmit(valores: RevestimientoForm) {
    setGuardando(true);
    setErrorGuardado(null);
    setGuardadoOk(false);
    try {
      const fotosSubidas: FotoEnEdicion[] = [];
      for (const f of fotos) {
        if (f.storageUrl || !f.blob) {
          fotosSubidas.push(f);
          continue;
        }
        const { url, error } = await subirFotoPresupuesto("revestimientos", f.blob);
        if (error) throw error;
        fotosSubidas.push({ ...f, storageUrl: url ?? null });
      }
      setFotos(fotosSubidas);

      const r = calcularRevestimiento({
        largo: valores.largo,
        ancho: valores.ancho,
        profMin: valores.profMin,
        profMax: valores.profMax,
        escalera: valores.escalera,
        desperdicio: valores.desperdicio,
        adicionalesM2: valores.adicionalesM2.map((a) => a.m2),
        materiales: valores.materiales,
        adicionales: valores.adicionales,
      });
      const totalesFinales =
        r.alternativas.length >= 2 ? r.alternativas.map((a) => a.total + r.adicionales) : [r.totalUnico];

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

      const snapshot: PresupuestoV1 = PresupuestoV1.parse({
        v: 1,
        tipo: "revestimientos",
        fecha: valores.fecha,
        validezDias: valores.validezDias,
        cliente: valores.cliente,
        medidas: {
          largo: valores.largo,
          ancho: valores.ancho,
          profMin: valores.profMin,
          profMax: valores.profMax,
          escalera: valores.escalera,
          desperdicio: valores.desperdicio,
          adicionalesM2: valores.adicionalesM2,
        },
        lineas: [...lineasAdicionales, ...lineasMateriales(valores.materiales, r)],
        preciosBase: {},
        totales: totalesFinales,
        detalle: valores.detalle,
        variacionEncabezado: "teal",
        modoPrecio: "ambos",
        fotos: fotosSubidas.map((f) => ({
          id: f.id,
          caption: f.caption,
          width: f.width,
          height: f.height,
          storageUrl: f.storageUrl,
        })),
      });

      const { error } = presupuestoId
        ? await actualizarPresupuesto(presupuestoId, snapshot, valores.cliente.nombre)
        : await guardarPresupuesto("revestimientos", snapshot, valores.cliente.nombre);
      if (error) throw error;
      setGuardadoOk(true);
    } catch (err) {
      setErrorGuardado(err instanceof Error ? err.message : String(err));
    } finally {
      setGuardando(false);
    }
  }

  async function onAgregarFotos(files: FileList | null) {
    if (!files || !files.length) return;
    setSubiendoFoto(true);
    try {
      for (const file of Array.from(files)) {
        try {
          const { blob, width, height } = await redimensionarImagen(file, MAX_DIM_SUBIDA, CALIDAD_SUBIDA);
          setFotos((prev) => [
            ...prev,
            { id: crypto.randomUUID(), blob, url: URL.createObjectURL(blob), caption: "", width, height, storageUrl: null },
          ]);
        } catch (err) {
          console.error("No se pudo procesar una foto", err);
        }
      }
    } finally {
      setSubiendoFoto(false);
    }
  }

  function quitarFoto(id: string) {
    setFotos((prev) => prev.filter((f) => f.id !== id));
  }

  function cambiarCaption(id: string, caption: string) {
    setFotos((prev) => prev.map((f) => (f.id === id ? { ...f, caption } : f)));
  }

  async function onDescargarWord() {
    setGenerandoWord(true);
    setErrorWord(null);
    try {
      const fotosConBlob = fotos.filter((f): f is FotoEnEdicion & { blob: Blob } => !!f.blob);
      const blob = await generarDocxRevestimientos(
        snapshotEnVivo,
        fotosConBlob.map((f) => ({ id: f.id, blob: f.blob, caption: f.caption, width: f.width, height: f.height })),
        textos
      );
      const nombreArchivo = armarNombreArchivo("Revestimiento", snapshotEnVivo.cliente.nombre, snapshotEnVivo.fecha);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${nombreArchivo}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      setErrorWord(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerandoWord(false);
    }
  }

  function onImprimir() {
    imprimirConNombre(armarNombreArchivo("Revestimiento", snapshotEnVivo.cliente.nombre, snapshotEnVivo.fecha));
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid grid-cols-1 gap-6 pb-20 sm:pb-0 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div data-print-hide="" className="space-y-6">
        <CamposObligatoriosHint />
        {presupuestoInicial && !presupuestoInicial.preciosCongelados && (
          <p role="status" className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Este presupuesto es de antes de que se empezaran a guardar los precios. Los importes se
            recalcularon con el catálogo vigente — pueden no ser los que se le mostraron al cliente en su
            momento.
          </p>
        )}

        <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Datos del cliente</h2>
          <TextField register={register} errors={errors} name="cliente.nombre" label="Señor/Sra" placeholder="Apellido, Nombre" />
          <TextField register={register} errors={errors} name="cliente.domicilio" label="Domicilio" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField register={register} errors={errors} name="cliente.localidad" label="Localidad" />
            <TextField register={register} errors={errors} name="cliente.telefono" label="Teléfono" type="tel" />
          </div>
          <TextField register={register} errors={errors} name="cliente.email" label="Email" type="email" />
          <TextField register={register} errors={errors} name="detalle" label="Notas de la pileta" multiline rows={3} />
          <TextField register={register} errors={errors} name="fecha" label="Fecha" />
          <TextField register={register} errors={errors} name="validezDias" label="Validez (días)" />
        </section>

        <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Cálculo</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField control={control} name="largo" label="Largo pileta (m)" required />
            <NumberField control={control} name="ancho" label="Ancho pileta (m)" required />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField control={control} name="profMin" label="Profundidad desde (m)" />
            <NumberField control={control} name="profMax" label="Profundidad hasta (m)" hint="Opcional: sólo si va de menor a mayor." />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField control={control} name="escalera" label="Escalera (m²)" />
            <NumberField control={control} name="desperdicio" label="Desperdicio (m²)" />
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Adicionales de m²</h3>
            <p className="mb-2 text-xs text-gray-500">Ej. escalón extra o borde. Se suman directo al total de m².</p>
            <div className="space-y-3">
              {adicionalesM2.fields.map((field, i) => (
                <div key={field.id} className="flex items-end gap-2 rounded-md border border-gray-100 p-3">
                  <div className="flex-1">
                    <TextField register={register} errors={errors} name={`adicionalesM2.${i}.label`} label="Descripción" />
                  </div>
                  <div className="w-24">
                    <NumberField control={control} name={`adicionalesM2.${i}.m2`} label="m²" />
                  </div>
                  <button
                    type="button"
                    onClick={() => adicionalesM2.remove(i)}
                    className="min-h-11 rounded-md px-3 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => adicionalesM2.append({ label: "", m2: 0 })}
              className="mt-3 min-h-11 rounded-md border border-dashed border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              + Agregar adicional de m²
            </button>
          </div>

          <p className="text-sm font-semibold text-gray-700">TOTAL m² a revestir: {resultado.m2Total.toLocaleString("es-AR")}</p>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Adicionales incluidos en el total
            </h3>
            <div className="space-y-3">
              {adicionales.fields.map((field, i) => (
                <div key={field.id} className="flex items-end gap-2 rounded-md border border-gray-100 p-3">
                  <div className="flex-1">
                    <TextField register={register} errors={errors} name={`adicionales.${i}.descripcion`} label="Descripción" />
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

        {materiales.fields.length > 0 && (
          <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Tipos</h2>
            <p className="text-xs text-gray-500">
              Tildá los que van en este presupuesto. El total de cada uno es precio × m² (o precio fijo si es
              por obra).
            </p>
            {materiales.fields.map((field, i) => (
              <CheckboxField
                key={field.id}
                register={register}
                errors={errors}
                name={`materiales.${i}.incluida`}
                label={`${field.descripcion}${field.precio !== null ? ` — ${formatARS(field.precio)}${field.porM2 ? "/m²" : " (por obra)"}` : " — a cotizar"}`}
              />
            ))}
          </section>
        )}

        <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Fotos</h2>
          <p className="text-xs text-gray-500">Van al final del documento.</p>
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={subiendoFoto}
            onChange={(e) => {
              onAgregarFotos(e.target.files);
              e.target.value = "";
            }}
            className="block w-full text-sm text-gray-700 file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-[#1B3A5C] file:px-4 file:text-sm file:font-medium file:text-white"
          />
          {fotos.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {fotos.map((f) => (
                <div key={f.id} className="space-y-1">
                  {/* eslint-disable-next-line @next/next/no-img-element -- preview de una foto recién subida por el usuario */}
                  <img src={f.url} alt="" className="aspect-square w-full rounded-md object-cover" />
                  <input
                    type="text"
                    value={f.caption}
                    onChange={(e) => cambiarCaption(f.id, e.target.value)}
                    placeholder="Pie de foto (opcional)"
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => quitarFoto(f.id)}
                    className="min-h-11 w-full rounded-md text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <AccionesDocumento
          errorGuardado={errorGuardado}
          guardadoOk={guardadoOk}
          errorWord={errorWord}
          guardando={guardando}
          generandoWord={generandoWord}
          onDescargarWord={onDescargarWord}
          onImprimir={onImprimir}
        />
      </div>

      <div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm print:border-0 print:p-0 print:shadow-none">
          <DocumentoRevestimiento
            snapshot={snapshotEnVivo}
            textos={textos}
            fotos={fotos.map((f) => ({ id: f.id, url: f.url, caption: f.caption }))}
          />
        </div>
      </div>

      <FloatingSaveBar guardando={guardando} />
    </form>
  );
}
