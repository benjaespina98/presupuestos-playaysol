"use client";

import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useWatch } from "react-hook-form";
import { useZodForm } from "@/lib/forms/useZodForm";
import { MoneyField, NumberField, TextField, CheckboxField } from "@/components/form";
import { calcularPiscina, importesAMostrar } from "@/lib/domain/precios/piscinas";
import { crearLinea, type LineaPresupuesto } from "@/lib/domain/precios/tipos";
import { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import type { PresupuestoLeido } from "@/lib/domain/presupuesto/adaptadores";
import { guardarPresupuesto, actualizarPresupuesto, subirFotoPresupuesto } from "@/lib/presupuestos";
import { formatARS } from "@/lib/format/ars";
import type { CatalogoRow } from "@/lib/catalogo";
import { esTextoCompartido } from "@/lib/domain/catalogo/categorias";
import { leerTextosCompartidos } from "@/lib/documentos/textosCompartidos";
import { TEXTOS_POR_DEFECTO_PISCINAS, generarDocxPiscinas } from "@/lib/documentos/piscinas/docx";
import { armarNombreArchivo } from "@/lib/documentos/nombreArchivo";
import { imprimirConNombre } from "@/lib/documentos/imprimir";
import { redimensionarImagen, MAX_DIM_SUBIDA, CALIDAD_SUBIDA } from "@/lib/documentos/imagenes";
import { DocumentoPiscina } from "./DocumentoPiscina";
import { PiscinaFormSchema, formularioVacio, type PiscinaForm } from "./schema";

function esOpcionalCatalogo(r: CatalogoRow): boolean {
  return !esTextoCompartido(r.clave);
}

function formularioDesdeCatalogo(catalogo: CatalogoRow[]): PiscinaForm {
  const base = formularioVacio();
  return {
    ...base,
    opcionales: catalogo.filter(esOpcionalCatalogo).map((r) => ({
      clave: r.clave,
      descripcion: r.descripcion ?? r.clave,
      precio: r.precio,
      incluida: false,
    })),
  };
}

function formularioDesdePresupuesto(leido: PresupuestoLeido, catalogo: CatalogoRow[]): PiscinaForm {
  const base = formularioDesdeCatalogo(catalogo);
  const { presupuesto, preciosCongelados, clavesIncluidas } = leido;

  const medidas = presupuesto.medidas as { largo?: unknown; ancho?: unknown };
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const comunes = {
    fecha: presupuesto.fecha,
    validezDias: presupuesto.validezDias,
    cliente: presupuesto.cliente,
    detalle: presupuesto.detalle,
    largo: num(medidas.largo),
    ancho: num(medidas.ancho),
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
    subtotal: presupuesto.totales[0] ?? 0,
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

export function PiscinaCalculadora({
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

  const textos = useMemo(() => leerTextosCompartidos(catalogo, TEXTOS_POR_DEFECTO_PISCINAS), [catalogo]);

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
  } = useZodForm(PiscinaFormSchema, {
    defaultValues: presupuestoInicial
      ? formularioDesdePresupuesto(presupuestoInicial, catalogo)
      : formularioDesdeCatalogo(catalogo),
  });

  const adicionales = useFieldArray({ control, name: "adicionales" });
  const opcionales = useFieldArray({ control, name: "opcionales" });

  const valoresForm = useWatch({ control });
  const subtotal = valoresForm.subtotal;
  const adicionalesEnVivo = valoresForm.adicionales;
  const opcionalesEnVivo = valoresForm.opcionales;

  const resultado = useMemo(
    () =>
      calcularPiscina({
        subtotal: subtotal ?? 0,
        adicionales: (adicionalesEnVivo ?? [])
          .filter((a): a is NonNullable<typeof a> => !!a)
          .map((a) => ({ descripcion: a?.descripcion ?? "", precio: a?.precio ?? 0 })),
      }),
    [subtotal, adicionalesEnVivo]
  );
  const importes = importesAMostrar(resultado);

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
      tipo: "piscinas",
      fecha: valoresForm.fecha ?? "",
      validezDias: valoresForm.validezDias ?? "",
      cliente: valoresForm.cliente ?? {},
      medidas: { largo: valoresForm.largo ?? 0, ancho: valoresForm.ancho ?? 0 },
      lineas: [...lineasAdicionales, ...lineasOpcionales],
      preciosBase: {},
      totales: importes,
      detalle: valoresForm.detalle ?? "",
      variacionEncabezado: "teal",
      modoPrecio: "ambos",
      fotos: fotos.map((f) => ({ id: f.id, caption: f.caption, width: f.width, height: f.height, storageUrl: f.storageUrl })),
    });
  }, [adicionalesEnVivo, opcionalesEnVivo, valoresForm, importes, fotos]);

  async function onSubmit(valores: PiscinaForm) {
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
        const { url, error } = await subirFotoPresupuesto("piscinas", f.blob);
        if (error) throw error;
        fotosSubidas.push({ ...f, storageUrl: url ?? null });
      }
      setFotos(fotosSubidas);

      const r = calcularPiscina({ subtotal: valores.subtotal, adicionales: valores.adicionales });
      const importesFinales = importesAMostrar(r);

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
        tipo: "piscinas",
        fecha: valores.fecha,
        validezDias: valores.validezDias,
        cliente: valores.cliente,
        medidas: { largo: valores.largo, ancho: valores.ancho },
        lineas: [...lineasAdicionales, ...lineasOpcionales],
        preciosBase: {},
        totales: importesFinales,
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
        : await guardarPresupuesto("piscinas", snapshot, valores.cliente.nombre);
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
      const blob = await generarDocxPiscinas(
        snapshotEnVivo,
        fotosConBlob.map((f) => ({ id: f.id, blob: f.blob, caption: f.caption, width: f.width, height: f.height })),
        textos
      );
      const nombreArchivo = armarNombreArchivo("Piscina", snapshotEnVivo.cliente.nombre, snapshotEnVivo.fecha);
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
    imprimirConNombre(armarNombreArchivo("Piscina", snapshotEnVivo.cliente.nombre, snapshotEnVivo.fecha));
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div data-print-hide="" className="space-y-6">
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
          <TextField register={register} errors={errors} name="detalle" label="Dimensión piscina" multiline rows={4} />

          <div>
            <div className="grid grid-cols-2 gap-4">
              <NumberField control={control} name="largo" label="Largo (m)" />
              <NumberField control={control} name="ancho" label="Ancho (m)" />
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              Informativo por ahora — no cambia el Subtotal ni el texto de arriba.
              {!!valoresForm.largo && !!valoresForm.ancho && (
                <> {" "}Área aprox.: {(valoresForm.largo * valoresForm.ancho).toLocaleString("es-AR")} m².</>
              )}
            </p>
          </div>

          <TextField register={register} errors={errors} name="fecha" label="Fecha" />
          <TextField register={register} errors={errors} name="validezDias" label="Validez (días)" />
        </section>

        <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Ítems</h2>
          <MoneyField control={control} name="subtotal" label="Subtotal construcción piscina" emptyValue="zero" required />

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Adicionales incluidos en el total
            </h3>
            <p className="mb-2 text-xs text-gray-500">Solo lo que va sumado al total. Lo demás va en Opcionales.</p>
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
              Todos los opcionales salen en el documento. Tildá los que cotizás con precio; los destildados
              salen igual, como &quot;No incluye&quot;.
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

        <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          {errorGuardado && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              No se pudo guardar: {errorGuardado}
            </p>
          )}
          {guardadoOk && !errorGuardado && (
            <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              Presupuesto guardado en la nube.
            </p>
          )}
          {errorWord && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              No se pudo generar el Word: {errorWord}
            </p>
          )}
          <button
            type="submit"
            disabled={guardando}
            className="min-h-11 w-full rounded-md bg-[#1B3A5C] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#142c46] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Guardar en la nube"}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onDescargarWord}
              disabled={generandoWord}
              className="min-h-11 rounded-md border border-[#1B3A5C] px-4 text-sm font-medium text-[#1B3A5C] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generandoWord ? "Generando..." : "Word"}
            </button>
            <button
              type="button"
              onClick={onImprimir}
              className="min-h-11 rounded-md border border-[#1B3A5C] px-4 text-sm font-medium text-[#1B3A5C]"
            >
              PDF / Imprimir
            </button>
          </div>
        </section>
      </div>

      <div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm print:border-0 print:p-0 print:shadow-none">
          <DocumentoPiscina
            snapshot={snapshotEnVivo}
            textos={textos}
            fotos={fotos.map((f) => ({ id: f.id, url: f.url, caption: f.caption }))}
          />
        </div>
      </div>
    </form>
  );
}
