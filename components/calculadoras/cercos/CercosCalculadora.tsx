"use client";

import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useWatch } from "react-hook-form";
import { useZodForm } from "@/lib/forms/useZodForm";
import { MoneyField, NumberField, TextField, SelectField, CheckboxField } from "@/components/form";
import { calcularCerco, totalesAMostrar } from "@/lib/domain/precios/cercos";
import { crearLinea, type LineaPresupuesto } from "@/lib/domain/precios/tipos";
import { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import type { PresupuestoLeido } from "@/lib/domain/presupuesto/adaptadores";
import { guardarPresupuesto, actualizarPresupuesto, subirFotoPresupuesto } from "@/lib/presupuestos";
import { formatARS } from "@/lib/format/ars";
import type { CatalogoRow } from "@/lib/catalogo";
import { esTextoCompartido } from "@/lib/domain/catalogo/categorias";
import { leerTextosCompartidos } from "@/lib/documentos/textosCompartidos";
import { TEXTOS_POR_DEFECTO_CERCOS, generarDocxCercos } from "@/lib/documentos/cercos/docx";
import { armarNombreArchivo } from "@/lib/documentos/nombreArchivo";
import { imprimirConNombre } from "@/lib/documentos/imprimir";
import { redimensionarImagen, MAX_DIM_SUBIDA, CALIDAD_SUBIDA } from "@/lib/documentos/imagenes";
import { DocumentoCerco } from "./DocumentoCerco";
import { CercosFormSchema, formularioVacio, type CercosForm } from "./schema";
import { AccionesDocumento } from "@/components/calculadoras/AccionesDocumento";
import { FloatingSaveBar } from "@/components/calculadoras/FloatingSaveBar";
import { CamposObligatoriosHint } from "@/components/calculadoras/CamposObligatoriosHint";

const CLAVE_PRECIO_SIN = "precioSin";
const CLAVE_PRECIO_CON = "precioCon";

function esOpcionalCatalogo(r: CatalogoRow): boolean {
  return r.clave !== CLAVE_PRECIO_SIN && r.clave !== CLAVE_PRECIO_CON && !esTextoCompartido(r.clave);
}

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
    opcionales: catalogo.filter(esOpcionalCatalogo).map((r) => ({
      clave: r.clave,
      descripcion: r.descripcion ?? r.clave,
      precio: r.precio,
      incluida: false,
    })),
  };
}

/**
 * Valores por defecto a partir de un presupuesto existente (editar/duplicar).
 *
 *   v1 (preciosCongelados)  → adicionales/opcionales salen de `lineas`, ya
 *                             congeladas: no dependen del catálogo de hoy.
 *   v0 (no congelados)      → se rehidratan del catálogo vigente; los
 *                             adicionales NO se recuperan (v0 no los guardó
 *                             en un lugar que `leerPresupuesto` traiga — ver
 *                             adaptadores.test.ts, contrato ya aprobado en
 *                             Fase 2, no algo para "arreglar" acá).
 */
function formularioDesdePresupuesto(leido: PresupuestoLeido, catalogo: CatalogoRow[]): CercosForm {
  const base = formularioDesdeCatalogo(catalogo);
  const { presupuesto, preciosCongelados, clavesIncluidas } = leido;
  const medidas = presupuesto.medidas as { metrosLineales?: number };

  const comunes = {
    fecha: presupuesto.fecha,
    validezDias: presupuesto.validezDias,
    cliente: presupuesto.cliente,
    detalle: presupuesto.detalle,
    metrosLineales: Number(medidas.metrosLineales ?? 0),
    modoPrecio: presupuesto.modoPrecio,
  };

  if (!preciosCongelados) {
    return {
      ...base,
      ...comunes,
      opcionales: base.opcionales.map((o) => ({
        ...o,
        incluida: clavesIncluidas.includes(o.clave),
      })),
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
    precioPorMlSinInstalacion:
      presupuesto.preciosBase.precioPorMlSinInstalacion ?? base.precioPorMlSinInstalacion,
    precioPorMlConInstalacion:
      presupuesto.preciosBase.precioPorMlConInstalacion ?? base.precioPorMlConInstalacion,
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
      // Sin conexión o la foto ya no está: se saltea en vez de romper la carga
      // del resto del presupuesto (mismo criterio que aplicarPresupuestoAlState).
    }
  }
  return resultado;
}

