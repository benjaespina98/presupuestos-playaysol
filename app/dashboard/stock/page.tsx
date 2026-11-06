"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { listarItemsCatalogo } from "@/lib/catalogo";
import {
  agruparParaListado,
  contarPorStock,
  filtrarCatalogo,
  llevaStock,
  textoResumenStock,
  type FiltroStock,
  type ItemCatalogo,
} from "@/lib/domain/catalogo/item";
import { nombreCortoLista } from "@/lib/domain/catalogo/listas";
import type { ResultadoStock } from "@/lib/domain/stock/movimientos";
import { useBusquedaDeUrl } from "@/lib/useBusquedaDeUrl";
import { useEstadoPersistente } from "@/lib/useEstadoPersistente";
import { PanelPortal } from "@/components/PanelPortal";
import { EncabezadoPagina } from "@/components/catalogo/EncabezadoPagina";
import { ControlStock, DialogosStock, MenuStock, type DialogoStock } from "@/components/stock/StockControles";
import { mensajeDeStock } from "@/components/stock/mensajesStock";
import { Aviso } from "@/components/ui/Aviso";
import { Toast } from "@/components/ui/BarraListado";
import { botonDe } from "@/components/ui/botones";
import { ListaCargando, ListaVacia } from "@/components/ui/EstadoLista";
import { Buscador } from "@/components/ui/FiltrosPlegables";
import { LISTA_SEPARADORES, TEXTO_SECUNDARIO } from "@/components/ui/lista";
import { Segmentado } from "@/components/ui/Segmentado";

type Filtro = FiltroStock | "";
interface Filtros {
  busqueda: string;
  stock: Filtro;
}
const SIN_FILTROS: Filtros = { busqueda: "", stock: "" };

export default function StockPage() {
  const [items, setItems] = useState<ItemCatalogo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // La búsqueda y el filtro se conservan al salir y volver.
  const [filtros, setFiltros] = useEstadoPersistente<Filtros>("stock:filtros", SIN_FILTROS);
  const busqueda = useDeferredValue(filtros.busqueda);
  useBusquedaDeUrl((b) => setFiltros({ ...SIN_FILTROS, busqueda: b }));
  const [aviso, setAviso] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    listarItemsCatalogo().then((r) => {
      if (cancelado) return;
      if (r.error) setError(r.error);
      else setItems(r.items);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  // Sólo lo que lleva stock y está activo: lo demás se pide a pedido.
  const conStock = useMemo(() => (items ?? []).filter((i) => i.activo && llevaStock(i)), [items]);
  const resumen = useMemo(() => textoResumenStock(conStock), [conStock]);
  const conteos = useMemo(() => contarPorStock(conStock, { busqueda }), [conStock, busqueda]);
  const total = useMemo(() => filtrarCatalogo(conStock, { busqueda }).length, [conStock, busqueda]);
  const grupos = useMemo(
    () => agruparParaListado(filtrarCatalogo(conStock, { busqueda, stock: filtros.stock || null })),
    [conStock, busqueda, filtros.stock]
  );

  const hayFiltros = filtros.busqueda.trim() !== "" || filtros.stock !== "";
  const opciones = [
    { id: "" as Filtro, texto: `Todas (${total})` },
    { id: "disponible" as Filtro, texto: `Con stock (${conteos.disponible})` },
    { id: "agotado" as Filtro, texto: `Agotadas (${conteos.agotado})` },
    { id: "negativo" as Filtro, texto: `Negativas (${conteos.negativo})` },
  ];

  /** El stock pasa a lo que dice la base (el número NO se calcula acá) y se avisa lo que corresponda. */
  const stockCambio = useCallback((item: ItemCatalogo, r: ResultadoStock) => {
    const nombre = nombreCortoLista(item.clave) ?? (item.descripcion || item.clave);
    setItems((prev) => (prev ? prev.map((it) => (it.id === item.id ? { ...it, stock: r.stock_resultante } : it)) : prev));
    const { exito, aviso } = mensajeDeStock(nombre, r);
    setMensaje(exito);
    setAviso(aviso);
  }, []);
  const cerrarToast = useCallback(() => setMensaje(null), []);

  return (
    <PanelPortal>
      <EncabezadoPagina titulo="Stock" descripcion="Piscinas Indusplast en el local: sumar, restar y corregir el stock." />

      <Buscador
        valor={filtros.busqueda}
        onCambio={(b) => setFiltros({ ...filtros, busqueda: b })}
        placeholder="Buscar modelo o medida"
        etiqueta="Buscar en el stock"
      />
      <div className="mt-3">
        <Segmentado
          etiqueta="Filtrar por stock"
          opciones={opciones}
          valor={filtros.stock}
          onCambio={(stock) => setFiltros({ ...filtros, stock })}
          envolver
        />
      </div>
      {resumen && <p className={`mt-3 ${TEXTO_SECUNDARIO}`}>{resumen}</p>}

      {error && (
        <Aviso tono="error" className="mt-3">
          {error}
        </Aviso>
      )}
      {aviso && (
        <Aviso tono="aviso" urgente className="mt-3">
          {aviso}
        </Aviso>
      )}

      <div className="mt-3">
        {!error && items === null && <ListaCargando />}

        {!error && items && grupos.length === 0 && (
          <ListaVacia
            accion={
              hayFiltros ? (
                <button type="button" onClick={() => setFiltros(SIN_FILTROS)} className={botonDe("secundario", "px-4")}>
                  Limpiar filtros
                </button>
              ) : undefined
            }
          >
            {hayFiltros ? "Ningún modelo coincide con el filtro." : "Todavía no hay modelos con stock cargado."}
          </ListaVacia>
        )}

        <div className="space-y-3">
          {grupos.map((g) => (
            <section key={g.id} aria-label={g.titulo} className="overflow-hidden rounded-lg border border-[#D9DFE3] bg-[#FFFFFF]">
              <h2 className="flex h-9 items-center gap-1.5 border-b border-[#D9DFE3] bg-[#F4F8F9] px-4 text-[13px] font-bold uppercase tracking-wide text-[#244B5A]">
                {g.titulo}
                <span className="font-normal text-[#4A5861]">({g.items.length})</span>
              </h2>
              <ul className={LISTA_SEPARADORES}>
                {g.items.map((item) => (
                  <FilaStock key={item.id} item={item} onStockCambio={stockCambio} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>

      <Toast mensaje={mensaje} onCerrar={cerrarToast} />
    </PanelPortal>
  );
}

/** Un modelo: el nombre a la izquierda y, a la derecha, − número + y el menú con Corregir stock y Ver movimientos. */
const FilaStock = memo(function FilaStock({
  item,
  onStockCambio,
}: {
  item: ItemCatalogo;
  onStockCambio: (item: ItemCatalogo, resultado: ResultadoStock) => void;
}) {
  const [dialogo, setDialogo] = useState<DialogoStock>(null);
  return (
    <li className="flex min-h-[3.5rem] items-center gap-2 px-4 py-1.5">
      <p className="line-clamp-2 min-w-0 flex-1 break-words text-[15px] font-medium text-gray-900">
        {nombreCortoLista(item.clave) ?? (item.descripcion || item.clave)}
      </p>
      <ControlStock item={item} onAbrir={setDialogo} />
      <MenuStock item={item} onAbrir={setDialogo} />
      <DialogosStock item={item} dialogo={dialogo} onCerrar={() => setDialogo(null)} onResultado={onStockCambio} />
    </li>
  );
});
