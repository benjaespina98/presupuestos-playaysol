"use client";

import { botonDe } from "@/components/ui/botones";
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
import { useEstadoPersistente } from "@/lib/useEstadoPersistente";
import { PanelPortal } from "@/components/PanelPortal";
import { IconPlus } from "@/components/icons";
import { BarraFiltros } from "@/components/catalogo/BarraFiltros";
import { EncabezadoPagina } from "@/components/catalogo/EncabezadoPagina";
import { CLASE_SELECT, Chip, Interruptor } from "@/components/catalogo/FiltrosCatalogo";
import { Buscador, FiltrosPlegables } from "@/components/ui/FiltrosPlegables";
import { MaterialModal } from "@/components/abastecimiento/MaterialModal";

/** Las columnas de la tabla en pantallas medianas y grandes: Material · Proveedor · Categoría · Precio · Unidad · Actualizado. */
const COLUMNAS = "md:grid-cols-[minmax(0,1fr)_11rem_9rem_8rem_6rem_6.5rem]";

interface Filtros {
  busqueda: string;
  rubro: string;
  proveedorId: string;
  soloSinPrecio: boolean;
  incluirInactivos: boolean;
}
const SIN_FILTROS: Filtros = { busqueda: "", rubro: "", proveedorId: "", soloSinPrecio: false, incluirInactivos: false };

