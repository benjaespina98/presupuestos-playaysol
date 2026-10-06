"use client";

import { useEffect, useMemo, useState } from "react";
import { listarItemsCatalogo } from "@/lib/catalogo";
import {
  agruparPorCategoria,
  contarPorCategoria,
  contarPorLinea,
  filtrarCatalogo,
  ordenarCatalogo,
  textoParaCopiar,
  type ItemCatalogo,
} from "@/lib/domain/catalogo/item";
import type { Categoria } from "@/lib/domain/catalogo/categorias";
import type { LineaPiscina } from "@/lib/domain/catalogo/listas";
import type { TipoCalculadora } from "@/lib/presupuestos";
import { formatARS } from "@/lib/format/ars";
import { formatFechaRelativa, formatFechaCompleta } from "@/lib/format/fecha";
import { copiarAlPortapapeles } from "@/lib/clipboard";
import { PanelPortal } from "@/components/PanelPortal";
import { IconEdit, IconCopy, IconPlus, IconTable } from "@/components/icons";
import { PLANILLA_COSTOS_URL } from "@/lib/brand";
import { FiltrosCatalogo } from "@/components/catalogo/FiltrosCatalogo";
import { EncabezadoPagina } from "@/components/catalogo/EncabezadoPagina";
import { EditarItemModal } from "@/components/catalogo/EditarItemModal";
import { CrearItemModal } from "@/components/catalogo/CrearItemModal";
import { TITULOS_TIPO } from "@/components/catalogo/titulos-tipo";

