"use client";

import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useWatch } from "react-hook-form";
import { useZodForm } from "@/lib/forms/useZodForm";
import { MoneyField, NumberField, TextField, SelectField, CheckboxField } from "@/components/form";
import { calcularCobertor, totalesAMostrar } from "@/lib/domain/precios/cobertores";
import { crearLinea, type LineaPresupuesto } from "@/lib/domain/precios/tipos";
import { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import type { PresupuestoLeido } from "@/lib/domain/presupuesto/adaptadores";
import { guardarPresupuesto, actualizarPresupuesto, subirFotoPresupuesto } from "@/lib/presupuestos";
import { formatARS } from "@/lib/format/ars";
import type { CatalogoRow } from "@/lib/catalogo";
import { esTextoCompartido } from "@/lib/domain/catalogo/categorias";
import { leerTextosCompartidos } from "@/lib/documentos/textosCompartidos";
import { TEXTOS_POR_DEFECTO_COBERTORES, generarDocxCobertores } from "@/lib/documentos/cobertores/docx";
import { armarNombreArchivo } from "@/lib/documentos/nombreArchivo";
import { imprimirConNombre } from "@/lib/documentos/imprimir";
import { redimensionarImagen, MAX_DIM_SUBIDA, CALIDAD_SUBIDA } from "@/lib/documentos/imagenes";
import { DocumentoCobertor } from "./DocumentoCobertor";
import { CobertorFormSchema, formularioVacio, type CobertorForm } from "./schema";
import { AccionesDocumento } from "@/components/calculadoras/AccionesDocumento";
import { FloatingSaveBar } from "@/components/calculadoras/FloatingSaveBar";
import { CamposObligatoriosHint } from "@/components/calculadoras/CamposObligatoriosHint";

const CLAVE_PRECIO_MENOS15 = "precioMenos15";
const CLAVE_PRECIO_MAS15 = "precioMas15";
const CLAVE_PRECIO_INSTALACION = "precioInstalacion";
const CLAVES_BASE = [CLAVE_PRECIO_MENOS15, CLAVE_PRECIO_MAS15, CLAVE_PRECIO_INSTALACION];

function esOpcionalCatalogo(r: CatalogoRow): boolean {
  return !CLAVES_BASE.includes(r.clave) && !esTextoCompartido(r.clave);
}

function formularioDesdeCatalogo(catalogo: CatalogoRow[]): CobertorForm {
  const base = formularioVacio();
  const porClave = new Map(catalogo.map((r) => [r.clave, r]));

  return {
    ...base,
    precioPorM2HastaUmbral: porClave.get(CLAVE_PRECIO_MENOS15)?.precio ?? base.precioPorM2HastaUmbral,
    precioPorM2SobreUmbral: porClave.get(CLAVE_PRECIO_MAS15)?.precio ?? base.precioPorM2SobreUmbral,
    precioInstalacion: porClave.get(CLAVE_PRECIO_INSTALACION)?.precio ?? base.precioInstalacion,
    opcionales: catalogo.filter(esOpcionalCatalogo).map((r) => ({
      clave: r.clave,
      descripcion: r.descripcion ?? r.clave,
      precio: r.precio,
      incluida: false,
    })),
  };
}

function formularioDesdePresupuesto(leido: PresupuestoLeido, catalogo: CatalogoRow[]): CobertorForm {
  const base = formularioDesdeCatalogo(catalogo);
  const { presupuesto, preciosCongelados, clavesIncluidas } = leido;
  const medidas = presupuesto.medidas as { largo?: number; ancho?: number; adicionalM2?: number };

  const comunes = {
    fecha: presupuesto.fecha,
    validezDias: presupuesto.validezDias,
    cliente: presupuesto.cliente,
    detalle: presupuesto.detalle,
    largo: Number(medidas.largo ?? 0),
    ancho: Number(medidas.ancho ?? 0),
    adicionalM2: Number(medidas.adicionalM2 ?? 0),
    modoPrecio: presupuesto.modoPrecio,
  };

  if (!preciosCongelados) {
    return {
      ...base,
      ...comunes,
      opcionales: base.opcionales.map((o) => ({ ...o, incluida: clavesIncluidas.includes(o.clave) })),
    };
  }

  const adicionales = presupuesto.lineas
    .filter((l) => l.naturaleza === "cotiza")
    .map((l) => ({ descripcion: l.descripcion, precio: l.precioUnitario ?? 0 }));

  const congeladasPorClave = new Map(
    presupuesto.lineas
      .filter((l): l is LineaPresupuesto & { clave: string } => l.naturaleza === "informativa" && !!l.clave)
      .map((l) => [l.clave, l])
  );

  return {
    ...comunes,
    precioPorM2HastaUmbral: presupuesto.preciosBase.precioPorM2HastaUmbral ?? base.precioPorM2HastaUmbral,
    precioPorM2SobreUmbral: presupuesto.preciosBase.precioPorM2SobreUmbral ?? base.precioPorM2SobreUmbral,
    precioInstalacion: presupuesto.preciosBase.precioInstalacion ?? base.precioInstalacion,
    adicionales,
    opcionales: base.opcionales.map((o) => {
      const congelada = congeladasPorClave.get(o.clave);
      return congelada
        ? {
            clave: o.clave,
            descripcion: congelada.descripcion,
            precio: congelada.precioUnitario,
            incluida: congelada.incluida,
          }
        : o;
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

export function CobertorCalculadora({
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

  const textos = useMemo(() => leerTextosCompartidos(catalogo, TEXTOS_POR_DEFECTO_COBERTORES), [catalogo]);

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
  } = useZodForm(CobertorFormSchema, {
    defaultValues: presupuestoInicial
      ? formularioDesdePresupuesto(presupuestoInicial, catalogo)
      : formularioDesdeCatalogo(catalogo),
  });

  const adicionales = useFieldArray({ control, name: "adicionales" });
  const opcionales = useFieldArray({ control, name: "opcionales" });

  const valoresForm = useWatch({ control });
  const largo = valoresForm.largo;
  const ancho = valoresForm.ancho;
  const adicionalM2 = valoresForm.adicionalM2;
  const precioHastaUmbral = valoresForm.precioPorM2HastaUmbral;
  const precioSobreUmbral = valoresForm.precioPorM2SobreUmbral;
  const precioInstalacion = valoresForm.precioInstalacion;
  const modoPrecio = valoresForm.modoPrecio ?? "ambos";
  const adicionalesEnVivo = valoresForm.adicionales;
  const opcionalesEnVivo = valoresForm.opcionales;

  const resultado = useMemo(
    () =>
      calcularCobertor({
        largo: largo ?? 0,
        ancho: ancho ?? 0,
        adicionalM2: adicionalM2 ?? 0,
        precioPorM2HastaUmbral: precioHastaUmbral ?? 0,
        precioPorM2SobreUmbral: precioSobreUmbral ?? 0,
        precioInstalacion: precioInstalacion ?? 0,
        adicionales: (adicionalesEnVivo ?? [])
          .filter((a): a is NonNullable<typeof a> => !!a)
          .map((a) => ({ descripcion: a?.descripcion ?? "", precio: a?.precio ?? 0 })),
      }),
    [largo, ancho, adicionalM2, precioHastaUmbral, precioSobreUmbral, precioInstalacion, adicionalesEnVivo]
  );
  const totales = totalesAMostrar(resultado, modoPrecio);

  const snapshotEnVivo: PresupuestoV1 = useMemo(() => {
    const lineasAdicionales = (adicionalesEnVivo ?? [])
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
    const lineasOpcionales = (opcionalesEnVivo ?? [])
      .filter((o): o is NonNullable<typeof o> => !!o)
      .map((o) =>
        crearLinea({
          clave: o.clave ?? null,
          descripcion: o.descripcion ?? "",
          unidad: null,
          cantidad: 1,
          precioUnitario: o.precio ?? null,
          naturaleza: "informativa",
          incluida: !!o.incluida,
          origen: "catalogo",
        })
      );
    return PresupuestoV1.parse({
      v: 1,
      tipo: "cobertores",
      fecha: valoresForm.fecha ?? "",
      validezDias: valoresForm.validezDias ?? "",
      cliente: valoresForm.cliente ?? {},
      medidas: { largo: largo ?? 0, ancho: ancho ?? 0, adicionalM2: adicionalM2 ?? 0 },
      lineas: [...lineasAdicionales, ...lineasOpcionales],
      preciosBase: {
        precioPorM2HastaUmbral: precioHastaUmbral ?? 0,
        precioPorM2SobreUmbral: precioSobreUmbral ?? 0,
        precioInstalacion: precioInstalacion ?? 0,
      },
      totales,
      detalle: valoresForm.detalle ?? "",
      variacionEncabezado: "teal",
      modoPrecio,
      fotos: fotos.map((f) => ({ id: f.id, caption: f.caption, width: f.width, height: f.height, storageUrl: f.storageUrl })),
    });
  }, [
    adicionalesEnVivo,
    opcionalesEnVivo,
    valoresForm,
    largo,
    ancho,
    adicionalM2,
    precioHastaUmbral,
    precioSobreUmbral,
    precioInstalacion,
    totales,
    modoPrecio,
    fotos,
  ]);

  async function onSubmit(valores: CobertorForm) {
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
        const { url, error } = await subirFotoPresupuesto("cobertores", f.blob);
        if (error) throw error;
        fotosSubidas.push({ ...f, storageUrl: url ?? null });
      }
      setFotos(fotosSubidas);

      const r = calcularCobertor({
        largo: valores.largo,
        ancho: valores.ancho,
        adicionalM2: valores.adicionalM2,
        precioPorM2HastaUmbral: valores.precioPorM2HastaUmbral,
        precioPorM2SobreUmbral: valores.precioPorM2SobreUmbral,
        precioInstalacion: valores.precioInstalacion,
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
        tipo: "cobertores",
        fecha: valores.fecha,
        validezDias: valores.validezDias,
        cliente: valores.cliente,
        medidas: { largo: valores.largo, ancho: valores.ancho, adicionalM2: valores.adicionalM2 },
        lineas: [...lineasAdicionales, ...lineasOpcionales],
        preciosBase: {
          precioPorM2HastaUmbral: valores.precioPorM2HastaUmbral,
          precioPorM2SobreUmbral: valores.precioPorM2SobreUmbral,
          precioInstalacion: valores.precioInstalacion,
        },
        totales: totalesFinales,
        detalle: valores.detalle,
        variacionEncabezado: "teal",
        modoPrecio: valores.modoPrecio,
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
        : await guardarPresupuesto("cobertores", snapshot, valores.cliente.nombre);
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
      const blob = await generarDocxCobertores(
        snapshotEnVivo,
        fotosConBlob.map((f) => ({ id: f.id, blob: f.blob, caption: f.caption, width: f.width, height: f.height })),
        textos
      );
      const nombreArchivo = armarNombreArchivo("Cobertor", snapshotEnVivo.cliente.nombre, snapshotEnVivo.fecha);
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
    imprimirConNombre(armarNombreArchivo("Cobertor", snapshotEnVivo.cliente.nombre, snapshotEnVivo.fecha));
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
          <TextField
            register={register}
            errors={errors}
            name="detalle"
            label="Notas de la pileta (forma, detalles)"
            multiline
            rows={3}
            placeholder="Ej: pileta rectangular, esquinas rectas, sin escalera romana."
          />
          <TextField register={register} errors={errors} name="fecha" label="Fecha" />
          <TextField register={register} errors={errors} name="validezDias" label="Validez (días)" />
        </section>

        <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Cálculo</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField control={control} name="largo" label="Largo pileta (m)" required />
            <NumberField control={control} name="ancho" label="Ancho pileta (m)" required />
          </div>
          <NumberField
            control={control}
            name="adicionalM2"
            label="Adicional (m²)"
            hint="Para cubrir más allá del espejo de agua."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MoneyField control={control} name="precioPorM2HastaUmbral" label="Precio /m² (≤15 m²)" emptyValue="zero" required />
            <MoneyField control={control} name="precioPorM2SobreUmbral" label="Precio /m² (>15 m²)" emptyValue="zero" required />
          </div>
          <MoneyField control={control} name="precioInstalacion" label="Precio instalación (fijo)" emptyValue="zero" required />
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
          <DocumentoCobertor
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
