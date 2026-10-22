"use client";

import { botonDe } from "@/components/ui/botones";
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
import { IconPlus } from "@/components/icons";
import { Buscador, FiltrosPlegables } from "@/components/ui/FiltrosPlegables";
import { useEstadoPersistente } from "@/lib/useEstadoPersistente";
import { BarraFiltros } from "@/components/catalogo/BarraFiltros";
import { EncabezadoPagina } from "@/components/catalogo/EncabezadoPagina";
import { Chip, Interruptor } from "@/components/catalogo/FiltrosCatalogo";
import { ProveedorModal } from "@/components/abastecimiento/ProveedorModal";

/** Las columnas de la lista en pantallas medianas y grandes: Proveedor · Contacto · Teléfono · Materiales · acción. */
const COLUMNAS = "md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_13rem_7rem]";

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
  // La búsqueda y los filtros se conservan al abrir otra pantalla y volver.
  const [filtros, setFiltros] = useEstadoPersistente<{ busqueda: string; incluirInactivos: boolean; soloSinTelefono: boolean }>("proveedores:filtros", {
    busqueda: "",
    incluirInactivos: false,
    soloSinTelefono: false,
  });
  const { busqueda, incluirInactivos, soloSinTelefono } = filtros;
  const cambiar = (parcial: Partial<typeof filtros>) => setFiltros({ ...filtros, ...parcial });
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

  const filtrosActivos = [incluirInactivos, soloSinTelefono].filter(Boolean).length;

  return (
    <PanelPortal compacto amplio>
      <EncabezadoPagina titulo="Proveedores" descripcion="A quién se le compra, cómo contactarlo y qué se le pide.">
        <button
          type="button"
          onClick={() => {
            setMensaje(null);
            setCreando(true);
          }}
          aria-label="Agregar proveedor"
          className={botonDe("primario", "px-4")}
        >
          <IconPlus className="h-4 w-4" />
          Agregar<span className="hidden sm:inline"> proveedor</span>
        </button>
      </EncabezadoPagina>

      <BarraFiltros>
        <FiltrosPlegables
          filtrosActivos={filtrosActivos}
          buscador={<Buscador valor={busqueda} onCambio={(v) => cambiar({ busqueda: v })} placeholder="Buscar por nombre, rubro o contacto..." etiqueta="Buscar proveedores" />}
        >
          <div className="flex flex-wrap items-center gap-x-5 gap-y-0.5">
            <Chip activo={soloSinTelefono} onClick={() => cambiar({ soloSinTelefono: !soloSinTelefono })} cantidad={faltanTelefono}>
              Sin teléfono
            </Chip>
            <Interruptor checked={incluirInactivos} onChange={(v) => cambiar({ incluirInactivos: v })}>
              Mostrar desactivados
            </Interruptor>
            {hayFiltros && (
              <button
                type="button"
                onClick={() => setFiltros({ busqueda: "", incluirInactivos: false, soloSinTelefono: false })}
                className="min-h-11 rounded-lg px-3 text-sm font-medium text-marca hover:bg-marca/8 sm:ml-auto"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </FiltrosPlegables>
      </BarraFiltros>

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
      {!error && proveedores === null && <p className="py-6 text-center text-sm text-gray-500">Cargando proveedores…</p>}

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
        />
      )}
    </PanelPortal>
  );
}

/**
 * Una fila de proveedor. Toda la fila abre la edición (el botón del nombre se estira sobre la fila);
 * los teléfonos siguen siendo links para llamar, por encima de esa capa. En el celular: nombre y
 * contacto a la izquierda, teléfono y cantidad de materiales a la derecha.
 */
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
      className={`relative grid min-h-[3.35rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-1 transition-colors hover:bg-marca/5 has-[button:active]:bg-marca/10 md:min-h-12 md:gap-x-4 ${COLUMNAS} ${p.activo ? "" : "opacity-60"}`}
    >
      <div className="min-w-0 md:contents">
        <button
          type="button"
          onClick={onEditar}
          aria-label={`Editar ${p.nombre}`}
          className="flex min-w-0 items-center gap-2 text-left after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded focus-visible:after:ring-2 focus-visible:after:ring-celeste"
        >
          <span className="truncate text-sm font-medium text-gray-900">{p.nombre}</span>
          {p.rubro && <span className="hidden shrink-0 rounded-md bg-[#EEF2F6] px-2 py-0.5 text-xs font-medium text-marca md:inline">{p.rubro}</span>}
          {!p.activo && <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">Desactivado</span>}
        </button>
        <p className="min-w-0 truncate text-xs text-gray-500 md:text-sm md:text-gray-700" title={p.contacto ?? undefined}>
          {p.contacto ?? <span className="text-gray-400">{p.rubro ?? ""}</span>}
        </p>
      </div>

      <div className="flex min-w-0 flex-col items-end gap-0.5 text-right md:contents">
        <div className="relative z-10 min-w-0 space-y-0.5 text-sm md:text-left">
          {falta ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-amber-700">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Falta teléfono
            </span>
          ) : (
            telefonosDe(p.telefono!).map((t) => (
              <a key={t} href={`tel:${t.replace(/[^\d+]/g, "")}`} className="block truncate text-marca hover:underline">
                {t}
              </a>
            ))
          )}
        </div>
        <p className="text-xs text-gray-500 md:text-right md:text-sm">
          {materiales === 0 ? "Sin materiales" : `${materiales} ${materiales === 1 ? "material" : "materiales"}`}
        </p>
      </div>
    </li>
  );
}