export function CercosCalculadora({
  catalogo,
  presupuestoId = null,
  presupuestoInicial = null,
}: {
  catalogo: CatalogoRow[];
  /** Sólo se pasa al EDITAR uno existente (?id=) — duplicar siempre crea uno
   *  nuevo, así que viaja con `presupuestoId: null`. */
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

  const textos = useMemo(() => leerTextosCompartidos(catalogo, TEXTOS_POR_DEFECTO_CERCOS), [catalogo]);

  useEffect(() => {
    if (!presupuestoInicial) return;
    let cancelado = false;
    fotosIniciales(presupuestoInicial.presupuesto.fotos).then((f) => {
      if (!cancelado) setFotos(f);
    });
    return () => {
      cancelado = true;
    };
    // Sólo se carga una vez, al montar con el presupuesto que vino por props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useZodForm(CercosFormSchema, {
    defaultValues: presupuestoInicial
      ? formularioDesdePresupuesto(presupuestoInicial, catalogo)
      : formularioDesdeCatalogo(catalogo),
  });

  const adicionales = useFieldArray({ control, name: "adicionales" });
  const opcionales = useFieldArray({ control, name: "opcionales" });

  const valoresForm = useWatch({ control });
  const metrosLineales = valoresForm.metrosLineales;
  const precioSin = valoresForm.precioPorMlSinInstalacion;
  const precioCon = valoresForm.precioPorMlConInstalacion;
  const modoPrecio = valoresForm.modoPrecio ?? "ambos";
  const adicionalesEnVivo = valoresForm.adicionales;
  const opcionalesEnVivo = valoresForm.opcionales;

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
          .map((a) => ({ descripcion: a?.descripcion ?? "", precio: a?.precio ?? 0 })),
      }),
    [metrosLineales, precioSin, precioCon, adicionalesEnVivo]
  );
  const totales = totalesAMostrar(resultado, modoPrecio);

  /** El mismo snapshot que se guardaría si se apretara "Guardar" ahora mismo,
   *  recalculado en vivo — es lo que alimenta la vista previa y el Word/PDF,
   *  para que sea SIEMPRE lo mismo que se ve en pantalla (nunca se genera un
   *  documento con datos de un estado viejo). */
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
      tipo: "cercos",
      fecha: valoresForm.fecha ?? "",
      validezDias: valoresForm.validezDias ?? "",
      cliente: valoresForm.cliente ?? {},
      medidas: { metrosLineales: metrosLineales ?? 0 },
      lineas: [...lineasAdicionales, ...lineasOpcionales],
      preciosBase: {
        precioPorMlSinInstalacion: precioSin ?? 0,
        precioPorMlConInstalacion: precioCon ?? 0,
      },
      totales,
      detalle: valoresForm.detalle ?? "",
      variacionEncabezado: "teal",
      modoPrecio,
      fotos: fotos.map((f) => ({ id: f.id, caption: f.caption, width: f.width, height: f.height, storageUrl: f.storageUrl })),
    });
  }, [adicionalesEnVivo, opcionalesEnVivo, valoresForm, metrosLineales, precioSin, precioCon, totales, modoPrecio, fotos]);

  async function onSubmit(valores: CercosForm) {
    setGuardando(true);
    setErrorGuardado(null);
    setGuardadoOk(false);
    try {
      // Fotos nuevas (sin storageUrl todavía) se suben a Storage recién al
      // guardar — evita subir algo que la persona termina descartando.
      const fotosSubidas: FotoEnEdicion[] = [];
      for (const f of fotos) {
        if (f.storageUrl || !f.blob) {
          fotosSubidas.push(f);
          continue;
        }
        const { url, error } = await subirFotoPresupuesto("cercos", f.blob);
        if (error) throw error;
        fotosSubidas.push({ ...f, storageUrl: url ?? null });
      }
      setFotos(fotosSubidas);

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
        : await guardarPresupuesto("cercos", snapshot, valores.cliente.nombre);
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
            {
              id: crypto.randomUUID(),
              blob,
              url: URL.createObjectURL(blob),
              caption: "",
              width,
              height,
              storageUrl: null,
            },
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
      const blob = await generarDocxCercos(
        snapshotEnVivo,
        fotosConBlob.map((f) => ({ id: f.id, blob: f.blob, caption: f.caption, width: f.width, height: f.height })),
        textos
      );
      const nombreArchivo = armarNombreArchivo("Cerco", snapshotEnVivo.cliente.nombre, snapshotEnVivo.fecha);
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
    imprimirConNombre(armarNombreArchivo("Cerco", snapshotEnVivo.cliente.nombre, snapshotEnVivo.fecha));
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
            label="Detalle del recorrido a cercar"
            multiline
            rows={3}
            placeholder="Ej: perímetro completo de la piscina, incluye tramo de acceso lateral."
          />
          <TextField register={register} errors={errors} name="fecha" label="Fecha" />
          <TextField register={register} errors={errors} name="validezDias" label="Validez (días)" />
        </section>

        <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Cálculo</h2>
          <NumberField control={control} name="metrosLineales" label="Metros lineales a cercar (ml)" placeholder="Ej: 24" required />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MoneyField
              control={control}
              name="precioPorMlSinInstalacion"
              label="Precio /ml sin instalación"
              emptyValue="zero"
              required
            />
            <MoneyField
              control={control}
              name="precioPorMlConInstalacion"
              label="Precio /ml con instalación"
              emptyValue="zero"
              required
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
          <DocumentoCerco
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
