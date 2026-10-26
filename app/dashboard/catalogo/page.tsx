"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { listarItemsCatalogo } from "@/lib/catalogo";
import type { ResultadoStock } from "@/lib/domain/stock/movimientos";
import { AccionesStock, DialogosStock, StockNumero, type DialogoStock } from "@/components/stock/StockControles";
import {
  agruparParaListado,
  contarPorSeccion,
  contarPorStock,
  filtrarCatalogo,
  llevaStock,
  ordenarCatalogo,
  resumenStock,
  textoParaCopiar,
  type FiltroStock,
  type ItemCatalogo,
} from "@/lib/domain/catalogo/item";
import type { SeccionId } from "@/lib/domain/catalogo/secciones";
import { nombreCortoLista } from "@/lib/domain/catalogo/listas";
import { formatARS } from "@/lib/format/ars";
import { formatFechaRelativaCorta, formatFechaCompleta } from "@/lib/format/fecha";
import { ordenarPor, type ClaveOrden } from "@/lib/ordenar";
import { copiarAlPortapapeles } from "@/lib/clipboard";
import { PanelPortal } from "@/components/PanelPortal";
import { useEstadoPersistente } from "@/lib/useEstadoPersistente";
import { IconCopy } from "@/components/icons";
import { LOCAL_STOCK } from "@/lib/brand";
import { FiltrosCatalogo } from "@/components/catalogo/FiltrosCatalogo";
import { EncabezadoPagina } from "@/components/catalogo/EncabezadoPagina";
import { botonDe } from "@/components/ui/botones";
import { BotonLapiz, alTocarFila } from "@/components/ui/BotonLapiz";
import { Toast } from "@/components/ui/BarraListado";
import { EditarItemModal } from "@/components/catalogo/EditarItemModal";
import { CrearItemModal } from "@/components/catalogo/CrearItemModal";

/**
 * Las columnas de la lista desde `lg`, IGUALES en todos los bloques (por eso los precios quedan uno debajo del
 * otro de arriba a abajo): Producto · Precio · Unidad · Stock · acciones (Venta y "…") · Actualizado · Editar.
 * Sin las dos de stock cuando ningún ítem lo lleva. Son anchos fijos (rem) y el producto toma el resto.
 */
const COLUMNAS_CON_STOCK = "lg:grid-cols-[minmax(0,1fr)_8rem_4rem_5rem_10.5rem_6.5rem_3.5rem]";
const COLUMNAS_SIN_STOCK = "lg:grid-cols-[minmax(0,1fr)_9rem_4.5rem_6.5rem_3.5rem]";

