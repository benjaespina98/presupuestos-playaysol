"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { listarMateriales, listarProveedores } from "@/lib/abastecimiento";
import { TAMANOS, type Material } from "@/lib/domain/abastecimiento/material";
import type { Proveedor } from "@/lib/domain/abastecimiento/proveedor";
import {
  PARAMETROS_POR_DEFECTO,
  armarPedido,
  cantidadDePedido,
  csvPedido,
  mensajeDeGrupo,
  mensajeWhatsApp,
  type AjusteLinea,
  type BordePedido,
  type GrupoPedido,
  type ParametrosPedido,
} from "@/lib/domain/abastecimiento/pedido";
import {
  armarDocumento,
  lineasDePedido,
  numeroFormateado,
  type PedidoGuardado,
} from "@/lib/domain/abastecimiento/pedidoDocumento";
import { exportarPedido, type FormatoPedido, type ModoPedido } from "@/lib/documentos/pedidos/exportar";
import { compartirOdescargarArchivo } from "@/lib/documentos/compartir";
import { guardarPedido, listarPedidos } from "@/lib/pedidos";
import { formatARSExacto } from "@/lib/format/ars";
import { copiarAlPortapapeles } from "@/lib/clipboard";
import { PanelPortal } from "@/components/PanelPortal";
import { Interruptor } from "@/components/catalogo/FiltrosCatalogo";
import { EncabezadoPagina } from "@/components/catalogo/EncabezadoPagina";
import { MenuExportar } from "@/components/pedidos/MenuExportar";

const CLASE_CAMPO =
  "min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20";

const BORDES: BordePedido[] = ["Losetas", "Deck"];

/** Un número que escribió una persona; vacío o inválido = 0 (mínimo 0). */
function numero(texto: string): number {
  const n = Number(texto.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const coma = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

/** Un nombre de archivo seguro: sin tildes ni caracteres que Windows no acepta. */
function nombreArchivo(obra: string, tamano: string): string {
  const limpio = obra
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "_");
  return `Pedido_${limpio ? limpio + "_" : ""}${tamano.replace(".", ",")}.csv`;
}

/**
 * Armar pedido — con `?desde=<id>` se vuelve a armar a partir de un pedido guardado
 * (misma obra y condiciones; las cantidades se recalculan con el catálogo de hoy).
 */
export default function PedidoPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-4 py-8 text-sm text-gray-500">Cargando…</div>}>
      <PedidoContenido />
    </Suspense>
  );
}

type Mensaje = { tipo: "ok" | "aviso" | "error"; texto: string };

