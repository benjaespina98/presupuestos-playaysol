"use client";

import { botonDe } from "@/components/ui/botones";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { formatFechaCompleta, formatFechaRelativaCorta } from "@/lib/format/fecha";
import { etiquetaCortaDeOrden, opcionesDeOrden, ordenarPor, type ClaveOrden } from "@/lib/ordenar";
import { useEstadoPersistente } from "@/lib/useEstadoPersistente";
import { PanelPortal } from "@/components/PanelPortal";
import { IconPlus } from "@/components/icons";
import { EncabezadoPagina } from "@/components/catalogo/EncabezadoPagina";
import { Buscador } from "@/components/ui/FiltrosPlegables";
import { BarraListado, BotonFiltros, Chip, ChipsFila, Interruptor, MenuSeleccion, Toast } from "@/components/ui/BarraListado";
import { BotonLapiz, alTocarFila } from "@/components/ui/BotonLapiz";
import { MaterialModal } from "@/components/abastecimiento/MaterialModal";

/** Las columnas de la tabla desde `lg`: Material · Proveedor · Categoría · Precio · Unidad · Actualizado · Editar. */
const COLUMNAS = "lg:grid-cols-[minmax(0,1fr)_11rem_9rem_8rem_5rem_6.5rem_3.5rem]";

interface Filtros {
  busqueda: string;
  rubro: string;
  proveedorId: string;
  soloSinPrecio: boolean;
  incluirInactivos: boolean;
  orden: ClaveOrden;
}
const SIN_FILTROS: Filtros = { busqueda: "", rubro: "", proveedorId: "", soloSinPrecio: false, incluirInactivos: false, orden: "defecto" };
const ORDENES = opcionesDeOrden(["nombre", "precio", "actualizado"]);