export default function MaterialesPage() {
  const [materiales, setMateriales] = useState<Material[] | null>(null);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [error, setError] = useState<string | null>(null);
  // La búsqueda y los filtros se conservan al abrir otra pantalla y volver.
  const [filtros, setFiltros] = useEstadoPersistente<Filtros>("materiales:filtros", SIN_FILTROS);
  const { busqueda, rubro, proveedorId, soloSinPrecio, incluirInactivos } = filtros;
  const cambiar = (parcial: Partial<Filtros>) => setFiltros({ ...filtros, ...parcial });
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

  // Por categoría, con encabezados livianos que quedan fijos al bajar (sólo en el celular: en escritorio es una tabla).
  const grupos = useMemo(() => {
    const porRubro = new Map<string, Material[]>();
    for (const m of visibles ?? []) {
      const clave = m.rubro ?? "Sin rubro";
      porRubro.set(clave, [...(porRubro.get(clave) ?? []), m]);
    }
    return [...porRubro.entries()].sort(([a], [b]) => (a === "Sin rubro" ? 1 : b === "Sin rubro" ? -1 : a.localeCompare(b, "es")));
  }, [visibles]);

  const rubrosVisibles = [...RUBROS_MATERIAL, "Sin rubro"].filter((r) => (conteos.porRubro[r] ?? 0) > 0 || r === rubro);
  const hayFiltros = !!(busqueda || rubro || proveedorId || soloSinPrecio || incluirInactivos);
  const filtrosActivos = [rubro, proveedorId, soloSinPrecio, incluirInactivos].filter(Boolean).length;

  return (
    <PanelPortal compacto amplio>
      <EncabezadoPagina
        titulo="Materiales"
        descripcion="Lo que se compra para las obras: proveedor, precio de costo y cantidades por tamaño de pileta."
      >
        <button
          type="button"
          onClick={() => {
            setMensaje(null);
            setCreando(true);
          }}
          aria-label="Agregar material"
          className={botonDe("primario", "px-4")}
        >
          <IconPlus className="h-4 w-4" />
          Agregar<span className="hidden sm:inline"> material</span>
        </button>
      </EncabezadoPagina>

      <BarraFiltros>
        <FiltrosPlegables
          filtrosActivos={filtrosActivos}
          buscador={<Buscador valor={busqueda} onCambio={(v) => cambiar({ busqueda: v })} placeholder="Buscar material..." etiqueta="Buscar materiales" />}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select value={proveedorId} onChange={(e) => cambiar({ proveedorId: e.target.value })} aria-label="Filtrar por proveedor" className={CLASE_SELECT}>
              <option value="">Todos los proveedores</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>

          <div
            role="group"
            aria-label="Filtrar por rubro"
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-0"
          >
            <Chip activo={rubro === ""} onClick={() => cambiar({ rubro: "" })} cantidad={conteos.total}>
              Todos
            </Chip>
            {rubrosVisibles.map((r) => (
              <Chip key={r} activo={rubro === r} onClick={() => cambiar({ rubro: rubro === r ? "" : r })} cantidad={conteos.porRubro[r] ?? 0}>
                {r}
              </Chip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-0.5">
            <Chip activo={soloSinPrecio} onClick={() => cambiar({ soloSinPrecio: !soloSinPrecio })} cantidad={sinPrecio}>
              A confirmar
            </Chip>
            <Interruptor checked={incluirInactivos} onChange={(v) => cambiar({ incluirInactivos: v })}>
              Mostrar desactivados
            </Interruptor>
            {hayFiltros && (
              <button type="button" onClick={() => setFiltros(SIN_FILTROS)} className="min-h-11 rounded-lg px-3 text-sm font-medium text-marca hover:bg-marca/8 sm:ml-auto">
                Limpiar filtros
              </button>
            )}
          </div>
        </FiltrosPlegables>
      </BarraFiltros>

      {mensaje && (
        <p role="status" className="mb-3 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          {mensaje}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          No se pudieron cargar los materiales: {error}
        </p>
      )}
      {!error && materiales === null && <p className="py-6 text-center text-sm text-gray-500">Cargando materiales…</p>}

      {!error && visibles && visibles.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
          {hayFiltros ? (
            <>
              Ningún material coincide con el filtro.{" "}
              <button type="button" onClick={() => setFiltros(SIN_FILTROS)} className="font-semibold text-marca underline underline-offset-2">
                Limpiar filtros
              </button>
            </>
          ) : (
            "Todavía no hay materiales cargados."
          )}
        </div>
      )}

      {!error && visibles && visibles.length > 0 && (
        <>
          <p className="mb-1.5 text-xs text-gray-500" aria-live="polite">
            {visibles.length} {visibles.length === 1 ? "material" : "materiales"}
            {hayFiltros && materiales ? ` de ${materiales.length}` : ""}
          </p>
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div
              aria-hidden="true"
              className={`hidden rounded-t-lg border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-500 md:sticky md:top-[var(--catalogo-barra,0px)] md:z-10 md:grid md:items-center md:gap-x-4 ${COLUMNAS}`}
            >
              <span>Material</span>
              <span>Proveedor</span>
              <span>Categoría</span>
              <span className="text-right">Precio</span>
              <span>Unidad</span>
              <span>Actualizado</span>
            </div>
            {grupos.map(([nombre, items]) => (
              <section key={nombre} aria-label={nombre} className="border-t border-gray-100 first:border-t-0 md:border-t-0">
                <h3 className="sticky top-0 z-[5] border-y border-gray-200 bg-[#F4F8F9] px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-marca first:border-t-0 md:hidden">
                  {nombre} <span className="font-normal text-gray-400">({items.length})</span>
                </h3>
                <ul className="divide-y divide-gray-100">
                  {items.map((m) => (
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
              </section>
            ))}
          </div>
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
        />
      )}
    </PanelPortal>
  );
}

/**
 * Una fila. Toda la fila es el botón que abre la edición (no hay lápiz suelto). En el celular: nombre
 * y proveedor a la izquierda, precio y unidad a la derecha, en unos 58 px; en escritorio, una fila de
 * la tabla con todas las columnas.
 */
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
  const aConfirmar = (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-amber-700">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      A confirmar
    </span>
  );
  return (
    <li className={m.activo ? "" : "opacity-60"}>
      <button
        type="button"
        onClick={onEditar}
        aria-label={`Editar ${m.nombre}`}
        className={`grid min-h-[3.35rem] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-1 text-left transition-colors hover:bg-marca/5 active:bg-marca/10 md:min-h-12 md:gap-x-4 ${COLUMNAS}`}
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-gray-900">{m.nombre}</span>
            {!m.activo && <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">Desactivado</span>}
          </span>
          <span className="block truncate text-xs text-gray-500 md:hidden">{proveedor ?? "Sin proveedor"}</span>
        </span>

        <span className="hidden min-w-0 truncate text-sm text-gray-700 md:block" title={proveedor ?? undefined}>
          {proveedor ?? <span className="text-gray-400">Sin proveedor</span>}
        </span>

        <span className="hidden min-w-0 md:block">
          {m.rubro && <span className="inline-flex rounded-md bg-[#EEF2F6] px-2 py-0.5 text-xs font-medium text-marca">{m.rubro}</span>}
        </span>

        <span className="text-right text-sm tabular-nums">
          {m.precio === null ? (
            aConfirmar
          ) : (
            <span className="whitespace-nowrap font-semibold text-gray-900">
              {formatARS(m.precio)}
              {m.unidad && <span className="text-xs font-normal text-gray-400 md:hidden"> / {m.unidad}</span>}
            </span>
          )}
        </span>

        <span className="hidden text-sm text-gray-500 md:block">{m.unidad ?? ""}</span>

        <span className="hidden text-xs text-gray-400 md:block" title={m.precio_actualizado ? formatFechaCompleta(m.precio_actualizado) : undefined}>
          {relativa}
        </span>
      </button>
    </li>
  );
}
