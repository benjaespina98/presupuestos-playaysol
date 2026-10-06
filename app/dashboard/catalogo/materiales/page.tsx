"use client";

import { useEffect, useMemo, useState } from "react";
import { listarMateriales, listarProveedores } from "@/lib/abastecimiento";
import {
  RUBROS_MATERIAL,
  contarMaterialesPorRubro,
  filtrarMateriales,
  ordenarMateriales,
  type Material,
} from "@/lib/domain/abastecimiento/material";
import type { Proveedor } from "@/lib/domain/abastecimiento/proveedor";
import { formatARS } from "@/lib/format/ars";
import { formatFechaCompleta, formatFechaRelativa } from "@/lib/format/fecha";
import { PanelPortal } from "@/components/PanelPortal";
import { IconEdit, IconPlus, IconSearch } from "@/components/icons";
import { Chip, Interruptor } from "@/components/catalogo/FiltrosCatalogo";
import { MaterialModal } from "@/components/abastecimiento/MaterialModal";

export default function MaterialesPage() {
  const [materiales, setMateriales] = useState<Material[] | null>(null);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [rubro, setRubro] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [soloSinPrecio, setSoloSinPrecio] = useState(false);
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [editando, setEditando] = useState<Material | null>(null);
  const [creando, setCreando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

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

  const nombreProveedor = useMemo(() => new Map(proveedores.map((p) => [p.id, p.nombre])), [proveedores]);

  const visibles = useMemo(
    () =>
      materiales
        ? ordenarMateriales(
            filtrarMateriales(materiales, {
              busqueda,
              rubro: rubro || null,
              proveedorId: proveedorId || null,
              soloSinPrecio,
              incluirInactivos,
            })
          )
        : null,
    [materiales, busqueda, rubro, proveedorId, soloSinPrecio, incluirInactivos]
  );

  const conteos = useMemo(
    () => contarMaterialesPorRubro(materiales ?? [], { busqueda, proveedorId: proveedorId || null, soloSinPrecio, incluirInactivos }),
    [materiales, busqueda, proveedorId, soloSinPrecio, incluirInactivos]
  );

  const sinPrecio = useMemo(
    () => (materiales ? materiales.filter((m) => (incluirInactivos || m.activo) && m.precio === null).length : 0),
    [materiales, incluirInactivos]
  );

  const rubrosVisibles = [...RUBROS_MATERIAL, "Sin rubro"].filter((r) => (conteos.porRubro[r] ?? 0) > 0 || r === rubro);
  const hayFiltros = !!(busqueda || rubro || proveedorId || soloSinPrecio || incluirInactivos);

  function limpiar() {
    setBusqueda("");
    setRubro("");
    setProveedorId("");
    setSoloSinPrecio(false);
    setIncluirInactivos(false);
  }

  return (
    <PanelPortal>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Materiales</h1>
          <p className="mt-1 text-sm text-gray-500">
            Lo que se compra para las obras: proveedor, precio de costo y cantidades por tamaño de pileta.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setMensaje(null);
            setCreando(true);
          }}
          className="flex min-h-11 items-center gap-1.5 rounded-lg bg-[#1B3A5C] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#142c46]"
        >
          <IconPlus className="h-4 w-4" />
          Agregar material
        </button>
      </div>

      <div className="mb-5 space-y-3">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar material..."
            aria-label="Buscar materiales"
            className="min-h-12 w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20"
          />
        </div>

        <div
          role="group"
          aria-label="Filtrar por rubro"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0"
        >
          <Chip activo={rubro === ""} onClick={() => setRubro("")} cantidad={conteos.total}>
            Todos
          </Chip>
          {rubrosVisibles.map((r) => (
            <Chip key={r} activo={rubro === r} onClick={() => setRubro(rubro === r ? "" : r)} cantidad={conteos.porRubro[r] ?? 0}>
              {r}
            </Chip>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <select
            value={proveedorId}
            onChange={(e) => setProveedorId(e.target.value)}
            aria-label="Filtrar por proveedor"
            className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20 sm:w-auto"
          >
            <option value="">Todos los proveedores</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          <Chip activo={soloSinPrecio} onClick={() => setSoloSinPrecio(!soloSinPrecio)} cantidad={sinPrecio}>
            A confirmar
          </Chip>
          <Interruptor checked={incluirInactivos} onChange={setIncluirInactivos}>
            Mostrar dados de baja
          </Interruptor>
          {hayFiltros && (
            <button type="button" onClick={limpiar} className="min-h-11 rounded-lg px-3 text-sm font-medium text-[#1B3A5C] hover:bg-[#1B3A5C]/8">
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {mensaje && (
        <p role="status" className="mb-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
          {mensaje}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {!error && materiales === null && <p className="text-sm text-gray-500">Cargando…</p>}

      {!error && visibles && visibles.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
          {hayFiltros ? "Ningún material coincide con el filtro." : "Todavía no hay materiales cargados."}
        </div>
      )}

      {!error && visibles && visibles.length > 0 && (
        <>
          <p className="mb-3 text-xs text-gray-500">
            {visibles.length} {visibles.length === 1 ? "material" : "materiales"}
            {hayFiltros && materiales ? ` de ${materiales.length}` : ""}
          </p>
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            {visibles.map((m) => (
              <FilaMaterial
                key={m.id}
                material={m}
                proveedor={m.proveedor_id ? nombreProveedor.get(m.proveedor_id) ?? null : null}
                onEditar={() => {
                  setMensaje(null);
                  setEditando(m);
                }}
              />
            ))}
          </ul>
        </>
      )}

      {editando && (
        <MaterialModal
          key={editando.id}
          material={editando}
          proveedores={proveedores}
          onClose={() => setEditando(null)}
          onGuardado={(m) => {
            setMateriales((prev) => (prev ? prev.map((x) => (x.id === m.id ? m : x)) : prev));
            setEditando(null);
            setMensaje(`Se guardó "${m.nombre}".`);
          }}
          onEliminado={(m) => {
            setMateriales((prev) => (prev ? prev.filter((x) => x.id !== m.id) : prev));
            setEditando(null);
            setMensaje(`Se eliminó "${m.nombre}".`);
          }}
        />
      )}

      {creando && (
        <MaterialModal
          material={null}
          proveedores={proveedores}
          onClose={() => setCreando(false)}
          onGuardado={(m) => {
            setMateriales((prev) => (prev ? [...prev, m] : [m]));
            setCreando(false);
            setMensaje(`Se agregó "${m.nombre}".`);
          }}
          onEliminado={() => undefined}
        />
      )}
    </PanelPortal>
  );
}

function FilaMaterial({
  material: m,
  proveedor,
  onEditar,
}: {
  material: Material;
  proveedor: string | null;
  onEditar: () => void;
}) {
  const relativa = m.precio_actualizado ? formatFechaRelativa(m.precio_actualizado) : "";
  return (
    <li className={`flex flex-col gap-3 p-4 transition-colors hover:bg-gray-50/70 sm:flex-row sm:items-center ${m.activo ? "" : "opacity-60"}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-gray-900">{m.nombre}</p>
          {m.rubro && <span className="rounded-md bg-[#EEF2F6] px-2 py-0.5 text-xs font-medium text-[#1B3A5C]">{m.rubro}</span>}
          {m.aplica && m.aplica !== "Siempre" && (
            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{m.aplica}</span>
          )}
          {!m.activo && <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">De baja</span>}
        </div>
        <p className="mt-0.5 text-sm text-gray-600">{proveedor ?? <span className="text-gray-400">Sin proveedor</span>}</p>
        {m.notas && <p className="mt-1 line-clamp-2 text-xs text-gray-500">{m.notas}</p>}
      </div>

      <div className="flex items-baseline justify-between gap-4 sm:w-44 sm:flex-col sm:items-end sm:justify-center sm:gap-0.5">
        {m.precio === null ? (
          <span className="inline-flex items-center whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
            A confirmar
          </span>
        ) : (
          <span className="whitespace-nowrap font-medium tabular-nums text-gray-900">
            {formatARS(m.precio)}
            {m.unidad && <span className="font-normal text-gray-400"> / {m.unidad}</span>}
          </span>
        )}
        {relativa && (
          <span className="text-xs text-gray-400" title={formatFechaCompleta(m.precio_actualizado!)}>
            {relativa}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onEditar}
        aria-label={`Editar ${m.nombre}`}
        className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-md px-3 text-sm font-medium text-[#1B3A5C] hover:bg-[#1B3A5C]/8 sm:self-center"
      >
        <IconEdit className="h-4 w-4" />
        Editar
      </button>
    </li>
  );
}