export default function CatalogoPage() {
  const [items, setItems] = useState<ItemCatalogo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // La búsqueda, los filtros, el orden y el modo consulta se conservan al abrir otra pantalla (o el Historial) y volver.
  const [prefs, setPrefs] = useEstadoPersistente<{
    busqueda: string;
    seccion: SeccionId | "";
    stock: FiltroStock | "";
    orden: ClaveOrden;
    incluirInactivos: boolean;
    modoConsulta: boolean;
  }>("catalogo:filtros", { busqueda: "", seccion: "", stock: "", orden: "defecto", incluirInactivos: false, modoConsulta: false });
  const { busqueda, seccion, stock, incluirInactivos, modoConsulta } = prefs;
  const orden = prefs.orden ?? "defecto";
  const setBusqueda = (busqueda: string) => setPrefs({ ...prefs, busqueda });
  const setSeccion = (seccion: SeccionId | "") => setPrefs({ ...prefs, seccion });
  const setStock = (stock: FiltroStock | "") => setPrefs({ ...prefs, stock });
  const setOrden = (orden: ClaveOrden) => setPrefs({ ...prefs, orden });
  const setIncluirInactivos = (incluirInactivos: boolean) => setPrefs({ ...prefs, incluirInactivos });
  const setModoConsulta = (modoConsulta: boolean) => setPrefs({ ...prefs, modoConsulta });
  const [errorStock, setErrorStock] = useState<string | null>(null);
  const [avisoStock, setAvisoStock] = useState<string | null>(null);
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
    return ordenarCatalogo(filtrarCatalogo(items, { busqueda, seccion: seccion || null, stock: stock || null, incluirInactivos }));
  }, [items, busqueda, seccion, stock, incluirInactivos]);

  const conteos = useMemo(
    () => contarPorSeccion(items ?? [], { busqueda, stock: stock || null, incluirInactivos }),
    [items, busqueda, stock, incluirInactivos]
  );
  const conteosStock = useMemo(
    () => contarPorStock(items ?? [], { busqueda, seccion: seccion || null, incluirInactivos }),
    [items, busqueda, seccion, incluirInactivos]
  );
  const totalStock = useMemo(
    () => filtrarCatalogo(items ?? [], { busqueda, seccion: seccion || null, incluirInactivos }).length,
    [items, busqueda, seccion, incluirInactivos]
  );
  // El stock total del local (de los ítems activos que lo llevan), sin filtros.
  const resumen = useMemo(() => resumenStock((items ?? []).filter((i) => i.activo)), [items]);

  // Un bloque por modelo / sección, para escanear por encabezados en vez de una tabla plana. El orden elegido
  // se aplica dentro de cada bloque (los bloques se quedan en su lugar).
  const grupos = useMemo(
    () =>
      (visibles ? agruparParaListado(visibles) : []).map((g) => ({
        ...g,
        items: ordenarPor(g.items, orden, {
          nombre: (i) => i.descripcion || i.clave,
          precio: (i) => i.precio,
          stock: (i) => (llevaStock(i) ? i.stock : null),
          actualizado: (i) => i.updated_at,
        }),
      })),
    [visibles, orden]
  );

  const hayStockEnCatalogo = resumen.modelos > 0;
  const columnas = hayStockEnCatalogo ? COLUMNAS_CON_STOCK : COLUMNAS_SIN_STOCK;
  const hayFiltros = !!(busqueda || seccion || stock || incluirInactivos || orden !== "defecto");

  function limpiarFiltros() {
    setPrefs({ ...prefs, busqueda: "", seccion: "", stock: "", orden: "defecto", incluirInactivos: false });
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

  /**
   * Una operación de stock (Ingreso, Venta, Ajuste o Anulación) terminó bien: el
   * stock de la lista pasa a lo que dice la base y se avisa lo que corresponda.
   * El número NO se calcula acá: viene de la respuesta de la función de la base.
   */
  function stockCambio(item: ItemCatalogo, r: ResultadoStock) {
    const nombre = item.descripcion || item.clave;
    setItems((prev) => (prev ? prev.map((it) => (it.id === item.id ? { ...it, stock: r.stock_resultante } : it)) : prev));
    setErrorStock(null);
    setAvisoStock(null);
    if (r.movimiento_id === null) {
      setMensajeExito(`El conteo de "${nombre}" coincidía con el stock cargado: no hubo cambios.`);
    } else if (r.repetido) {
      setMensajeExito(`Esa operación de "${nombre}" ya estaba registrada: no se repitió.`);
    } else if (r.stock_negativo) {
      setMensajeExito(null);
      setAvisoStock(`"${nombre}" quedó en stock negativo (−${Math.abs(r.stock_resultante)}). Revisá el conteo o cargá el ingreso que falta.`);
    } else {
      setMensajeExito(`Stock de "${nombre}": ${r.stock_resultante}.`);
    }
  }

  function itemCreado(nuevo: ItemCatalogo) {
    setItems((prev) => (prev ? [...prev, nuevo] : [nuevo]));
    setCreando(false);
    setMensajeExito(`Se agregó "${nuevo.descripcion || nuevo.clave}".`);
  }

  const cerrarToast = useCallback(() => setMensajeExito(null), []);

  const vacioPorStock =
    stock === "negativo"
      ? "No hay ítems con stock negativo."
      : stock === "agotado"
        ? "No hay ítems sin stock."
        : stock === "disponible"
          ? "No hay ítems con stock."
          : stock === "sin-control"
            ? "No hay ítems sin control de stock."
            : null;

  return (
    <PanelPortal compacto amplio>
      <EncabezadoPagina
        titulo="Precios de venta"
        descripcion="Lo que se le cobra al cliente en cada presupuesto: precios y descripciones compartidos por todo el equipo."
      />

      <FiltrosCatalogo
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        seccion={seccion}
        onSeccion={setSeccion}
        conteos={conteos}
        stock={stock}
        onStock={setStock}
        conteosStock={conteosStock}
        totalStock={totalStock}
        orden={orden}
        onOrden={setOrden}
        incluirInactivos={incluirInactivos}
        onIncluirInactivos={setIncluirInactivos}
        modoConsulta={modoConsulta}
        onModoConsulta={setModoConsulta}
        hayFiltros={hayFiltros}
        onLimpiar={limpiarFiltros}
        resultados={visibles?.length ?? 0}
        onAgregar={() => setCreando(true)}
        contador={
          visibles && !error
            ? `${visibles.length} ${hayFiltros && items ? `de ${items.filter((i) => incluirInactivos || i.activo).length} ítems` : visibles.length === 1 ? "ítem" : "ítems"}`
            : undefined
        }
        contadorDerecha={
          hayStockEnCatalogo && visibles && visibles.length > 0 ? (
            <>
              <span className="font-semibold text-[#244B5A]">Stock · {LOCAL_STOCK}:</span>{" "}
              {resumen.unidades === 0
                ? "sin unidades cargadas"
                : `${resumen.unidades} ${resumen.unidades === 1 ? "unidad" : "unidades"} en ${resumen.conUnidades} ${resumen.conUnidades === 1 ? "modelo" : "modelos"}`}
            </>
          ) : undefined
        }
      />

      {modoConsulta && (
        <p className="mb-2 rounded-md bg-[#EEF2F6] px-4 py-2 text-[13px] text-[#3E4A52]">
          Modo consulta: sólo lectura, sin edición. Copiá el texto de un ítem con el botón de la fila para pegarlo directo en WhatsApp.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-[#B42318]">
          {error}
        </p>
      )}

      {errorStock && (
        <p role="alert" className="mb-2 rounded-md bg-red-50 px-4 py-3 text-sm text-[#B42318]">
          {errorStock}
        </p>
      )}

      {avisoStock && (
        <p role="alert" className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          ⚠ {avisoStock}
        </p>
      )}

      {!error && items === null && <CatalogoSkeleton />}

      {!error && visibles && visibles.length === 0 && (
        <div className="rounded-lg border border-dashed border-[#7D8892] px-4 py-10 text-center">
          <p className="text-sm text-[#3E4A52]">
            {hayFiltros ? (vacioPorStock ?? "Ningún ítem coincide con el filtro.") : "Todavía no hay ítems cargados en el catálogo."}
          </p>
          {hayFiltros && (
            <button type="button" onClick={limpiarFiltros} className={botonDe("secundario", "mt-3 px-4")}>
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {!error && visibles && visibles.length > 0 && (
        <>
          {/* Encabezado de columnas único, pegado debajo de la barra: las columnas son las mismas en todos los bloques. */}
          <div
            aria-hidden="true"
            className={`hidden h-9 border border-[#D9DFE3] bg-[#F1F4F6] px-4 text-[13px] font-semibold uppercase tracking-wide text-[#4A5861] lg:sticky lg:top-[var(--catalogo-barra,0px)] lg:z-10 lg:grid lg:items-center lg:gap-x-4 ${columnas}`}
          >
            <span>Producto</span>
            <span className="text-center">Precio</span>
            <span className="text-center">Unidad</span>
            {hayStockEnCatalogo && <span className="text-center">Stock</span>}
            {hayStockEnCatalogo && <span aria-hidden="true" />}
            <span className="text-center">Actualizado</span>
            <span className="text-center">Editar</span>
          </div>

          <div className="space-y-3 lg:space-y-0">
            {grupos.map((grupo) => (
              <section key={grupo.id} aria-label={grupo.titulo} className="rounded-lg border border-[#D9DFE3] bg-[#FFFFFF] lg:rounded-none lg:border-t-0">
                <CategoriaHeader titulo={grupo.titulo} cantidad={grupo.items.length} />
                <ul className="divide-y divide-[#EEF1F3]">
                  {grupo.items.map((item) => (
                    <FilaItem
                      key={item.id}
                      item={item}
                      columnas={columnas}
                      conStock={hayStockEnCatalogo}
                      modoConsulta={modoConsulta}
                      copiado={copiadoId === item.id}
                      onEditar={() => abrirEdicion(item)}
                      onCopiar={() => copiarItem(item)}
                      onStockCambio={stockCambio}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      {editando && (
        <EditarItemModal key={editando.id} item={editando} onClose={() => setEditando(null)} onGuardado={guardarEdicion} onStockCambio={stockCambio} />
      )}

      {creando && <CrearItemModal onClose={() => setCreando(false)} onCreado={itemCreado} />}

      <Toast mensaje={mensajeExito} onCerrar={cerrarToast} />
    </PanelPortal>
  );
}

/** Encabezado de cada bloque (un modelo, una sección): liviano, y fijo debajo de la barra y del encabezado de columnas al bajar. */
function CategoriaHeader({ titulo, cantidad }: { titulo: string; cantidad: number }) {
  return (
    <div className="sticky top-[var(--catalogo-barra,0px)] z-[5] flex h-9 items-center gap-2.5 rounded-t-lg border-b border-[#D9DFE3] bg-[#F4F8F9] px-4 lg:top-[calc(var(--catalogo-barra,0px)+2.25rem)] lg:rounded-none">
      <span aria-hidden="true" className="h-3.5 w-1 shrink-0 rounded-full bg-[#244B5A]" />
      <h3 className="text-[13px] font-bold uppercase tracking-wide text-[#244B5A]">{titulo}</h3>
      <span className="text-[13px] text-[#4A5861]">({cantidad})</span>
    </div>
  );
}

/**
 * Una fila de la lista. Desde `lg` es una fila de la grilla de columnas fijas (unos 52 px); en el celular, un
 * renglón de unos 56 px: a la izquierda el nombre y debajo el precio y el stock, a la derecha "Venta", el menú
 * "…" y el lápiz. Tocar la fila entera también abre la edición.
 */
function FilaItem({
  item,
  columnas,
  conStock,
  modoConsulta,
  copiado,
  onEditar,
  onCopiar,
  onStockCambio,
}: {
  item: ItemCatalogo;
  columnas: string;
  conStock: boolean;
  modoConsulta: boolean;
  copiado: boolean;
  onEditar: () => void;
  onCopiar: () => void;
  onStockCambio: (item: ItemCatalogo, resultado: ResultadoStock) => void;
}) {
  const [dialogo, setDialogo] = useState<DialogoStock>(null);
  const nombre = item.descripcion || item.clave;
  const editable = !modoConsulta;
  const tieneAcciones = editable && conStock && llevaStock(item);
  // Desde lg, cada celda vuelve a su columna de la grilla (se anulan las posiciones del celular).
  const alta = "lg:col-auto lg:col-span-1 lg:row-auto lg:row-span-1 lg:justify-self-auto";
  return (
    <li
      onClick={editable ? alTocarFila(onEditar) : undefined}
      className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-1.5 gap-y-0.5 px-4 py-1.5 text-[15px] leading-5 transition-colors hover:bg-[#F4F8F9] lg:min-h-[3rem] lg:gap-x-4 lg:py-0 ${columnas} ${editable ? "cursor-pointer" : ""} ${item.activo ? "" : "opacity-70"}`}
    >
      {/* Celular, dos renglones. Con acciones de stock: arriba el nombre y, pegado a su costado, el stock (una pastilla chica);
          abajo el precio, "Venta", "…" y el lápiz. Sin acciones: el nombre y el precio a la izquierda y el lápiz a la derecha.
          Desde lg, la grilla de columnas (el `order` devuelve cada celda a su columna). */}
      <div className={`col-start-1 row-start-1 flex min-w-0 items-center gap-2 ${tieneAcciones ? "col-span-3" : "col-span-2"} ${alta} lg:order-1 lg:contents`}>
        <div className="min-w-0 flex-1 lg:order-1">
          <ItemDescripcion item={item} />
        </div>
        {conStock && tieneAcciones && (
          <span className="ml-auto shrink-0 lg:order-4 lg:text-center">
            <StockNumero item={item} conRotulo />
          </span>
        )}
      </div>
      <span className={`col-start-1 row-start-2 justify-self-start tabular-nums lg:order-2 lg:text-center ${alta}`}>
        <PrecioItem item={item} />
      </span>
      <span className={`hidden whitespace-nowrap text-[13px] text-[#4A5861] lg:order-3 lg:block lg:text-center`}>{item.precio !== null && item.unidad ? `${item.unidad}` : ""}</span>
      {conStock && !tieneAcciones && (
        <span className={`col-start-2 row-start-2 justify-self-end ${alta} lg:order-4 lg:text-center`}>
          <StockNumero item={item} />
        </span>
      )}

      {/* Acciones de stock (Venta y "…"), la fecha (sólo desde lg) y el lápiz. */}
      {conStock && (
        <div className={`col-start-2 row-start-2 flex items-center justify-end gap-1.5 ${alta} lg:order-5 lg:gap-2`}>
          {tieneAcciones && <AccionesStock item={item} onAbrir={setDialogo} />}
        </div>
      )}
      <p className="hidden whitespace-nowrap text-center text-[13px] text-[#4A5861] lg:order-6 lg:block">
        <FechaActualizacion updatedAt={item.updated_at} />
      </p>
      <div className={`col-start-3 flex justify-end ${tieneAcciones ? "row-start-2" : "row-span-2 row-start-1"} ${alta} lg:order-7 lg:justify-center`}>
        {modoConsulta ? (
          <button type="button" onClick={onCopiar} className={botonDe("suave", "px-3")}>
            <IconCopy className="h-4 w-4" />
            {copiado ? "¡Copiado!" : "Copiar"}
          </button>
        ) : (
          <BotonLapiz nombre={nombre} etiqueta="Editar" onClick={onEditar} />
        )}
      </div>
      <DialogosStock item={item} dialogo={dialogo} onCerrar={() => setDialogo(null)} onResultado={onStockCambio} />
    </li>
  );
}

function ItemDescripcion({ item }: { item: ItemCatalogo }) {
  // Las piscinas de lista se leen por modelo y medida ("Caribe 550"); lo que
  // sigue a la raya larga ("contado, kit estándar instalado") va como detalle.
  const corto = nombreCortoLista(item.clave);
  const baja = !item.activo && (
    <span className="ml-2 rounded-full bg-[#E3ECEF] px-2 py-0.5 align-middle text-[13px] font-medium text-[#3E4A52]">Desactivado</span>
  );
  if (corto) {
    const detalle = item.descripcion?.split("—")[1]?.trim();
    return (
      <>
        <p className="line-clamp-2 break-words lg:truncate font-semibold text-gray-900">
          {corto}
          {baja}
        </p>
        {detalle && <p className="hidden truncate text-[13px] text-[#4A5861] lg:block">{detalle.charAt(0).toUpperCase() + detalle.slice(1)}</p>}
      </>
    );
  }
  return (
    <>
      <p className="line-clamp-2 break-words lg:truncate font-medium text-gray-900" title={item.descripcion || item.clave}>
        {item.descripcion || item.clave}
        {baja}
      </p>
      {item.descripcion && <p className="hidden truncate text-[13px] text-[#4A5861] lg:block">{item.clave}</p>}
    </>
  );
}

/**
 * El precio, siempre con el mismo estilo (negrita, números tabulares, alineado a
 * la derecha en su columna). "A cotizar" (sin precio fijo) lleva su propia
 * etiqueta ámbar: es la excepción que pide ajuste manual antes de mandarlo.
 */
function PrecioItem({ item }: { item: ItemCatalogo }) {
  if (item.precio === null) {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-0.5 text-[13px] font-medium text-amber-800">
        A cotizar
      </span>
    );
  }
  return (
    <span className="font-semibold text-gray-900">
      <span className="whitespace-nowrap">{formatARS(item.precio)}</span>
      {item.unidad && (
        <>
          {" "}
          <span className="whitespace-nowrap text-[13px] font-normal text-[#4A5861] lg:hidden">/ {item.unidad}</span>
        </>
      )}
    </span>
  );
}

/** Trazabilidad mínima: hace cuánto se tocó el precio/descripción de este ítem, en una sola línea. */
function FechaActualizacion({ updatedAt }: { updatedAt: string }) {
  const relativa = formatFechaRelativaCorta(updatedAt);
  if (!relativa) return null;
  return <span title={formatFechaCompleta(updatedAt)}>{relativa}</span>;
}

function CatalogoSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      {[0, 1].map((g) => (
        <div key={g} className="overflow-hidden rounded-lg border border-gray-200 bg-[#FFFFFF] shadow-sm">
          <div className="h-9 animate-pulse border-b border-gray-200 bg-gray-100" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex animate-pulse items-center justify-between gap-4 border-b border-gray-100 px-4 py-3.5 last:border-0">
              <div className="space-y-2">
                <div className="h-3.5 w-40 rounded bg-gray-200" />
                <div className="h-3 w-24 rounded bg-gray-100" />
              </div>
              <div className="h-3.5 w-24 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
