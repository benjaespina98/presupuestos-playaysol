"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { actualizarPreciosMateriales, listarMateriales, listarProveedores, type CambioPrecioMaterial } from "@/lib/abastecimiento";
import { actualizarPreciosItems, listarItemsCatalogo } from "@/lib/catalogo";
import { ordenarMateriales, RUBROS_MATERIAL, type Material } from "@/lib/domain/abastecimiento/material";
import type { Proveedor } from "@/lib/domain/abastecimiento/proveedor";
import { agruparParaListado, type ItemCatalogo } from "@/lib/domain/catalogo/item";
import { nombreCortoLista } from "@/lib/domain/catalogo/listas";
import { SECCIONES, seccionDeItem } from "@/lib/domain/catalogo/secciones";
import {
  aplicarPorcentaje,
  cambiosPendientes,
  emparejarLista,
  leerListaPegada,
  interpretarPorcentaje,
  textoVariacion,
  variacionPorcentual,
} from "@/lib/domain/precios/actualizacion";
import { formatARS } from "@/lib/format/ars";
import { PanelPortal } from "@/components/PanelPortal";
import { EncabezadoPagina } from "@/components/catalogo/EncabezadoPagina";
import { Toast } from "@/components/ui/BarraListado";
import { SelectorSimple } from "@/components/ui/SelectorSimple";
import { botonDe } from "@/components/ui/botones";

type Que = "materiales" | "ventas";

/** Una fila editable, igual para materiales y para precios de venta. */
interface Fila {
  id: string;
  nombre: string;
  /** El proveedor (materiales) o la unidad (ventas): lo que ayuda a reconocerla. */
  detalle: string;
  /** Título del bloque donde se muestra (rubro / sección). */
  grupo: string;
  actual: number | null;
  unidad: string | null;
  /** Se cotiza en dólares: lo que se edita es el USD de referencia, no los pesos. */
  enUsd: boolean;
}

const CLASE_CAMPO =
  "min-h-12 w-full rounded-lg border bg-[#FFFFFF] px-3 py-2 text-base text-gray-900 shadow-sm placeholder:text-[#6B7680] focus:outline-none focus:ring-2 focus:ring-[#244B5A]/20";

export default function ActualizarPreciosPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-[#4A5861]">Cargando…</p>}>
      <ActualizarPrecios />
    </Suspense>
  );
}

