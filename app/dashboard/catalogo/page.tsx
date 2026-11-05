"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { listarItemsCatalogo } from "@/lib/catalogo";
import type { ResultadoStock } from "@/lib/domain/stock/movimientos";
import { ControlStock, DialogosStock, MenuStock, StockNumero, type DialogoStock } from "@/components/stock/StockControles";
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
import { useBusquedaDeUrl } from "@/lib/useBusquedaDeUrl";
import { useEstadoPersistente } from "@/lib/useEstadoPersistente";
import { IconCopy } from "@/components/icons";
import { LOCAL_STOCK } from "@/lib/brand";
import { FiltrosCatalogo } from "@/components/catalogo/FiltrosCatalogo";
import { EncabezadoPagina } from "@/components/catalogo/EncabezadoPagina";
import { botonDe } from "@/components/ui/botones";
import { Aviso } from "@/components/ui/Aviso";
import { ListaCargando, ListaVacia } from "@/components/ui/EstadoLista";
import { COLUMNA_NUMERO, LISTA_ENCABEZADO, LISTA_GRUPO, LISTA_SEPARADORES, TEXTO_SECUNDARIO } from "@/components/ui/lista";
import { Pastilla } from "@/components/ui/Pastilla";
import { BotonLapiz, alTocarFila } from "@/components/ui/BotonLapiz";
import { Toast } from "@/components/ui/BarraListado";
import { EditarItemModal } from "@/components/catalogo/EditarItemModal";
import { CrearItemModal } from "@/components/catalogo/CrearItemModal";

/**
 * Las columnas de la lista desde `lg`, IGUALES en todos los bloques (por eso los precios quedan uno debajo del
 * otro, alineados a la derecha): Producto · Precio · Unidad · Stock (− número +) · menú "…" · Actualizado · Editar.
 * Sin las dos de stock cuando ningún ítem lo lleva. Son anchos fijos (rem) y el producto toma el resto.
 */