export default function CatalogoPage() {
  const [items, setItems] = useState<ItemCatalogo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<Categoria | "">("");
  const [tipo, setTipo] = useState<TipoCalculadora | "">("");
  const [linea, setLinea] = useState<LineaPiscina | "">("");
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [modoConsulta, setModoConsulta] = useState(false);
  const [editando, setEditando] = useState<ItemCatalogo | null>(null);
  const [creando, setCreando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    listarItemsCatalogo().then((resultado) => {
      if (cancelado) return;
      if (resultado.error) setError(resultado.error);
      else setItems(resultado.items);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  const visibles = useMemo(() => {
    if (!items) return null;
    return ordenarCatalogo(
      filtrarCatalogo(items, { busqueda, categoria: categoria || null,
        tipo: tipo || null,
        linea: linea || null,
        incluirInactivos,
      })
    );
  }, [items, busqueda, categoria, tipo, linea, incluirInactivos]);

  const conteos = useMemo(
    () => contarPorCategoria(items ?? [], { busqueda, tipo: tipo || null, linea: linea || null, incluirInactivos }),
    [items, busqueda, tipo, linea, incluirInactivos]
  );
  const conteosLinea = useMemo(
    () => contarPorLinea(items ?? [], { busqueda, categoria: categoria || null, tipo: tipo || null, incluirInactivos }),
    [items, busqueda, categoria, tipo, incluirInactivos]
  );

  // Un bloque por categoría en vez de repetir la columna "Categoría" en cada
  // fila — con el catálogo lleno (varias decenas de ítems) es mucho más
  // rápido encontrar algo escaneando encabezados que leyendo una tabla plana.
  const grupos = useMemo(() => (visibles ? agruparPorCategoria(visibles) : []), [visibles]);

  const hayFiltros = !!(busqueda || categoria || tipo || linea || incluirInactivos);

  function limpiarFiltros() {
    setBusqueda("");
    setCategoria("");
    setTipo("");
    setLinea("");
    setIncluirInactivos(false);
  }

  function abrirEdicion(item: ItemCatalogo) {
    setMensajeExito(null);
    setEditando(item);
  }

  function guardarEdicion(actualizado: ItemCatalogo) {
    setItems((prev) => (prev ? prev.map((it) => (it.id === actualizado.id ? actualizado : it)) : prev));
    setEditando(null);
    setMensajeExito(`Se guardó "${actualizado.descripcion || actualizado.clave}".`);
  }

  async function copiarItem(item: ItemCatalogo) {
    const texto = textoParaCopiar(item, formatARS);
    const ok = await copiarAlPortapapeles(texto);
    if (!ok) return; // sin permiso de portapapeles: no hay feedback de "copiado", nada más que mostrar
    setCopiadoId(item.id);
    setTimeout(() => setCopiadoId((actual) => (actual === item.id ? null : actual)), 2000);
  }

  function itemEliminado(eliminado: ItemCatalogo) {
    setItems((prev) => (prev ? prev.filter((it) => it.id !== eliminado.id) : prev));
    setEditando(null);
    setMensajeExito(`Se eliminó "${eliminado.descripcion || eliminado.clave}".`);
  }

  function itemCreado(nuevo: ItemCatalogo) {
    setItems((prev) => (prev ? [...prev, nuevo] : [nuevo]));
    setCreando(false);
    setMensajeExito(`Se agregó "${nuevo.descripcion || nuevo.clave}".`);
  }

  return (
    <PanelPortal compacto>
      <EncabezadoPagina
        titulo="Precios de venta"
        descripcion="Lo que se le cobra al cliente en cada presupuesto: precios y descripciones compartidos por todo el equipo."
      >
          <a
            href={PLANILLA_COSTOS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-[#1B3A5C] shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50"
          >
            <IconTable className="h-4 w-4" />
            Planilla de costos
          </a>
          {!modoConsulta && (
            <button
              type="button"
              onClick={() => setCreando(true)}
              className="flex min-h-11 items-center gap-1.5 rounded-lg bg-[#1B3A5C] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#142c46]"
            >
              <IconPlus className="h-4 w-4" />
              Agregar ítem
            </button>
          )}
      </EncabezadoPagina>

      <FiltrosCatalogo
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        categoria={categoria}
        onCategoria={setCategoria}
        tipo={tipo}
        onTipo={setTipo}
        linea={linea}
        onLinea={setLinea}
        conteosLinea={conteosLinea}
        incluirInactivos={incluirInactivos}
        onIncluirInactivos={setIncluirInactivos}
        modoConsulta={modoConsulta}
        onModoConsulta={setModoConsulta}
        conteos={conteos}
        hayFiltros={hayFiltros}
        onLimpiar={limpiarFiltros}
      />

      {modoConsulta && (
        <p className="mb-4 rounded-md bg-[#EEF2F6] px-4 py-2.5 text-xs text-gray-600">
          Modo consulta: sólo lectura, sin edición. Copiá el texto de un ítem con el botón de al lado del
          precio para pegarlo directo en WhatsApp.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {mensajeExito && (
        <p role="status" className="mb-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
          {mensajeExito}
        </p>
      )}

      {!error && items === null && <CatalogoSkeleton />}

      {!error && visibles && visibles.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center">
          <p className="text-sm text-gray-500">
            {hayFiltros
              ? "Ningún ítem coincide con el filtro."
              : "Todavía no hay ítems cargados en el catálogo."}
          </p>
        </div>
      )}

      {!error && visibles && visibles.length > 0 && (
        <>
          <p className="mb-3 text-xs text-gray-500">
            {visibles.length}
            {visibles.length === 1 ? " ítem" : " ítems"}
            {hayFiltros && items ? ` de ${items.length}` : ""}
          </p>

          <div className="space-y-5">
            {grupos.map((grupo) => (
              <div key={grupo.categoria}>
                {/* Desktop / tablet: tabla por categoría */}
                <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm sm:block">
                  <CategoriaHeader categoria={grupo.categoria} cantidad={grupo.items.length} />
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 text-gray-700">
                        <th className="px-4 py-3 font-medium">Producto</th>
                        <th className="px-4 py-3 font-medium">Calculadora</th>
                        <th className="px-4 py-3 text-right font-medium">Precio</th>
                        <th className="px-4 py-3 font-medium">Actualizado</th>
                        {!modoConsulta && <th className="px-4 py-3 font-medium">Estado</th>}
                        <th className="px-4 py-3 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {grupo.items.map((item) => (
                        <tr
                          key={item.id}
                          className={`border-b border-gray-100 transition-colors last:border-0 hover:bg-gray-50/70 ${item.activo ? "" : "opacity-60"}`}
                        >
                          <td className="px-4 py-3 text-gray-900">
                            <ItemDescripcion item={item} />
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-md bg-[#EEF2F6] px-2 py-0.5 text-xs font-medium text-[#1B3A5C]">
                              {TITULOS_TIPO[item.tipo]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                            <PrecioItem item={item} />
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            <FechaActualizacion updatedAt={item.updated_at} />
                          </td>
                          {!modoConsulta && (
                            <td className="px-4 py-3">
                              <EstadoBadge activo={item.activo} />
                            </td>
                          )}
                          <td className="px-4 py-3 text-right">
                            {modoConsulta ? (
                              <button
                                type="button"
                                onClick={() => copiarItem(item)}
                                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-[#1B3A5C] hover:bg-[#1B3A5C]/8"
                              >
                                <IconCopy className="h-4 w-4" />
                                {copiadoId === item.id ? "¡Copiado!" : "Copiar"}
                              </button>
                            ) : (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => abrirEdicion(item)}
                                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-[#1B3A5C] hover:bg-[#1B3A5C]/8"
                                >
                                  <IconEdit className="h-4 w-4" />
                                  Editar
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile: tarjetas por categoría */}
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm sm:hidden">
                  <CategoriaHeader categoria={grupo.categoria} cantidad={grupo.items.length} />
                  <div className="flex flex-col divide-y divide-gray-100 p-3">
                    {grupo.items.map((item) => (
                      <div key={item.id} className="pt-3 first:pt-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <ItemDescripcion item={item} />
                            <p className="mt-0.5 text-xs text-gray-400">{TITULOS_TIPO[item.tipo]}</p>
                          </div>
                          {!modoConsulta && <EstadoBadge activo={item.activo} />}
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              <PrecioItem item={item} />
                            </p>
                            <p className="mt-0.5 text-xs text-gray-400">
                              <FechaActualizacion updatedAt={item.updated_at} />
                            </p>
                          </div>
                          {modoConsulta ? (
                            <button
                              type="button"
                              onClick={() => copiarItem(item)}
                              className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-[#1B3A5C] hover:bg-[#1B3A5C]/8"
                            >
                              <IconCopy className="h-4 w-4" />
                              {copiadoId === item.id ? "¡Copiado!" : "Copiar"}
                            </button>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => abrirEdicion(item)}
                                className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-[#1B3A5C] hover:bg-[#1B3A5C]/8"
                              >
                                <IconEdit className="h-4 w-4" />
                                Editar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {editando && (
        <EditarItemModal
          key={editando.id}
          item={editando}
          onClose={() => setEditando(null)}
          onGuardado={guardarEdicion}
          onEliminado={itemEliminado}
        />
      )}

      {creando && <CrearItemModal onClose={() => setCreando(false)} onCreado={itemCreado} />}
    </PanelPortal>
  );
}

/** Encabezado de cada bloque de categoría — reemplaza a la columna
 *  "Categoría" que antes se repetía en cada fila. La barra navy es sólo
 *  ritmo visual (misma paleta que el resto del portal), no un código de
 *  color por categoría: con 9 categorías posibles, un color distinto por
 *  cada una sería más ruido que ayuda. */
function CategoriaHeader({ categoria, cantidad }: { categoria: string; cantidad: number }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-gray-200 bg-[#F4F8F9] px-4 py-2.5">
      <span aria-hidden="true" className="h-4 w-1 shrink-0 rounded-full bg-[#1B3A5C]" />
      <h3 className="text-xs font-bold uppercase tracking-wide text-[#1B3A5C]">{categoria}</h3>
      <span className="text-xs text-gray-400">({cantidad})</span>
    </div>
  );
}

function ItemDescripcion({ item }: { item: ItemCatalogo }) {
  return (
    <>
      <p className="font-medium">{item.descripcion || item.clave}</p>
      {item.descripcion && <p className="text-xs text-gray-400">{item.clave}</p>}
    </>
  );
}

/**
 * Distingue de un vistazo un precio cerrado (listo para usar tal cual en un
 * presupuesto) de uno "a cotizar" (necesita ajuste manual antes de mandarlo).
 * El badge ámbar es la señal fuerte porque es la EXCEPCIÓN: la mayoría de
 * las filas tiene precio cerrado, así que no vale la pena un badge en cada
 * una — el número solo ya comunica "esto está listo".
 */
function PrecioItem({ item }: { item: ItemCatalogo }) {
  if (item.precio === null) {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
        A cotizar
      </span>
    );
  }
  return (
    <span className="whitespace-nowrap font-medium text-gray-900">
      {formatARS(item.precio)}
      {item.unidad && <span className="font-normal text-gray-400"> / {item.unidad}</span>}
    </span>
  );
}

/** Trazabilidad mínima: hace cuánto se tocó el precio/descripción de este
 *  ítem, para poder confiar (o desconfiar) en que no está desactualizado.
 *  Sólo la fecha — "quién" queda para una iteración futura (evaluado: sumar
 *  el autor exige un join a `perfiles` fila por fila, más complejidad de la
 *  que vale la pena para esta pasada). */
function FechaActualizacion({ updatedAt }: { updatedAt: string }) {
  const relativa = formatFechaRelativa(updatedAt);
  if (!relativa) return null;
  return <span title={formatFechaCompleta(updatedAt)}>{relativa}</span>;
}

function EstadoBadge({ activo }: { activo: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        activo ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
      }`}
    >
      {activo ? "Activo" : "De baja"}
    </span>
  );
}

function CatalogoSkeleton() {
  return (
    <div>
      <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm sm:block">
        <div className="h-9 animate-pulse border-b border-gray-200 bg-gray-100" />
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-gray-700">
              <th className="px-4 py-3 font-medium">Producto</th>
              <th className="px-4 py-3 font-medium">Calculadora</th>
              <th className="px-4 py-3 font-medium">Precio</th>
              <th className="px-4 py-3 font-medium">Actualizado</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <tr key={i} className="animate-pulse border-b border-gray-100 last:border-0">
                <td className="px-4 py-3"><div className="h-3.5 w-40 rounded bg-gray-200" /></td>
                <td className="px-4 py-3"><div className="h-3.5 w-20 rounded bg-gray-200" /></td>
                <td className="px-4 py-3"><div className="h-3.5 w-16 rounded bg-gray-200" /></td>
                <td className="px-4 py-3"><div className="h-3.5 w-16 rounded bg-gray-100" /></td>
                <td className="px-4 py-3"><div className="h-3.5 w-14 rounded bg-gray-200" /></td>
                <td className="px-4 py-3"><div className="h-3.5 w-14 rounded bg-gray-100" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-2">
                <div className="h-4 w-36 rounded bg-gray-200" />
                <div className="h-3 w-24 rounded bg-gray-200" />
              </div>
              <div className="h-5 w-14 rounded-full bg-gray-100" />
            </div>
            <div className="mt-3 h-4 w-20 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