function ActualizarPrecios() {
  const router = useRouter();
  const params = useSearchParams();
  const que: Que = params.get("que") === "ventas" ? "ventas" : "materiales";

  const [materiales, setMateriales] = useState<Material[] | null>(null);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [items, setItems] = useState<ItemCatalogo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [rubro, setRubro] = useState("");
  const [seccion, setSeccion] = useState("");
  const [tipeado, setTipeado] = useState<Record<string, string>>({});
  const [porcentaje, setPorcentaje] = useState("");
  const [pegado, setPegado] = useState("");
  const [sinPareja, setSinPareja] = useState<string[]>([]);
  const [confirmando, setConfirmando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [fallos, setFallos] = useState<string[]>([]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const [m, p, i] = await Promise.all([listarMateriales(), listarProveedores(), listarItemsCatalogo()]);
      if (cancelado) return;
      if (m.error) setError(m.error);
      else setMateriales(m.items);
      if (p.items) setProveedores(p.items);
      if (i.error) setError((e) => e ?? i.error);
      else setItems(i.items);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const nombreProveedor = useMemo(() => new Map(proveedores.map((p) => [p.id, p.nombre])), [proveedores]);

  /** Todas las filas de la lista elegida (activas), con sus bloques, antes de buscar y filtrar. */
  const todas = useMemo<Fila[] | null>(() => {
    if (que === "materiales") {
      if (!materiales) return null;
      return ordenarMateriales(materiales.filter((m) => m.activo)).map((m) => {
        const enUsd = m.usd_ref !== null && m.usd_ref > 0;
        return {
          id: m.id,
          nombre: m.nombre,
          detalle: m.proveedor_id ? (nombreProveedor.get(m.proveedor_id) ?? "Sin proveedor") : "Sin proveedor",
          grupo: m.rubro ?? "Sin rubro",
          actual: enUsd ? m.usd_ref : m.precio,
          unidad: m.unidad,
          enUsd,
        };
      });
    }
    if (!items) return null;
    return agruparParaListado(items.filter((i) => i.activo)).flatMap((g) =>
      g.items.map((i) => ({
        id: i.id,
        nombre: nombreCortoLista(i.clave) ?? (i.descripcion?.split("—")[0]?.trim() || i.descripcion || i.clave),
        detalle: i.descripcion?.includes("—") ? i.descripcion.split("—")[1].trim() : "",
        grupo: g.titulo,
        actual: i.precio,
        unidad: i.unidad,
        enUsd: false,
      }))
    );
  }, [que, materiales, items, nombreProveedor]);

  const seccionPorId = useMemo(() => new Map((items ?? []).map((i) => [i.id, seccionDeItem(i)])), [items]);
  const proveedorPorMaterial = useMemo(() => new Map((materiales ?? []).map((m) => [m.id, m.proveedor_id])), [materiales]);
  const rubroPorMaterial = useMemo(() => new Map((materiales ?? []).map((m) => [m.id, m.rubro ?? "Sin rubro"])), [materiales]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (todas ?? []).filter((f) => {
      if (q && !`${f.nombre} ${f.detalle}`.toLowerCase().includes(q)) return false;
      if (que === "materiales") {
        if (proveedorId && proveedorPorMaterial.get(f.id) !== proveedorId) return false;
        if (rubro && rubroPorMaterial.get(f.id) !== rubro) return false;
      } else if (seccion && seccionPorId.get(f.id) !== seccion) return false;
      return true;
    });
  }, [todas, busqueda, que, proveedorId, rubro, seccion, proveedorPorMaterial, rubroPorMaterial, seccionPorId]);

  const grupos = useMemo(() => {
    const m = new Map<string, Fila[]>();
    for (const f of visibles) m.set(f.grupo, [...(m.get(f.grupo) ?? []), f]);
    return [...m.entries()];
  }, [visibles]);

  // Los cambios se calculan sobre TODAS las filas (no sólo las visibles): filtrar después de tipear no pierde nada.
  const { cambios, invalidas } = useMemo(() => cambiosPendientes(todas ?? [], tipeado), [todas, tipeado]);
  const invalidasSet = useMemo(() => new Set(invalidas), [invalidas]);
  const cambiosPorId = useMemo(() => new Map(cambios.map((c) => [c.id, c])), [cambios]);

  const cerrarAviso = useCallback(() => setAviso(null), []);

  function cambiarQue(nuevo: Que) {
    if (nuevo === que) return;
    if (cambios.length > 0 && !window.confirm("Hay precios sin guardar: si cambiás de lista se descartan. ¿Cambiar igual?")) return;
    setTipeado({});
    setConfirmando(false);
    setFallos([]);
    setBusqueda("");
    setPegado("");
    setSinPareja([]);
    router.replace(`/dashboard/catalogo/actualizar-precios?que=${nuevo}`);
  }

  const pct = interpretarPorcentaje(porcentaje);
  const hayPrecios = visibles.filter((f) => f.actual !== null && f.actual > 0);

  function aplicarAjuste() {
    if (pct === null) return;
    setTipeado((prev) => {
      const siguiente = { ...prev };
      for (const f of hayPrecios) siguiente[f.id] = String(aplicarPorcentaje(f.actual as number, pct));
      return siguiente;
    });
    setConfirmando(false);
    setAviso(`Se calculó ${textoVariacion(pct)} sobre ${hayPrecios.length} ${hayPrecios.length === 1 ? "precio" : "precios"}. Todavía no se guardó nada.`);
  }

  /** Lee la lista pegada y completa el precio de cada fila que reconoce; lo que no reconoce se lista aparte. */
  function cargarListaPegada() {
    const lineas = leerListaPegada(pegado);
    const { asignados, sinPareja: sin } = emparejarLista(lineas, todas ?? []);
    const n = Object.keys(asignados).length;
    setTipeado((prev) => ({ ...prev, ...asignados }));
    setSinPareja(sin.map((s) => (s.motivo === "no existe" ? `${s.nombre} (no está en la lista)` : `${s.nombre} (coincide con varias filas)`)));
    setConfirmando(false);
    setAviso(
      n > 0
        ? `Se completaron ${n} ${n === 1 ? "precio" : "precios"} de la lista pegada. Revisalos abajo: todavía no se guardó nada.`
        : "No se encontró ningún producto de la lista pegada."
    );
    if (n > 0) {
      setBusqueda("");
      setProveedorId("");
      setRubro("");
      setSeccion("");
    }
  }

  async function guardar() {
    setGuardando(true);
    setFallos([]);
    const nombres = new Map((todas ?? []).map((f) => [f.id, f.nombre]));
    let guardados: string[] = [];
    let fallidos: { id: string; error: string }[] = [];
    if (que === "materiales") {
      const filas = new Map((todas ?? []).map((f) => [f.id, f]));
      const lote: CambioPrecioMaterial[] = cambios.map((c) => ({ id: c.id, campo: filas.get(c.id)?.enUsd ? "usd_ref" : "precio", valor: c.nuevo }));
      ({ guardados, fallidos } = await actualizarPreciosMateriales(lote));
      const nuevo = new Map(lote.map((l) => [l.id, l]));
      setMateriales((prev) =>
        prev
          ? prev.map((m) => {
              const l = guardados.includes(m.id) ? nuevo.get(m.id) : undefined;
              return l ? { ...m, [l.campo]: l.valor, precio_actualizado: new Date().toISOString().slice(0, 10) } : m;
            })
          : prev
      );
    } else {
      ({ guardados, fallidos } = await actualizarPreciosItems(cambios.map((c) => ({ id: c.id, precio: c.nuevo }))));
      const nuevo = new Map(cambios.map((c) => [c.id, c.nuevo]));
      setItems((prev) => (prev ? prev.map((i) => (guardados.includes(i.id) ? { ...i, precio: nuevo.get(i.id) ?? i.precio } : i)) : prev));
    }
    // Lo guardado deja de ser "tipeado"; lo que falló queda para reintentar.
    setTipeado((prev) => {
      const siguiente = { ...prev };
      for (const id of guardados) delete siguiente[id];
      return siguiente;
    });
    setFallos(fallidos.map((f) => `${nombres.get(f.id) ?? f.id}: ${f.error}`));
    setAviso(
      guardados.length > 0
        ? `${guardados.length === 1 ? "Se actualizó 1 precio" : `Se actualizaron ${guardados.length} precios`}. En la planilla de costos aparecen en la próxima actualización (cada 5 minutos).`
        : null
    );
    setConfirmando(false);
    setGuardando(false);
  }

  const titulo = que === "materiales" ? "costos de materiales" : "precios de venta";
  const opcionesProveedor = [{ value: "", label: "Todos los proveedores" }, ...proveedores.filter((p) => p.activo).map((p) => ({ value: p.id, label: p.nombre }))];
  const opcionesRubro = [{ value: "", label: "Todos los rubros" }, ...[...RUBROS_MATERIAL, "Sin rubro"].map((r) => ({ value: r, label: r }))];
  const opcionesSeccion = [{ value: "", label: "Todas las categorías" }, ...SECCIONES.map((s) => ({ value: s.id as string, label: s.etiqueta }))];
  const cargando = !error && todas === null;

  return (
    <PanelPortal compacto amplio>
      <EncabezadoPagina titulo="Actualizar precios" descripcion="Cargá varios precios de una vez y guardalos juntos." />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
        <Link
          href={que === "materiales" ? "/dashboard/catalogo/materiales" : "/dashboard/catalogo"}
          className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-[#244B5A] hover:bg-[#EAF0F2]"
        >
          ← Volver a {que === "materiales" ? "Materiales" : "Precios"}
        </Link>
        <div role="group" aria-label="Qué precios actualizar" className="flex gap-2">
          {(
            [
              ["materiales", "Costos de materiales"],
              ["ventas", "Precios de venta"],
            ] as const
          ).map(([id, texto]) => (
            <button
              key={id}
              type="button"
              aria-pressed={que === id}
              onClick={() => cambiarQue(id)}
              className={`min-h-11 rounded-lg border px-3 text-sm font-medium transition-colors ${
                que === id ? "border-[#244B5A] bg-[#244B5A] text-[#FFFFFF] shadow-sm" : "border-gray-200 bg-[#FFFFFF] text-gray-700 hover:bg-gray-50"
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>

      <section aria-label="Cómo cargar" className="mb-4 rounded-lg border border-gray-200 bg-[#FFFFFF] p-4 shadow-sm">
        <p className="mb-3 text-[13px] leading-snug text-[#3E4A52]">
          Escribí el <b>precio nuevo</b> en cada fila que cambió (las que dejás vacías no se tocan), o subí o bajá todo lo que se ve con un porcentaje.
          Nada se guarda hasta que toques <b>Guardar cambios</b>.
        </p>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_minmax(0,14rem)_auto] sm:items-end">
          <div>
            <label htmlFor="ap-buscar" className="mb-1 block text-sm font-medium text-gray-700">
              Buscar
            </label>
            <input id="ap-buscar" type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre" className={CLASE_CAMPO} />
          </div>
          {que === "materiales" ? (
            <>
              <div>
                <label htmlFor="ap-proveedor" className="mb-1 block text-sm font-medium text-gray-700">
                  Proveedor
                </label>
                <SelectorSimple id="ap-proveedor" titulo="Proveedor" valor={proveedorId} opciones={opcionesProveedor} onCambio={setProveedorId} />
              </div>
              <div>
                <label htmlFor="ap-rubro" className="mb-1 block text-sm font-medium text-gray-700">
                  Rubro
                </label>
                <SelectorSimple id="ap-rubro" titulo="Rubro" valor={rubro} opciones={opcionesRubro} onCambio={setRubro} />
              </div>
            </>
          ) : (
            <div className="sm:col-span-2">
              <label htmlFor="ap-seccion" className="mb-1 block text-sm font-medium text-gray-700">
                Categoría
              </label>
              <SelectorSimple id="ap-seccion" titulo="Categoría" valor={seccion} opciones={opcionesSeccion} onCambio={setSeccion} />
            </div>
          )}
          <span className="hidden sm:block" />
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-gray-100 pt-4">
          <div className="min-w-0 flex-1 sm:flex-none">
            <label htmlFor="ap-pct" className="mb-1 block text-sm font-medium text-gray-700">
              Subir o bajar todo (%)
            </label>
            <input
              id="ap-pct"
              inputMode="decimal"
              value={porcentaje}
              onChange={(e) => setPorcentaje(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") aplicarAjuste();
              }}
              placeholder="Ej: 10 o -5"
              className={`${CLASE_CAMPO} sm:w-56`}
            />
          </div>
          <button type="button" onClick={aplicarAjuste} disabled={pct === null || hayPrecios.length === 0} className={botonDe("secundario", "px-4")}>
            Calcular en {hayPrecios.length} {hayPrecios.length === 1 ? "precio" : "precios"}
          </button>
        </div>

        <details className="mt-4 border-t border-gray-100 pt-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-[#244B5A]">Pegar una lista de precios</summary>
          <p className="mb-2 text-[13px] leading-snug text-[#3E4A52]">
            Una línea por producto, con el precio al final (por ejemplo <b>Cemento portland (bolsa 50 kg) 10.780</b>). Se emparejan solos por nombre; lo que
            no se reconoce queda listado para que lo cargues a mano. Nada se guarda hasta que toques <b>Guardar cambios</b>.
          </p>
          <label htmlFor="ap-pegado" className="sr-only">
            Lista de precios
          </label>
          <textarea
            id="ap-pegado"
            rows={5}
            value={pegado}
            onChange={(e) => setPegado(e.target.value)}
            placeholder={"Racionalista 400 — 6.230.000\nRacionalista 450 — 6.830.000"}
            className={CLASE_CAMPO}
          />
          <button type="button" onClick={cargarListaPegada} disabled={pegado.trim() === "" || todas === null} className={botonDe("secundario", "mt-2 px-4")}>
            Cargar la lista
          </button>
          {sinPareja.length > 0 && (
            <div role="status" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <p className="font-semibold">No se pudieron emparejar {sinPareja.length}:</p>
              <ul className="list-disc pl-5">
                {sinPareja.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          )}
        </details>
      </section>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-[#B42318]">
          No se pudo cargar la lista: {error}
        </p>
      )}
      {cargando && <p className="py-6 text-center text-sm text-[#4A5861]">Cargando…</p>}

      {fallos.length > 0 && (
        <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#B42318]">
          <p className="font-semibold">No se pudieron guardar {fallos.length} {fallos.length === 1 ? "precio" : "precios"} (siguen cargados para reintentar):</p>
          <ul className="mt-1 list-disc pl-5">
            {fallos.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {!error && todas && visibles.length === 0 && (
        <p className="rounded-lg border border-dashed border-[#7D8892] px-4 py-10 text-center text-sm text-[#3E4A52]">Ninguna fila coincide con el filtro.</p>
      )}

      {!error && visibles.length > 0 && (
        <div className="rounded-lg border border-[#D9DFE3] bg-[#FFFFFF]">
          <div
            aria-hidden="true"
            className="hidden h-9 grid-cols-[minmax(0,1fr)_9rem_11rem_6rem] items-center gap-x-4 border-b border-[#D9DFE3] bg-[#F1F4F6] px-4 text-[13px] font-semibold uppercase tracking-wide text-[#4A5861] md:grid"
          >
            <span>{que === "materiales" ? "Material" : "Producto"}</span>
            <span className="text-right">Precio actual</span>
            <span>Precio nuevo</span>
            <span className="text-right">Cambio</span>
          </div>
          {grupos.map(([nombre, filas]) => (
            <section key={nombre} aria-label={nombre}>
              <h3 className="flex h-9 items-center gap-1.5 border-y border-[#D9DFE3] bg-[#F4F8F9] px-4 text-[13px] font-bold uppercase tracking-wide text-[#244B5A] first:border-t-0">
                {nombre} <span className="font-normal text-[#4A5861]">({filas.length})</span>
              </h3>
              <ul className="divide-y divide-[#EEF1F3]">
                {filas.map((f) => {
                  const c = cambiosPorId.get(f.id);
                  const invalida = invalidasSet.has(f.id);
                  const v = c ? variacionPorcentual(c.anterior, c.nuevo) : null;
                  const actual = f.actual === null ? null : f.enUsd ? `US$ ${f.actual.toLocaleString("es-AR")}` : formatARS(f.actual);
                  return (
                    <li
                      key={f.id}
                      className={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-4 py-2 md:grid-cols-[minmax(0,1fr)_9rem_11rem_6rem] md:gap-x-4 ${c ? "bg-[#FFFBEB]" : ""}`}
                    >
                      <div className="col-span-2 min-w-0 md:col-span-1">
                        <p className="break-words text-sm font-medium text-gray-900">{f.nombre}</p>
                        <p className="truncate text-[13px] text-[#4A5861]">
                          {[f.detalle, f.unidad ? `por ${f.unidad}` : ""].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <p className="whitespace-nowrap text-sm tabular-nums text-gray-700 md:text-right">
                        <span className="text-[13px] text-[#4A5861] md:hidden">Actual </span>
                        {actual ?? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[13px] font-medium text-amber-800">{que === "materiales" ? "A confirmar" : "A cotizar"}</span>}
                      </p>
                      <div className="col-start-2 row-start-2 flex items-center gap-2 md:col-auto md:row-auto">
                        <input
                          inputMode="decimal"
                          aria-label={`Precio nuevo de ${f.nombre}`}
                          aria-invalid={invalida || undefined}
                          value={tipeado[f.id] ?? ""}
                          placeholder={f.enUsd ? "US$" : "$"}
                          onChange={(e) => {
                            setTipeado((prev) => ({ ...prev, [f.id]: e.target.value }));
                            setConfirmando(false);
                          }}
                          className={`min-h-11 w-full rounded-lg border px-3 py-1.5 text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-[#244B5A]/20 md:w-44 ${
                            invalida ? "border-[#B42318] bg-red-50" : c ? "border-amber-400 bg-amber-50" : "border-gray-300 bg-[#FFFFFF]"
                          }`}
                        />
                      </div>
                      <p className={`text-sm font-semibold tabular-nums md:text-right ${c || invalida ? "" : "max-md:hidden"} ${invalida ? "text-[#B42318]" : v !== null && v < 0 ? "text-[#05603A]" : "text-[#7A3E00]"}`}>
                        {invalida ? "No se entiende" : !c ? "" : v === null ? "Nuevo" : textoVariacion(v)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Barra de guardado: pegada abajo mientras haya algo para guardar. */}
      {(cambios.length > 0 || invalidas.length > 0) && (
        <div
          data-print-hide=""
          className="sticky bottom-0 z-20 -mx-4 mt-4 border-t border-gray-200 bg-[#F8FAFB] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.06)]"
        >
          {invalidas.length > 0 && (
            <p role="alert" className="mb-2 text-sm font-medium text-[#B42318]">
              {invalidas.length === 1 ? "Hay 1 precio que no se entiende" : `Hay ${invalidas.length} precios que no se entienden`}: corregilo para poder guardar.
            </p>
          )}
          {confirmando && (
            <p className="mb-2 text-sm text-gray-800">
              Vas a cambiar <b>{cambios.length}</b> {cambios.length === 1 ? "precio" : "precios"} de {titulo}. Esto actualiza la lista, los pedidos que armes de ahora en más y la planilla de costos.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-auto text-sm tabular-nums text-gray-700">
              <b>{cambios.length}</b> {cambios.length === 1 ? "cambio" : "cambios"} sin guardar
            </p>
            <button
              type="button"
              disabled={guardando}
              onClick={() => {
                setTipeado({});
                setConfirmando(false);
              }}
              className={botonDe("secundario", "px-4")}
            >
              Descartar
            </button>
            {!confirmando ? (
              <button type="button" disabled={guardando || cambios.length === 0 || invalidas.length > 0} onClick={() => setConfirmando(true)} className={botonDe("primario", "px-4")}>
                Guardar cambios
              </button>
            ) : (
              <button type="button" disabled={guardando} onClick={guardar} className={botonDe("primario", "px-4")}>
                {guardando ? "Guardando…" : `Confirmar ${cambios.length} ${cambios.length === 1 ? "cambio" : "cambios"}`}
              </button>
            )}
          </div>
        </div>
      )}

      <Toast mensaje={aviso} onCerrar={cerrarAviso} />
    </PanelPortal>
  );
}