const COLUMNAS_CON_STOCK = "lg:grid-cols-[minmax(0,1fr)_8rem_4rem_8.5rem_2.75rem_6.5rem_3.5rem]";
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
  const { seccion, stock, incluirInactivos, modoConsulta } = prefs;
  useBusquedaDeUrl((b) => setPrefs({ busqueda: b, seccion: "", stock: "", orden: "defecto", incluirInactivos: false, modoConsulta }));
  // Filtrar decenas de filas en cada tecla trababa el campo en el celular: la lista sigue a la búsqueda sin frenar la escritura.
  const busqueda = useDeferredValue(prefs.busqueda);
  const orden = prefs.orden ?? "defecto";
  const setBusqueda = (b: string) => setPrefs({ ...prefs, busqueda: b });
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
  const hayFiltros = !!(prefs.busqueda || seccion || stock || incluirInactivos || orden !== "defecto");

  function limpiarFiltros() {
    setPrefs({ ...prefs, busqueda: "", seccion: "", stock: "", orden: "defecto", incluirInactivos: false });
  }

  // Estables, para que abrir un aviso o cerrar una hoja no vuelva a dibujar todas las filas.
  const abrirEdicion = useCallback((item: ItemCatalogo) => {
    setMensajeExito(null);
    setEditando(item);
  }, []);

  function guardarEdicion(actualizado: ItemCatalogo) {
    setItems((prev) => (prev ? prev.map((it) => (it.id === actualizado.id ? actualizado : it)) : prev));
    setEditando(null);
    setMensajeExito(`Se guardó "${actualizado.descripcion || actualizado.clave}".`);
  }

  const copiarItem = useCallback(async (item: ItemCatalogo) => {
    const ok = await copiarAlPortapapeles(textoParaCopiar(item, formatARS));
    if (!ok) {
      setMensajeExito("No se pudo copiar: el navegador no dio permiso.");
      return;
    }
    setCopiadoId(item.id);
    setTimeout(() => setCopiadoId((actual) => (actual === item.id ? null : actual)), 2000);
  }, []);

  /**
   * Una operación de stock (Ingreso, Venta, Ajuste o Anulación) terminó bien: el
   * stock de la lista pasa a lo que dice la base y se avisa lo que corresponda.
   * El número NO se calcula acá: viene de la respuesta de la función de la base.
   */
  const stockCambio = useCallback((item: ItemCatalogo, r: ResultadoStock) => {
    const nombre = nombreCortoLista(item.clave) ?? (item.descripcion || item.clave);
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
  }, []);

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
        busqueda={prefs.busqueda}
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
        <Aviso tono="info" className="mb-2">
          Modo consulta: sólo lectura. Copiá el texto de un ítem con el botón de la fila para pegarlo en WhatsApp.
        </Aviso>
      )}

      {error && <Aviso tono="error">{error}</Aviso>}

      {errorStock && (
        <Aviso tono="error" className="mb-2">
          {errorStock}
        </Aviso>
      )}

      {avisoStock && (
        <Aviso tono="aviso" urgente className="mb-2">
          {avisoStock}
        </Aviso>
      )}

      {!error && items === null && <ListaCargando />}

      {!error && visibles && visibles.length === 0 && (
        <ListaVacia
          accion={
            hayFiltros ? (
              <button type="button" onClick={limpiarFiltros} className={botonDe("secundario", "px-4")}>
                Limpiar filtros
              </button>
            ) : undefined
          }
        >
          {hayFiltros ? (vacioPorStock ?? "Ningún ítem coincide con el filtro.") : "Todavía no hay ítems cargados en el catálogo."}
        </ListaVacia>
      )}

      {!error && visibles && visibles.length > 0 && (
        <>
          {/* Encabezado de columnas único, pegado debajo de la barra: las columnas son las mismas en todos los bloques. */}
          <div
            aria-hidden="true"
            className={`${LISTA_ENCABEZADO} border-x border-t ${columnas}`}
          >
            <span>Producto</span>
            <span className="text-right">Precio</span>
            <span>Unidad</span>
            {hayStockEnCatalogo && <span className="text-center">Stock</span>}
            {hayStockEnCatalogo && <span aria-hidden="true" />}
            <span className="text-center">Actualizado</span>
            <span className="text-center">Editar</span>
          </div>

          <div className="space-y-3 lg:space-y-0">
            {grupos.map((grupo) => (
              <section key={grupo.id} aria-label={grupo.titulo} className="rounded-lg border border-[#D9DFE3] bg-[#FFFFFF] lg:rounded-none lg:border-t-0">
                <CategoriaHeader titulo={grupo.titulo} cantidad={grupo.items.length} />
                <ul className={LISTA_SEPARADORES}>
                  {grupo.items.map((item) => (
                    <FilaItem
                      key={item.id}
                      item={item}
                      columnas={columnas}
                      conStock={hayStockEnCatalogo}
                      modoConsulta={modoConsulta}
                      copiado={copiadoId === item.id}
                      onEditar={abrirEdicion}
                      onCopiar={copiarItem}
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
    <div className={`${LISTA_GRUPO} rounded-t-lg lg:top-[calc(var(--catalogo-barra,0px)+2.25rem)] lg:rounded-none`}>
      <h3>{titulo}</h3>
      <span className="font-normal text-[#4A5861]">({cantidad})</span>
    </div>
  );
}

/**
 * Una fila de la lista. Desde `lg`, una fila de la grilla de columnas fijas; en el celular, el nombre y el precio con el
 * lápiz al costado y, debajo, la línea de stock. Tocar la fila entera también abre la edición.
 */
const FilaItem = memo(function FilaItem({
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
  onEditar: (item: ItemCatalogo) => void;
  onCopiar: (item: ItemCatalogo) => void;
  onStockCambio: (item: ItemCatalogo, resultado: ResultadoStock) => void;
}) {
  const [dialogo, setDialogo] = useState<DialogoStock>(null);
  const nombre = item.descripcion || item.clave;
  const editable = !modoConsulta;
  // Celular: el nombre y el precio a la izquierda, el lápiz a la derecha y, si lleva stock, una línea propia para el stock.
  // Desde lg, cada pieza es una celda de la grilla, en el orden en que está escrita.
  const celda = "lg:col-auto lg:row-auto lg:row-span-1";
  return (
    <li
      onClick={editable ? alTocarFila(() => onEditar(item)) : undefined}
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 px-4 py-1.5 text-sm leading-5 transition-colors hover:bg-[#F4F8F9] lg:min-h-[3rem] lg:gap-x-4 lg:py-0 ${columnas} ${editable ? "cursor-pointer" : ""} ${item.activo ? "" : "opacity-70"}`}
    >
      <div className={`col-start-1 row-start-1 min-w-0 ${celda}`}>
        <ItemDescripcion item={item} />
      </div>
      <span className={`col-start-1 row-start-2 tabular-nums lg:text-right ${celda}`}>
        <PrecioItem item={item} />
      </span>
      <span className={`hidden whitespace-nowrap ${TEXTO_SECUNDARIO} lg:block`}>{item.precio !== null && item.unidad ? item.unidad : ""}</span>
      {conStock &&
        (llevaStock(item) ? (
          <div className="col-span-2 row-start-3 mt-1 flex items-center justify-between lg:contents">
            <div className="flex items-center gap-3 lg:justify-center">
              <span aria-hidden="true" className={`${TEXTO_SECUNDARIO} lg:hidden`}>
                Stock
              </span>
              {editable ? <ControlStock item={item} onAbrir={setDialogo} /> : <StockNumero item={item} />}
            </div>
            <div className="flex justify-end lg:justify-center">{editable && <MenuStock item={item} onAbrir={setDialogo} />}</div>
          </div>
        ) : (
          <>
            <span className="contents lg:block">
              <StockNumero item={item} />
            </span>
            <span aria-hidden="true" className="hidden lg:block" />
          </>
        ))}
      <p className={`hidden whitespace-nowrap text-center ${TEXTO_SECUNDARIO} lg:block`}>
        <FechaActualizacion updatedAt={item.updated_at} />
      </p>
      <div className={`col-start-2 row-span-2 row-start-1 flex justify-end lg:justify-center ${celda}`}>
        {modoConsulta ? (
          <button type="button" onClick={() => onCopiar(item)} className={botonDe("suave", "px-3")}>
            <IconCopy className="h-4 w-4" />
            {copiado ? "¡Copiado!" : "Copiar"}
          </button>
        ) : (
          <BotonLapiz nombre={nombre} etiqueta="Editar" onClick={() => onEditar(item)} />
        )}
      </div>
      <DialogosStock item={item} dialogo={dialogo} onCerrar={() => setDialogo(null)} onResultado={onStockCambio} />
    </li>
  );
});

function ItemDescripcion({ item }: { item: ItemCatalogo }) {
  // Las piscinas de lista se leen por modelo y medida ("Caribe 550"); lo que
  // sigue a la raya larga ("contado, kit estándar instalado") va como detalle.
  const corto = nombreCortoLista(item.clave);
  const baja = !item.activo && <Pastilla className="ml-2 align-middle">Desactivado</Pastilla>;
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
 * El precio, siempre con el mismo estilo (números tabulares, alineado a la derecha
 * en su columna). "A cotizar" (sin precio fijo) es la excepción que pide ajuste
 * manual antes de mandarlo: va en una pastilla.
 */
function PrecioItem({ item }: { item: ItemCatalogo }) {
  if (item.precio === null) {
    return <Pastilla tono="aviso">A cotizar</Pastilla>;
  }
  return (
    <span className="font-semibold text-gray-900">
      <span className={COLUMNA_NUMERO}>{formatARS(item.precio)}</span>
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
