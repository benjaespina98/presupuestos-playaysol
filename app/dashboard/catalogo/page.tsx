"use client";

import { useEffect, useMemo, useState } from "react";
import { listarItemsCatalogo } from "@/lib/catalogo";
import type { ResultadoStock } from "@/lib/domain/stock/movimientos";
import { StockControles } from "@/components/stock/StockControles";
import {
  agruparParaListado,
  contarPorSeccion,
  contarPorStock,
  filtrarCatalogo,
  ordenarCatalogo,
  resumenStock,
  textoParaCopiar,
  type FiltroStock,
  type ItemCatalogo,
} from "@/lib/domain/catalogo/item";
import type { SeccionId } from "@/lib/domain/catalogo/secciones";
import { nombreCortoLista } from "@/lib/domain/catalogo/listas";
import { formatARS } from "@/lib/format/ars";
import { formatFechaRelativa, formatFechaCompleta } from "@/lib/format/fecha";
import { copiarAlPortapapeles } from "@/lib/clipboard";
import { PanelPortal } from "@/components/PanelPortal";
import { IconEdit, IconCopy, IconPlus, IconTable } from "@/components/icons";
import { LOCAL_STOCK, PLANILLA_COSTOS_URL } from "@/lib/brand";
import { FiltrosCatalogo } from "@/components/catalogo/FiltrosCatalogo";
import { EncabezadoPagina } from "@/components/catalogo/EncabezadoPagina";
import { botonDe } from "@/components/ui/botones";
import { EditarItemModal } from "@/components/catalogo/EditarItemModal";
import { CrearItemModal } from "@/components/catalogo/CrearItemModal";

/**
 * Las columnas de la lista, IGUALES en todos los bloques (por eso los precios
 * quedan uno debajo del otro de arriba a abajo): Producto · Precio · Unidad ·
 * Stock · Actualizado · acción. Sin la columna de stock cuando ningún ítem lo
 * lleva. Son anchos fijos (rem) y el producto toma el resto.
 */
const COLUMNAS_CON_STOCK = "md:grid-cols-[minmax(0,1fr)_8.5rem_4rem_26rem_6rem_3rem]";
const COLUMNAS_SIN_STOCK = "md:grid-cols-[minmax(0,1fr)_9.5rem_4.5rem_6.5rem_3.5rem]";

