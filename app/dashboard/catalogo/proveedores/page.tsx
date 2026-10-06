"use client";

import { useEffect, useMemo, useState } from "react";
import { listarMateriales, listarProveedores } from "@/lib/abastecimiento";
import {
  filtrarProveedores,
  ordenarProveedores,
  sinTelefono,
  type Proveedor,
} from "@/lib/domain/abastecimiento/proveedor";
import { materialesPorProveedor, type Material } from "@/lib/domain/abastecimiento/material";
import { PanelPortal } from "@/components/PanelPortal";
import { IconEdit, IconPlus, IconSearch } from "@/components/icons";
import { Chip, Interruptor } from "@/components/catalogo/FiltrosCatalogo";
import { ProveedorModal } from "@/components/abastecimiento/ProveedorModal";

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[] | null>(null);
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [soloSinTelefono, setSoloSinTelefono] = useState(false);
  const [editando, setEditando] = useState<Proveedor | null>(null);
  const [creando, setCreando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const [p, m] = await Promise.all([listarProveedores(), listarMateriales()]);
      if (cancelado) return;
      if (p.error) setError(p.error);
      else setProveedores(p.items);
      // Los materiales sólo sirven para el contador: si no cargan, no se muestra y listo.
      if (m.items) setMateriales(m.items);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const conteo = useMemo(() => materialesPorProveedor(materiales), [materiales]);

  const visibles = useMemo(
    () =>
      proveedores
        ? ordenarProveedores(filtrarProveedores(proveedores, { busqueda, incluirInactivos, soloSinTelefono }))
        : null,
    [proveedores, busqueda, incluirInactivos, soloSinTelefono]
  );

  const faltanTelefono = useMemo(
    () => (proveedores ? proveedores.filter((p) => (incluirInactivos || p.activo) && sinTelefono(p)).length : 0),
    [proveedores, incluirInactivos]
  );

  const hayFiltros = !!(busqueda || incluirInactivos || soloSinTelefono);

  return (
    <PanelPortal>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Proveedores</h1>
          <p className="mt-1 text-sm text-gray-500">A quién se le compra, cómo contactarlo y qué se le pide.</p>
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
          Agregar proveedor
        </button>
      </div>

      <div className="mb-5 space-y-3">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, rubro o contacto..."
            aria-label="Buscar proveedores"
            className="min-h-12 w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Chip activo={soloSinTelefono} onClick={() => setSoloSinTelefono(!soloSinTelefono)} cantidad={faltanTelefono}>
            Sin teléfono
          </Chip>
          <Interruptor checked={incluirInactivos} onChange={setIncluirInactivos}>
            Mostrar dados de baja
          </Interruptor>
          {hayFiltros && (
            <button
              type="button"
              onClick={() => {
                setBusqueda("");
                setIncluirInactivos(false);
                setSoloSinTelefono(false);
              }}
              className="min-h-11 rounded-lg px-3 text-sm font-medium text-[#1B3A5C] hover:bg-[#1B3A5C]/8"
            >
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
      {!error && proveedores === null && <p className="text-sm text-gray-500">Cargando…</p>}

      {!error && visibles && visibles.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
          {hayFiltros ? "Ningún proveedor coincide con el filtro." : "Todavía no hay proveedores cargados."}
        </div>
      )}

      {!error && visibles && visibles.length > 0 && (
        <>
          <p className="mb-3 text-xs text-gray-500">
            {visibles.length} {visibles.length === 1 ? "proveedor" : "proveedores"}
            {hayFiltros && proveedores ? ` de ${proveedores.length}` : ""}
          </p>
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            {visibles.map((p) => (
              <FilaProveedor
                key={p.id}
                proveedor={p}
                materiales={conteo[p.id] ?? 0}
                onEditar={() => {
                  setMensaje(null);
                  setEditando(p);
                }}
              />
            ))}
          </ul>
        </>
      )}

      {editando && (
        <ProveedorModal
          key={editando.id}
          proveedor={editando}
          cantidadMateriales={conteo[editando.id] ?? 0}
          onClose={() => setEditando(null)}
          onGuardado={(p) => {
            setProveedores((prev) => (prev ? prev.map((x) => (x.id === p.id ? p : x)) : prev));
            setEditando(null);
            setMensaje(`Se guardó "${p.nombre}".`);
          }}
          onEliminado={(p) => {
            setProveedores((prev) => (prev ? prev.filter((x) => x.id !== p.id) : prev));
            // Sus materiales quedan sin proveedor (on delete set null): el contador local lo refleja.
            setMateriales((prev) => prev.map((m) => (m.proveedor_id === p.id ? { ...m, proveedor_id: null } : m)));
            setEditando(null);
            setMensaje(`Se eliminó "${p.nombre}".`);
          }}
        />
      )}

      {creando && (
        <ProveedorModal
          proveedor={null}
          onClose={() => setCreando(false)}
          onGuardado={(p) => {
            setProveedores((prev) => (prev ? [...prev, p] : [p]));
            setCreando(false);
            setMensaje(`Se agregó "${p.nombre}".`);
          }}
          onEliminado={() => undefined}
        />
      )}
    </PanelPortal>
  );
}

function FilaProveedor({
  proveedor: p,
  materiales,
  onEditar,
}: {
  proveedor: Proveedor;
  materiales: number;
  onEditar: () => void;
}) {
  const falta = sinTelefono(p);
  return (
    <li className={`flex flex-col gap-3 p-4 transition-colors hover:bg-gray-50/70 sm:flex-row sm:items-center ${p.activo ? "" : "opacity-60"}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-gray-900">{p.nombre}</p>
          {p.rubro && (
            <span className="rounded-md bg-[#EEF2F6] px-2 py-0.5 text-xs font-medium text-[#1B3A5C]">{p.rubro}</span>
          )}
          {!p.activo && <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">De baja</span>}
        </div>
        {p.contacto && <p className="mt-0.5 text-sm text-gray-600">{p.contacto}</p>}
        {p.notas && <p className="mt-1 line-clamp-2 text-xs text-gray-500">{p.notas}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm sm:w-72 sm:flex-col sm:items-start sm:gap-y-0.5">
        {falta ? (
          <span className="inline-flex items-center whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
            Falta teléfono
          </span>
        ) : (
          <a href={`tel:${p.telefono!.replace(/[^\d+]/g, "")}`} className="whitespace-nowrap text-[#1B3A5C] hover:underline">
            {p.telefono}
          </a>
        )}
        {(p.forma_pago || p.plazo) && (
          <span className="text-xs text-gray-500">{[p.forma_pago, p.plazo].filter(Boolean).join(" · ")}</span>
        )}
        <span className="text-xs text-gray-400">
          {materiales === 0 ? "Sin materiales" : `${materiales} ${materiales === 1 ? "material" : "materiales"}`}
        </span>
      </div>

      <button
        type="button"
        onClick={onEditar}
        aria-label={`Editar ${p.nombre}`}
        className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-md px-3 text-sm font-medium text-[#1B3A5C] hover:bg-[#1B3A5C]/8 sm:self-center"
      >
        <IconEdit className="h-4 w-4" />
        Editar
      </button>
    </li>
  );
}