export default function MaterialesPage() {
  const [materiales, setMateriales] = useState<Material[] | null>(null);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [error, setError] = useState<string | null>(null);
  // La búsqueda, los filtros y el orden se conservan al abrir otra pantalla y volver.
  const [filtros, setFiltros] = useEstadoPersistente<Filtros>("materiales:filtros", SIN_FILTROS);
  const { busqueda, rubro, proveedorId, soloSinPrecio, incluirInactivos } = filtros;
  const orden = filtros.orden ?? "defecto";
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
        ? ordenarPor(
            ordenarMateriales(
              filtrarMateriales(materiales, {
                busqueda,
                rubro: rubro || null,
                proveedorId: proveedorId || null,
                soloSinPrecio,
                incluirInactivos,
              })
            ),
            orden,
            { nombre: (m) => m.nombre, precio: (m) => m.precio, actualizado: (m) => m.precio_actualizado }
          )
        : null,
    [materiales, busqueda, rubro, proveedorId, soloSinPrecio, incluirInactivos, orden]
  );

  const conteos = useMemo(
    () => contarMaterialesPorRubro(materiales ?? [], { busqueda, proveedorId: proveedorId || null, soloSinPrecio, incluirInactivos }),
    [materiales, busqueda, proveedorId, soloSinPrecio, incluirInactivos]
  );

  const sinPrecio = useMemo(
    () => (materiales ? materiales.filter((m) => (incluirInactivos || m.activo) && m.precio === null).length : 0),
    [materiales, incluirInactivos]
  );

  // Por categoría, con encabezados livianos que quedan fijos al bajar. Con un orden elegido, una sola lista (el orden vale para todo).
  const grupos = useMemo(() => {
    if (orden !== "defecto") return [["", visibles ?? []] as [string, Material[]]];
    const porRubro = new Map<string, Material[]>();
    for (const m of visibles ?? []) {
      const clave = m.rubro ?? "Sin rubro";
      porRubro.set(clave, [...(porRubro.get(clave) ?? []), m]);
    }
    return [...porRubro.entries()].sort(([a], [b]) => (a === "Sin rubro" ? 1 : b === "Sin rubro" ? -1 : a.localeCompare(b, "es")));
  }, [visibles, orden]);

  const rubrosVisibles = [...RUBROS_MATERIAL, "Sin rubro"].filter((r) => (conteos.porRubro[r] ?? 0) > 0 || r === rubro);
  const hayFiltros = !!(busqueda || rubro || proveedorId || soloSinPrecio || incluirInactivos || orden !== "defecto");
  const filtrosActivos = [incluirInactivos].filter(Boolean).length;
  const cerrarToast = useCallback(() => setMensaje(null), []);

  const opcionesProveedor = [{ id: "", etiqueta: "Todos los proveedores" }, ...proveedores.map((p) => ({ id: p.id, etiqueta: p.nombre }))];

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

      <BarraListado
        buscador={<Buscador valor={busqueda} onCambio={(v) => cambiar({ busqueda: v })} placeholder="Buscar material..." etiqueta="Buscar materiales" />}
        menus={
          <>
            <MenuSeleccion
              etiqueta="Filtrar por proveedor"
              titulo="Proveedor"
              opciones={opcionesProveedor}
              valor={proveedorId}
              porDefecto=""
              onCambio={(v) => cambiar({ proveedorId: v })}
              buscable={opcionesProveedor.length > 8}
              textoBoton={proveedorId ? (nombreProveedor.get(proveedorId) ?? "Proveedor") : "Proveedor"}
            />
            <MenuSeleccion
              etiqueta="Ordenar"
              titulo="Orden"
              opciones={ORDENES.map((o) => ({ id: o.id, etiqueta: o.etiqueta }))}
              valor={orden}
              porDefecto="defecto"
              onCambio={(v) => cambiar({ orden: v })}
              textoBoton={etiquetaCortaDeOrden(orden)}
            />
          </>
        }
        chips={
          <ChipsFila etiqueta="Filtrar por rubro">
            <Chip activo={rubro === ""} onClick={() => cambiar({ rubro: "" })} cantidad={conteos.total}>
              Todos
            </Chip>
            {rubrosVisibles.map((r) => (
              <Chip key={r} activo={rubro === r} onClick={() => cambiar({ rubro: rubro === r ? "" : r })} cantidad={conteos.porRubro[r] ?? 0}>
                {r}
              </Chip>
            ))}
            <Chip activo={soloSinPrecio} onClick={() => cambiar({ soloSinPrecio: !soloSinPrecio })} cantidad={sinPrecio}>
              A confirmar
            </Chip>
          </ChipsFila>
        }
        filtros={
          <BotonFiltros contador={filtrosActivos} hayFiltros={hayFiltros} onLimpiar={() => setFiltros(SIN_FILTROS)}>
            <Interruptor checked={incluirInactivos} onChange={(v) => cambiar({ incluirInactivos: v })}>
              Mostrar desactivados
            </Interruptor>
          </BotonFiltros>
        }
      />

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-[#B42318]">
          No se pudieron cargar los materiales: {error}
        </p>
      )}
      {!error && materiales === null && <p className="py-6 text-center text-sm text-[#4A5861]">Cargando materiales…</p>}

      {!error && visibles && visibles.length === 0 && (
        <div className="rounded-lg border border-dashed border-[#7D8892] px-4 py-10 text-center text-sm text-[#3E4A52]">
          {hayFiltros ? (
            <>
              Ningún material coincide con el filtro.{" "}
              <button type="button" onClick={() => setFiltros(SIN_FILTROS)} className="font-semibold text-[#244B5A] underline underline-offset-2">
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
          <p className="py-1 text-[13px] text-[#4A5861]" aria-live="polite">
            {visibles.length} {hayFiltros && materiales ? `de ${materiales.length} materiales` : visibles.length === 1 ? "material" : "materiales"}
          </p>
          <div className="rounded-lg border border-[#D9DFE3] bg-[#FFFFFF] lg:rounded-none">
            <div
              aria-hidden="true"
              className={`hidden h-9 border-b border-[#D9DFE3] bg-[#F1F4F6] px-4 text-[13px] font-semibold uppercase tracking-wide text-[#4A5861] lg:sticky lg:top-[var(--catalogo-barra,0px)] lg:z-10 lg:grid lg:items-center lg:gap-x-4 ${COLUMNAS}`}
            >
              <span>Material</span>
              <span>Proveedor</span>
              <span>Categoría</span>
              <span className="text-center">Precio</span>
              <span className="text-center">Unidad</span>
              <span className="text-center">Actualizado</span>
              <span className="text-center">Editar</span>
            </div>
            {grupos.map(([nombre, items]) => (
              <section key={nombre} aria-label={nombre || "Materiales"} className="border-t border-gray-100 first:border-t-0 lg:border-t-0">
                {nombre && (
                  <h3 className="sticky top-0 z-[5] border-y border-[#D9DFE3] bg-[#F4F8F9] px-4 py-1.5 text-[13px] font-bold uppercase tracking-wide text-[#244B5A] first:border-t-0 lg:hidden">
                    {nombre} <span className="font-normal text-[#4A5861]">({items.length})</span>
                  </h3>
                )}
                <ul className="divide-y divide-[#EEF1F3]">
                  {items.map((m) => (
                    <FilaMaterial
                      key={m.id}
                      material={m}
                      proveedor={m.proveedor_id ? (nombreProveedor.get(m.proveedor_id) ?? null) : null}
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

      <Toast mensaje={mensaje} onCerrar={cerrarToast} />
    </PanelPortal>
  );
}

/**
 * Una fila (unos 52 px). Tocar la fila entera abre la edición, y el lápiz de la derecha es la pista visual (y
 * el camino para el teclado). En el celular: nombre y proveedor a la izquierda, precio con su unidad y el lápiz
 * a la derecha; desde `lg`, una fila de la tabla con todas las columnas.
 */
function FilaMaterial({ material: m, proveedor, onEditar }: { material: Material; proveedor: string | null; onEditar: () => void }) {
  const relativa = m.precio_actualizado ? formatFechaRelativaCorta(m.precio_actualizado) : "";
  const aConfirmar = (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-[13px] font-medium text-amber-800">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-600" />
      A confirmar
    </span>
  );
  return (
    <li
      onClick={alTocarFila(onEditar)}
      className={`flex min-h-[3.25rem] cursor-pointer items-center gap-3 px-4 py-1 text-[15px] leading-5 transition-colors hover:bg-[#F4F8F9] active:bg-[#EAF0F2] lg:grid lg:min-h-[2.75rem] lg:gap-x-4 lg:py-0 ${COLUMNAS} ${m.activo ? "" : "opacity-70"}`}
    >
      <span className="min-w-0 flex-1 lg:flex-none">
        <span className="flex items-center gap-2">
          <span className="line-clamp-2 break-words lg:truncate text-sm font-medium text-gray-900">{m.nombre}</span>
          {!m.activo && <span className="shrink-0 rounded-full bg-[#E3ECEF] px-2 py-0.5 text-[13px] font-medium text-[#3E4A52]">Desactivado</span>}
        </span>
        <span className="block truncate text-[13px] text-[#4A5861] lg:hidden">{proveedor ?? "Sin proveedor"}</span>
      </span>

      <span className="hidden min-w-0 truncate text-sm text-gray-700 lg:block" title={proveedor ?? undefined}>
        {proveedor ?? <span className="text-[#4A5861]">Sin proveedor</span>}
      </span>

      <span className="hidden min-w-0 lg:block">
        {m.rubro && <span className="inline-flex rounded-md bg-[#EEF2F6] px-2 py-0.5 text-[13px] font-medium text-[#244B5A]">{m.rubro}</span>}
      </span>

      <span className="shrink-0 text-right text-sm tabular-nums lg:text-center">
        {m.precio === null ? (
          aConfirmar
        ) : (
          <span className="whitespace-nowrap font-semibold text-gray-900">
            {formatARS(m.precio)}
            {m.unidad && <span className="text-[13px] font-normal text-[#4A5861] lg:hidden"> / {m.unidad}</span>}
          </span>
        )}
      </span>

      <span className="hidden text-center text-sm text-[#3E4A52] lg:block">{m.unidad ?? ""}</span>

      <span className="hidden whitespace-nowrap text-center text-[13px] text-[#4A5861] lg:block" title={m.precio_actualizado ? formatFechaCompleta(m.precio_actualizado) : undefined}>
        {relativa}
      </span>

      <span className="flex shrink-0 justify-end lg:justify-center">
        <BotonLapiz nombre={m.nombre} onClick={onEditar} />
      </span>
    </li>
  );
}
