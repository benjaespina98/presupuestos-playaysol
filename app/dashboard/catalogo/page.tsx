"use client";

import { useEffect, useMemo, useState } from "react";
import { listarItemsCatalogo } from "@/lib/catalogo";
import {
  categoriaEfectiva,
  filtrarCatalogo,
  ordenarCatalogo,
  type ItemCatalogo,
} from "@/lib/domain/catalogo/item";
import { CATEGORIAS, type Categoria } from "@/lib/domain/catalogo/categorias";
import { formatARS } from "@/lib/format/ars";
import { PanelPortal } from "@/components/PanelPortal";
import { IconEdit, IconSearch } from "@/components/icons";
import { EditarItemModal } from "@/components/catalogo/EditarItemModal";
import type { TipoCalculadora } from "@/lib/presupuestos";

const TITULOS_TIPO: Record<TipoCalculadora, string> = {
  piscinas: "Piscinas",
  cercos: "Cercos",
  cobertores: "Cobertores",
  losetas: "Plano de Piscina",
  revestimientos: "Revestimientos",
};

export default function CatalogoPage() {
  const [items, setItems] = useState<ItemCatalogo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<Categoria | "">("");
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [editando, setEditando] = useState<ItemCatalogo | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

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
      filtrarCatalogo(items, { busqueda, categoria: categoria || null, incluirInactivos })
    );
  }, [items, busqueda, categoria, incluirInactivos]);

  const hayFiltros = !!(busqueda || categoria || incluirInactivos);

  function abrirEdicion(item: ItemCatalogo) {
    setMensajeExito(null);
    setEditando(item);
  }

  function guardarEdicion(actualizado: ItemCatalogo) {
    setItems((prev) => (prev ? prev.map((it) => (it.id === actualizado.id ? actualizado : it)) : prev));
    setEditando(null);
    setMensajeExito(`Se guardó "${actualizado.descripcion || actualizado.clave}".`);
  }

  return (
    <PanelPortal>
      <h1 className="text-2xl font-semibold text-gray-900">Catálogo</h1>
      <p className="mb-6 mt-1 text-sm text-gray-500">
        Precios y descripciones de materiales y opcionales, compartidos por todo el equipo.
      </p>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value as Categoria | "")}
          aria-label="Filtrar por categoría"
          className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-[#1B3A5C] focus:outline-none sm:w-auto"
        >
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <div className="relative w-full sm:max-w-sm">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o clave..."
            aria-label="Buscar en el catálogo"
            className="w-full rounded-md border border-gray-300 py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#1B3A5C] focus:outline-none"
          />
        </div>

        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={incluirInactivos}
            onChange={(e) => setIncluirInactivos(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-[#1B3A5C] focus:ring-2 focus:ring-[#1B3A5C]/30"
          />
          Mostrar dados de baja
        </label>
      </div>

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

          {/* Desktop / tablet: tabla completa */}
          <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm sm:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-700">
                  <th className="px-4 py-3 font-medium">Categoría</th>
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium">Calculadora</th>
                  <th className="px-4 py-3 font-medium">Precio</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 text-gray-700">{categoriaEfectiva(item)}</td>
                    <td className="px-4 py-3 text-gray-900">
                      <ItemDescripcion item={item} />
                    </td>
                    <td className="px-4 py-3 text-gray-700">{TITULOS_TIPO[item.tipo]}</td>
                    <td className="px-4 py-3 text-gray-700">
                      <PrecioItem item={item} />
                    </td>
                    <td className="px-4 py-3">
                      <EstadoBadge activo={item.activo} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => abrirEdicion(item)}
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-[#1B3A5C] hover:bg-[#1B3A5C]/8"
                      >
                        <IconEdit className="h-4 w-4" />
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: tarjetas */}
          <div className="flex flex-col gap-3 sm:hidden">
            {visibles.map((item) => (
              <div key={item.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <ItemDescripcion item={item} />
                    <p className="mt-0.5 text-xs text-gray-400">
                      {categoriaEfectiva(item)} · {TITULOS_TIPO[item.tipo]}
                    </p>
                  </div>
                  <EstadoBadge activo={item.activo} />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">
                    <PrecioItem item={item} />
                  </p>
                  <button
                    type="button"
                    onClick={() => abrirEdicion(item)}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-[#1B3A5C] hover:bg-[#1B3A5C]/8"
                  >
                    <IconEdit className="h-4 w-4" />
                    Editar
                  </button>
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
        />
      )}
    </PanelPortal>
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

function PrecioItem({ item }: { item: ItemCatalogo }) {
  if (item.precio === null) {
    return <span className="italic text-gray-500">A cotizar</span>;
  }
  return (
    <>
      {formatARS(item.precio)}
      {item.unidad && <span className="text-gray-400"> / {item.unidad}</span>}
    </>
  );
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
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-gray-700">
              <th className="px-4 py-3 font-medium">Categoría</th>
              <th className="px-4 py-3 font-medium">Producto</th>
              <th className="px-4 py-3 font-medium">Calculadora</th>
              <th className="px-4 py-3 font-medium">Precio</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <tr key={i} className="animate-pulse border-b border-gray-100 last:border-0">
                <td className="px-4 py-3"><div className="h-3.5 w-20 rounded bg-gray-200" /></td>
                <td className="px-4 py-3"><div className="h-3.5 w-40 rounded bg-gray-200" /></td>
                <td className="px-4 py-3"><div className="h-3.5 w-20 rounded bg-gray-200" /></td>
                <td className="px-4 py-3"><div className="h-3.5 w-16 rounded bg-gray-200" /></td>
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
