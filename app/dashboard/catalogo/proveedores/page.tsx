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
import { BarraFiltros } from "@/components/catalogo/BarraFiltros";
import { EncabezadoPagina } from "@/components/catalogo/EncabezadoPagina";
import { Chip, Interruptor } from "@/components/catalogo/FiltrosCatalogo";
import { ProveedorModal } from "@/components/abastecimiento/ProveedorModal";

/** Las columnas de la lista en pantallas medianas y grandes: Proveedor · Contacto · Teléfono · Materiales · acción. */
const COLUMNAS = "md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_13rem_6rem_5.5rem]";

/** "Rodrigo +54 9 3534 23-2878 / Luciano +54 9 3534 08-3660" → un teléfono por línea. */
function telefonosDe(texto: string): string[] {
  return texto
    .split(/\s*\/\s*/)
    .map((t) => t.trim())
    .filter(Boolean);
}

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
    <PanelPortal compacto>
      <EncabezadoPagina titulo="Proveedores" descripcion="A quién se le compra, cómo contactarlo y qué se le pide.">
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
      </EncabezadoPagina>

      <BarraFiltros>
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, rubro o contacto..."
            aria-label="Buscar proveedores"
            className="min-h-11 w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20"
          />
        </div>
      </BarraFiltros>

      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-0.5">
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
            className="min-h-11 rounded-lg px-3 text-sm font-medium text-[#1B3A5C] hover:bg-[#1B3A5C]/8 sm:ml-auto"
          >
            Limpiar filtros
          </button>
        )}
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
          <p className="mb-2 text-xs text-gray-500">
            {visibles.length} {visibles.length === 1 ? "proveedor" : "proveedores"}
            {hayFiltros && proveedores ? ` de ${proveedores.length}` : ""}
          </p>
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div
              aria-hidden="true"
              className={`hidden rounded-t-lg border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-500 md:sticky md:top-[var(--catalogo-barra,0px)] md:z-10 md:grid md:items-center md:gap-x-4 ${COLUMNAS}`}
            >
              <span>Proveedor</span>
              <span>Contacto</span>
              <span>Teléfono</span>
              <span className="text-right">Materiales</span>
              <span />
            </div>
            <ul className="divide-y divide-gray-100">
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
          </div>
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
    <li
      className={`flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-gray-50/70 md:grid md:items-center md:gap-x-4 md:gap-y-0 md:py-2.5 ${COLUMNAS} ${p.activo ? "" : "opacity-60"}`}
    >
      {/* Proveedor: nombre + rubro y, abajo, la nota en una sola línea (completa al pasar el mouse). */}
      <div className="min-w-0 basis-full md:basis-auto">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-gray-900">
          {p.nombre}
          {p.rubro && <span className="rounded-md bg-[#EEF2F6] px-2 py-0.5 text-xs font-medium text-[#1B3A5C]">{p.rubro}</span>}
          {!p.activo && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">De baja</span>}
        </p>
        {p.notas && (
          <p className="mt-0.5 line-clamp-1 text-xs text-gray-500" title={p.notas}>
            {p.notas}
          </p>
        )}
      </div>

      <p className="min-w-0 basis-full text-sm text-gray-700 md:basis-auto" title={p.contacto ?? undefined}>
        <span className="line-clamp-2">{p.contacto ?? <span className="text-gray-400">—</span>}</span>
      </p>

      <div className="min-w-0 basis-full space-y-0.5 text-sm md:basis-auto">
        {falta ? (
          <span className="inline-flex items-center whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
            Falta teléfono
          </span>
        ) : (
          telefonosDe(p.telefono!).map((t) => (
            <a key={t} href={`tel:${t.replace(/[^\d+]/g, "")}`} className="block text-[#1B3A5C] hover:underline">
              {t}
            </a>
          ))
        )}
        {(p.forma_pago || p.plazo) && <p className="text-xs text-gray-500">{[p.forma_pago, p.plazo].filter(Boolean).join(" · ")}</p>}
      </div>

      <p className="text-xs text-gray-500 md:text-right md:text-sm">
        {materiales === 0 ? "Sin materiales" : `${materiales} ${materiales === 1 ? "material" : "materiales"}`}
      </p>

      <button
        type="button"
        onClick={onEditar}
        aria-label={`Editar ${p.nombre}`}
        title="Editar"
        className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-[#1B3A5C] hover:bg-[#1B3A5C]/8 md:ml-0"
      >
        <IconEdit className="h-[18px] w-[18px]" />
      </button>
    </li>
  );
}