function PedidoContenido() {
  const desde = useSearchParams().get("desde");
  const [materiales, setMateriales] = useState<Material[] | null>(null);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [obra, setObra] = useState("");
  const [pide, setPide] = useState("");
  const [params, setParams] = useState<ParametrosPedido>(PARAMETROS_POR_DEFECTO);
  const [ajustes, setAjustes] = useState<Record<string, AjusteLinea>>({});
  const [copiado, setCopiado] = useState<string | null>(null);
  const [notas, setNotas] = useState("");
  const [guardado, setGuardado] = useState<{ pedido: PedidoGuardado; firma: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);

  // Volver a armar a partir de un pedido guardado.
  useEffect(() => {
    if (!desde) return;
    let cancelado = false;
    listarPedidos().then((r) => {
      if (cancelado || !r.items) return;
      const p = r.items.find((x) => x.id === desde);
      if (!p) return;
      setObra(p.obra);
      setPide(p.solicitante);
      setNotas(p.notas ?? "");
      setParams(p.parametros);
      setMensaje({ tipo: "aviso", texto: `Se cargaron los datos de ${numeroFormateado(p.numero)}. Las cantidades se recalcularon con el catálogo de hoy.` });
    });
    return () => {
      cancelado = true;
    };
  }, [desde]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const [m, p] = await Promise.all([listarMateriales(), listarProveedores()]);
      if (cancelado) return;
      if (m.error) setError(m.error);
      else setMateriales(m.items);
      if (p.items) setProveedores(p.items);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const pedido = useMemo(
    () => armarPedido(materiales ?? [], proveedores, params, ajustes),
    [materiales, proveedores, params, ajustes]
  );

  // Lo que la cuenta pide pero se sacó a mano: se puede volver a poner.
  const quitados = useMemo(
    () =>
      (materiales ?? []).filter((m) => m.activo && ajustes[m.id]?.excluido && cantidadDePedido(m, params) > 0),
    [materiales, ajustes, params]
  );

  const cambiar = (cambios: Partial<ParametrosPedido>) => {
    setParams((p) => ({ ...p, ...cambios }));
    // Otro tamaño u opciones = otra cuenta: los ajustes a mano ya no corresponden.
    setAjustes({});
  };

  const ajustar = (id: string, ajuste: AjusteLinea | null) =>
    setAjustes((prev) => {
      const siguiente = { ...prev };
      if (ajuste === null || (ajuste.cantidad === undefined && !ajuste.excluido)) delete siguiente[id];
      else siguiente[id] = ajuste;
      return siguiente;
    });

  const encabezado = { obra, pide };

  // El pedido tal como se guarda y se imprime (la foto de lo que se pide ahora).
  const lineas = useMemo(() => lineasDePedido(pedido), [pedido]);
  const firma = useMemo(
    () => JSON.stringify({ obra: obra.trim(), pide: pide.trim(), notas: notas.trim(), params, lineas }),
    [obra, pide, notas, params, lineas]
  );
  // El pedido guardado sólo vale mientras no cambie nada: si se cambia algo, el siguiente guardado es OTRO pedido.
  const vigente = guardado && guardado.firma === firma ? guardado.pedido : null;

  async function asegurarGuardado(): Promise<{ pedido: PedidoGuardado | null; error: string | null }> {
    if (vigente) return { pedido: vigente, error: null };
    const r = await guardarPedido({ obra, solicitante: pide, parametros: params, lineas, costo: pedido.costo, notas });
    if (r.pedido) setGuardado({ pedido: r.pedido, firma });
    return r;
  }

  async function onGuardar() {
    setOcupado(true);
    setMensaje(null);
    const r = await asegurarGuardado();
    setMensaje(
      r.pedido
        ? { tipo: "ok", texto: `Pedido ${numeroFormateado(r.pedido.numero)} guardado.` }
        : { tipo: "error", texto: r.error ?? "No se pudo guardar el pedido." }
    );
    setOcupado(false);
  }

  /** Genera el archivo formal. Todo documento formal sale con su número: antes de generarlo se guarda el pedido. */
  async function onExportar(formato: FormatoPedido, modo: ModoPedido) {
    setOcupado(true);
    setMensaje(null);
    try {
      const r = await asegurarGuardado();
      const doc = armarDocumento(lineas, {
        numero: r.pedido?.numero ?? null,
        fecha: r.pedido ? new Date(r.pedido.created_at) : new Date(),
        obra,
        solicitante: pide,
        parametros: params,
        observaciones: notas,
      });
      const archivo = await exportarPedido(doc, formato, modo);
      await compartirOdescargarArchivo(archivo.blob, archivo.nombre, archivo.mime);
      setMensaje(
        r.pedido
          ? { tipo: "ok", texto: `${archivo.nombre} generado. Quedó guardado como ${numeroFormateado(r.pedido.numero)}.` }
          : {
              tipo: "aviso",
              texto: `${archivo.nombre} generado como BORRADOR (sin número) porque no se pudo guardar el pedido: ${r.error ?? "error desconocido"}`,
            }
      );
    } catch (err) {
      console.error("No se pudo generar el archivo del pedido", err);
      setMensaje({ tipo: "error", texto: "No se pudo generar el archivo. Probá de nuevo." });
    } finally {
      setOcupado(false);
    }
  }

  async function copiar(clave: string, texto: string) {
    const ok = await copiarAlPortapapeles(texto);
    if (!ok) return;
    setCopiado(clave);
    setTimeout(() => setCopiado((actual) => (actual === clave ? null : actual)), 2000);
  }

  function descargarCsv() {
    const blob = new Blob([csvPedido(pedido)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo(obra, params.tamano);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const hayAjustes = Object.keys(ajustes).length > 0;

  return (
    <PanelPortal compacto>
      <EncabezadoPagina
        titulo="Armar pedido"
        descripcion="Elegí el tamaño de la pileta y las opciones de la obra: te armo qué pedir, cuánto y a quién."
      />

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {!error && materiales === null && <p className="text-sm text-gray-500">Cargando…</p>}

      {!error && materiales !== null && materiales.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
          Todavía no hay materiales cargados.{" "}
          <Link href="/dashboard/catalogo/materiales" className="font-medium text-[#1B3A5C] hover:underline">
            Cargalos en Materiales
          </Link>
          .
        </div>
      )}

      {!error && materiales !== null && materiales.length > 0 && (
        <>
          <section
            data-print-hide=""
            aria-label="Datos de la obra"
            className="mb-5 space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Cliente / obra" id="obra">
                <input id="obra" type="text" value={obra} onChange={(e) => setObra(e.target.value)} placeholder="Ej: Familia Pérez" className={CLASE_CAMPO} />
              </Campo>
              <Campo etiqueta="Pide (quién hace el pedido)" id="pide">
                <input id="pide" type="text" value={pide} onChange={(e) => setPide(e.target.value)} className={CLASE_CAMPO} />
              </Campo>
            </div>

            <Campo etiqueta="Observaciones (salen en el pedido)" id="notas">
              <textarea
                id="notas"
                rows={2}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Ej: Entregar en obra antes del viernes"
                className={CLASE_CAMPO}
              />
            </Campo>

            <div className="grid gap-4 sm:grid-cols-4">
              <Campo etiqueta="Tamaño de pileta" id="tamano">
                <select id="tamano" value={params.tamano} onChange={(e) => cambiar({ tamano: e.target.value })} className={CLASE_CAMPO}>
                  {TAMANOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta="Cantidad de obras" id="obras">
                <input
                  id="obras"
                  type="number"
                  min={1}
                  step={1}
                  // Vacío mientras se escribe; el mínimo de 1 obra lo aplica el cálculo, no el campo.
                  value={params.obras || ""}
                  onChange={(e) => cambiar({ obras: Math.round(numero(e.target.value)) })}
                  className={CLASE_CAMPO}
                />
              </Campo>
              <Campo etiqueta="Cantidad de luces (por pileta)" id="luces">
                <input
                  id="luces"
                  type="number"
                  min={0}
                  step={1}
                  value={params.luces}
                  onChange={(e) => cambiar({ luces: Math.round(numero(e.target.value)) })}
                  className={CLASE_CAMPO}
                />
              </Campo>
              <div role="group" aria-label="Borde (terminación)">
                <p className="mb-1.5 text-sm font-medium text-gray-700">Borde (terminación)</p>
                <div className="flex gap-2">
                  {BORDES.map((b) => (
                    <button
                      key={b}
                      type="button"
                      aria-pressed={params.borde === b}
                      onClick={() => cambiar({ borde: b })}
                      className={`min-h-11 flex-1 rounded-lg border px-3 text-sm font-medium transition-colors ${
                        params.borde === b
                          ? "border-[#1B3A5C] bg-[#1B3A5C] text-white shadow-sm"
                          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-8">
              <Interruptor checked={params.luzCamaAgua} onChange={(v) => cambiar({ luzCamaAgua: v })}>
                Luz en la cama de agua
              </Interruptor>
              <Interruptor checked={params.banoQuimico} onChange={(v) => cambiar({ banoQuimico: v })}>
                Baño químico
              </Interruptor>
            </div>
          </section>

          <section aria-label="Resumen del pedido" className="mb-5 grid gap-3 sm:grid-cols-3">
            <Resumen etiqueta="Artículos a pedir" valor={String(pedido.articulos)} />
            <Resumen etiqueta="Proveedores a contactar" valor={String(pedido.proveedores)} />
            <Resumen
              etiqueta="Costo estimado"
              valor={formatARSExacto(pedido.costo)}
              nota={pedido.sinPrecio > 0 ? `Sin contar ${pedido.sinPrecio} ${pedido.sinPrecio === 1 ? "artículo" : "artículos"} con precio a confirmar` : undefined}
            />
          </section>

          {pedido.articulos === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
              No hay cantidades cargadas para la pileta {params.tamano}. Se cargan en{" "}
              <Link href="/dashboard/catalogo/materiales" className="font-medium text-[#1B3A5C] hover:underline">
                Materiales
              </Link>
              .
            </div>
          ) : (
            <>
              {/* Barra fija: al bajar por una tabla larga, el costo y los botones de exportar siguen a mano. */}
              <div
                data-print-hide=""
                className="-mx-4 mb-4 flex flex-wrap md:sticky md:top-0 md:z-20 items-center gap-x-4 gap-y-2 border-b border-gray-200 bg-gray-50 px-4 py-2.5"
              >
                <p className="mr-auto text-sm tabular-nums text-gray-600">
                  <b className="text-gray-900">{pedido.articulos}</b> artículos · <b className="text-gray-900">{pedido.proveedores}</b> proveedores ·{" "}
                  <b className="text-gray-900">{formatARSExacto(pedido.costo)}</b>
                </p>
                <Accion principal onClick={onGuardar} deshabilitado={ocupado || !!vigente}>
                  {vigente ? `Guardado · ${numeroFormateado(vigente.numero)}` : "Guardar pedido"}
                </Accion>
                <Accion onClick={() => copiar("todo", mensajeWhatsApp(pedido, params, encabezado))}>
                  {copiado === "todo" ? "¡Copiado!" : "Copiar mensaje para WhatsApp"}
                </Accion>
                <MenuExportar onExportar={onExportar} onCsv={descargarCsv} variosProveedores={pedido.grupos.length > 1} ocupado={ocupado} />
                <Accion onClick={() => window.print()}>Imprimir</Accion>
                {hayAjustes && (
                  <button
                    type="button"
                    onClick={() => setAjustes({})}
                    className="min-h-11 rounded-lg px-3 text-sm font-medium text-[#1B3A5C] hover:bg-[#1B3A5C]/8"
                  >
                    Restablecer cantidades
                  </button>
                )}
              </div>

              {mensaje && (
                <p
                  role={mensaje.tipo === "error" ? "alert" : "status"}
                  data-print-hide=""
                  className={`mb-4 rounded-md px-4 py-3 text-sm ${
                    mensaje.tipo === "ok"
                      ? "bg-green-50 text-green-700"
                      : mensaje.tipo === "aviso"
                        ? "bg-amber-50 text-amber-800"
                        : "bg-red-50 text-red-700"
                  }`}
                >
                  {mensaje.texto}
                  {mensaje.tipo === "ok" && vigente && (
                    <>
                      {" "}
                      <Link href="/dashboard/catalogo/pedidos" className="font-medium underline">
                        Ver en Pedidos
                      </Link>
                    </>
                  )}
                </p>
              )}

              <div className="space-y-4">
                {pedido.grupos.map((g) => (
                  <GrupoTabla
                    key={g.proveedor?.id ?? "sin-proveedor"}
                    grupo={g}
                    copiado={copiado === (g.proveedor?.id ?? "sin-proveedor")}
                    onCopiar={() => copiar(g.proveedor?.id ?? "sin-proveedor", mensajeDeGrupo(g))}
                    ajustes={ajustes}
                    onAjustar={ajustar}
                  />
                ))}
              </div>

              {quitados.length > 0 && (
                <section data-print-hide="" aria-label="Materiales quitados" className="mt-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <h2 className="mb-2 text-sm font-semibold text-gray-900">Quitados del pedido</h2>
                  <ul className="space-y-1">
                    {quitados.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-3 text-sm text-gray-600">
                        <span>{m.nombre}</span>
                        <button
                          type="button"
                          onClick={() => ajustar(m.id, null)}
                          aria-label={`Volver a poner ${m.nombre}`}
                          className="min-h-11 rounded-md px-3 font-medium text-[#1B3A5C] hover:bg-[#1B3A5C]/8"
                        >
                          Volver a poner
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </>
      )}
    </PanelPortal>
  );
}

function Campo({ etiqueta, id, children }: { etiqueta: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
        {etiqueta}
      </label>
      {children}
    </div>
  );
}

function Resumen({ etiqueta, valor, nota }: { etiqueta: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{etiqueta}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[#1B3A5C]">{valor}</p>
      {nota && <p className="mt-1 text-xs text-amber-700">{nota}</p>}
    </div>
  );
}

function Accion({
  children,
  onClick,
  principal = false,
  deshabilitado = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  principal?: boolean;
  deshabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      className={`min-h-11 rounded-lg px-4 text-sm font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        principal
          ? "bg-[#1B3A5C] text-white hover:bg-[#142c46]"
          : "border border-gray-200 bg-white text-[#1B3A5C] hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

/** Columnas desde md: artículo · cantidad · precio unit. · subtotal · quitar. */
const COLUMNAS = "md:grid-cols-[minmax(0,1fr)_15rem_8rem_8rem_5.5rem]";

function GrupoTabla({
  grupo,
  copiado,
  onCopiar,
  ajustes,
  onAjustar,
}: {
  grupo: GrupoPedido;
  copiado: boolean;
  onCopiar: () => void;
  ajustes: Record<string, AjusteLinea>;
  onAjustar: (id: string, ajuste: AjusteLinea | null) => void;
}) {
  return (
    <section aria-label={`Pedido a ${grupo.nombre}`} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-gray-200 bg-[#F4F8F9] px-4 py-2.5">
        <div className="mr-auto min-w-0">
          <h2 className="text-sm font-bold text-[#1B3A5C]">{grupo.nombre}</h2>
          {grupo.telefono && <p className="text-xs text-gray-500">{grupo.telefono}</p>}
        </div>
        <p className="text-sm tabular-nums text-gray-700">
          {grupo.lineas.length} {grupo.lineas.length === 1 ? "artículo" : "artículos"} ·{" "}
          <span className="font-semibold text-gray-900">{formatARSExacto(grupo.subtotal)}</span>
        </p>
        <button
          type="button"
          data-print-hide=""
          onClick={onCopiar}
          aria-label={`Copiar el pedido a ${grupo.nombre}`}
          className="min-h-11 rounded-md px-3 text-sm font-medium text-[#1B3A5C] hover:bg-[#1B3A5C]/8"
        >
          {copiado ? "¡Copiado!" : "Copiar"}
        </button>
      </header>

      {/* Una grilla en vez de <table>: en el celular cada artículo es una tarjeta (nombre arriba, cantidad
          y subtotal abajo) y desde md las columnas quedan alineadas entre todos los proveedores. */}
      <div
        aria-hidden="true"
        className={`hidden border-b border-gray-100 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-500 md:grid md:items-center md:gap-x-4 ${COLUMNAS}`}
      >
        <span>Artículo</span>
        <span>Cantidad</span>
        <span className="text-right">Precio unit.</span>
        <span className="text-right">Subtotal</span>
        <span data-print-hide="" />
      </div>
      <ul className="divide-y divide-gray-100">
        {grupo.lineas.map((l) => {
          const ajustada = ajustes[l.material.id]?.cantidad !== undefined;
          return (
            <li
              key={l.material.id}
              className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 md:gap-x-4 md:py-2.5 ${COLUMNAS}`}
            >
              <p className="col-start-1 row-start-1 min-w-0 break-words text-gray-900 md:col-auto md:row-auto">{l.material.nombre}</p>

              <div className="col-start-1 row-start-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 md:col-auto md:row-auto">
                {/* Se confirma al salir del campo (o con Enter): si cada tecla recalculara el pedido, borrar
                    el número para escribir otro sacaría la fila de la tabla en el medio. */}
                <input
                  key={`${l.material.id}-${l.cantidad}`}
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  aria-label={`Cantidad de ${l.material.nombre}`}
                  defaultValue={l.cantidad}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  onBlur={(e) => {
                    const n = numero(e.target.value);
                    if (n <= 0) {
                      e.target.value = String(l.cantidad); // vacío o 0: se deja la que estaba
                      return;
                    }
                    onAjustar(l.material.id, n === l.calculada ? null : { cantidad: n });
                  }}
                  className={`min-h-10 w-24 rounded-md border px-2 py-1.5 text-sm tabular-nums focus:border-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20 ${
                    ajustada ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-white"
                  }`}
                />
                <span className="text-gray-500">{l.material.unidad ?? ""}</span>
                {ajustada && (
                  <span data-print-hide="" className="text-xs text-amber-700">
                    calculado: {coma(l.calculada)}
                  </span>
                )}
              </div>

              <p className="col-span-2 row-start-3 whitespace-nowrap text-xs tabular-nums text-gray-500 md:col-auto md:row-auto md:text-right md:text-sm md:text-gray-700">
                <span className="md:hidden">Precio unit. </span>
                {l.precio === null ? (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">A confirmar</span>
                ) : (
                  formatARSExacto(l.precio)
                )}
              </p>

              <p className="col-start-2 row-start-2 whitespace-nowrap text-right font-medium tabular-nums text-gray-900 md:col-auto md:row-auto">
                {l.precio === null ? "—" : formatARSExacto(l.subtotal)}
              </p>

              <div data-print-hide="" className="col-start-2 row-start-1 text-right md:col-auto md:row-auto">
                <button
                  type="button"
                  onClick={() => onAjustar(l.material.id, { excluido: true })}
                  aria-label={`Quitar ${l.material.nombre} del pedido`}
                  className="min-h-11 rounded-md px-3 text-sm text-gray-500 hover:bg-gray-100 hover:text-red-600"
                >
                  Quitar
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