export default function CatalogoPage() {
  const [items, setItems] = useState<ItemCatalogo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [seccion, setSeccion] = useState<SeccionId | "">("");
  const [stock, setStock] = useState<FiltroStock | "">("");
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [errorStock, setErrorStock] = useState<string | null>(null);
  const [avisoStock, setAvisoStock] = useState<string | null>(null);
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
  // El stock total del local (de los ítems activos que lo llevan), sin filtros.
  const resumen = useMemo(() => resumenStock((items ?? []).filter((i) => i.activo)), [items]);

  // Un bloque por modelo / sección, para escanear por encabezados en vez de una tabla plana.
  const grupos = useMemo(() => (visibles ? agruparParaListado(visibles) : []), [visibles]);

  const hayStockEnCatalogo = resumen.modelos > 0;
  const columnas = hayStockEnCatalogo ? COLUMNAS_CON_STOCK : COLUMNAS_SIN_STOCK;
  const hayFiltros = !!(busqueda || seccion || stock || incluirInactivos);

  function limpiarFiltros() {
    setBusqueda("");
    setSeccion("");
    setStock("");
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

  return (
    <PanelPortal compacto amplio>
      <EncabezadoPagina
        titulo="Precios de venta"
        descripcion="Lo que se le cobra al cliente en cada presupuesto: precios y descripciones compartidos por todo el equipo."
      >
        <a
          href={PLANILLA_COSTOS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-[#244B5A] shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50"
        >
          <IconTable className="h-4 w-4" />
          Planilla de costos
        </a>
        {!modoConsulta && (
          <button
            type="button"
            onClick={() => setCreando(true)}
            className="flex min-h-11 items-center gap-1.5 rounded-lg bg-[#244B5A] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-marca-oscuro"
          >
            <IconPlus className="h-4 w-4" />
            Agregar ítem
          </button>
        )}
      </EncabezadoPagina>

      <FiltrosCatalogo
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        seccion={seccion}
        onSeccion={setSeccion}
        conteos={conteos}
        stock={stock}
        onStock={setStock}
        conteosStock={conteosStock}
        incluirInactivos={incluirInactivos}
        onIncluirInactivos={setIncluirInactivos}
        modoConsulta={modoConsulta}
        onModoConsulta={setModoConsulta}
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

      {hayStockEnCatalogo && (
        <p className="mb-3 rounded-md bg-[#EEF2F6] px-4 py-2.5 text-sm text-gray-700">
          <span className="font-semibold text-[#244B5A]">Stock · {LOCAL_STOCK}:</span>{" "}
          {resumen.unidades === 0
            ? "todavía no hay unidades cargadas"
            : `${resumen.unidades} ${resumen.unidades === 1 ? "unidad" : "unidades"} en ${resumen.conUnidades} ${resumen.conUnidades === 1 ? "modelo" : "modelos"}`}
          <span className="text-gray-500"> · {resumen.modelos} modelos llevan stock</span>
        </p>
      )}

      {errorStock && (
        <p role="alert" className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorStock}
        </p>
      )}

      {avisoStock && (
        <p role="alert" className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          ⚠ {avisoStock}
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
            {hayFiltros ? "Ningún ítem coincide con el filtro." : "Todavía no hay ítems cargados en el catálogo."}
          </p>
        </div>
      )}

      {!error && visibles && visibles.length > 0 && (
        <>
          <p className="mb-2 text-xs text-gray-500">
            {visibles.length}
            {visibles.length === 1 ? " ítem" : " ítems"}
            {hayFiltros && items ? ` de ${items.length}` : ""}
          </p>

          {/* Encabezado de columnas único, pegado debajo de los filtros: las columnas son las mismas en todos los bloques. */}
          <div
            aria-hidden="true"
            className={`mb-2 hidden rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-500 md:sticky md:top-[var(--catalogo-barra,0px)] md:z-10 md:grid md:items-center md:gap-x-4 ${columnas}`}
          >
            <span>Producto</span>
            <span className="text-right">Precio</span>
            <span>Unidad</span>
            {hayStockEnCatalogo && <span className="text-center">Stock</span>}
            <span>Actualizado</span>
            <span />
          </div>

          <div className="space-y-4">
            {grupos.map((grupo) => (
              <section key={grupo.id} aria-label={grupo.titulo} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <CategoriaHeader titulo={grupo.titulo} cantidad={grupo.items.length} />
                <ul className="divide-y divide-gray-100">
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
        <EditarItemModal
          key={editando.id}
          item={editando}
          onClose={() => setEditando(null)}
          onGuardado={guardarEdicion}
          onStockCambio={stockCambio}
        />
      )}

      {creando && <CrearItemModal onClose={() => setCreando(false)} onCreado={itemCreado} />}
    </PanelPortal>
  );
}

/** Encabezado de cada bloque (un modelo, una sección). */
function CategoriaHeader({ titulo, cantidad }: { titulo: string; cantidad: number }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-gray-200 bg-[#F4F8F9] px-4 py-2.5">
      <span aria-hidden="true" className="h-4 w-1 shrink-0 rounded-full bg-[#244B5A]" />
      <h3 className="text-xs font-bold uppercase tracking-wide text-[#244B5A]">{titulo}</h3>
      <span className="text-xs text-gray-400">({cantidad})</span>
    </div>
  );
}

/**
 * Una fila de la lista. En pantallas medianas y grandes es una fila de la
 * grilla de columnas fijas; en el celular, una tarjeta: nombre y acción arriba,
 * precio y stock abajo.
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
  return (
    <li
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3 transition-colors hover:bg-gray-50/70 md:gap-x-4 md:gap-y-0 md:py-2.5 ${columnas} ${item.activo ? "" : "opacity-60"}`}
    >
      <div className="col-start-1 row-start-1 min-w-0 md:col-auto md:row-auto">
        <ItemDescripcion item={item} />
      </div>

      {/* Precio y unidad: en el celular van juntos; desde md, cada uno en su columna (el número alineado a la derecha). */}
      <p className="col-start-1 row-start-2 flex items-baseline gap-1.5 md:contents">
        <span className="tabular-nums md:text-right">
          <PrecioItem item={item} />
        </span>
        <span className="text-sm text-gray-400">{item.precio !== null && item.unidad ? `/ ${item.unidad}` : ""}</span>
      </p>

      {conStock && (
        <div className="col-start-1 row-start-3 md:col-auto md:row-auto md:text-center">
          <StockControles item={item} editable={!modoConsulta} onResultado={onStockCambio} />
        </div>
      )}

      <p className="col-start-1 row-start-4 text-xs text-gray-400 md:col-auto md:row-auto md:text-sm md:text-gray-500">
        <span className="md:hidden">Actualizado </span>
        <FechaActualizacion updatedAt={item.updated_at} />
      </p>

      <div className="col-start-2 row-start-1 text-right md:col-auto md:row-auto">
        {modoConsulta ? (
          <button
            type="button"
            onClick={onCopiar}
            className={botonDe("suave", "px-3")}
          >
            <IconCopy className="h-4 w-4" />
            {copiado ? "¡Copiado!" : "Copiar"}
          </button>
        ) : (
          <button
            type="button"
            onClick={onEditar}
            aria-label="Editar"
            title="Editar"
            className={botonDe("secundario", "w-11 px-0")}
          >
            <IconEdit className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>
    </li>
  );
}

function ItemDescripcion({ item }: { item: ItemCatalogo }) {
  // Las piscinas de lista se leen por modelo y medida ("Caribe 550"); lo que
  // sigue a la raya larga ("contado, kit estándar instalado") va como detalle.
  const corto = nombreCortoLista(item.clave);
  const baja = !item.activo && (
    <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 align-middle text-[11px] font-medium text-gray-500">Desactivado</span>
  );
  if (corto) {
    const detalle = item.descripcion?.split("—")[1]?.trim();
    return (
      <>
        <p className="font-semibold text-gray-900">
          {corto}
          {baja}
        </p>
        {detalle && <p className="text-xs text-gray-500">{detalle.charAt(0).toUpperCase() + detalle.slice(1)}</p>}
      </>
    );
  }
  return (
    <>
      <p className="font-medium text-gray-900">
        {item.descripcion || item.clave}
        {baja}
      </p>
      {item.descripcion && <p className="text-xs text-gray-400">{item.clave}</p>}
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
      <span className="inline-flex items-center whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
        A cotizar
      </span>
    );
  }
  return <span className="whitespace-nowrap font-semibold text-gray-900">{formatARS(item.precio)}</span>;
}

/** Trazabilidad mínima: hace cuánto se tocó el precio/descripción de este ítem. */
function FechaActualizacion({ updatedAt }: { updatedAt: string }) {
  const relativa = formatFechaRelativa(updatedAt);
  if (!relativa) return null;
  return <span title={formatFechaCompleta(updatedAt)}>{relativa}</span>;
}

function CatalogoSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      {[0, 1].map((g) => (
        <div key={g} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
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
