"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { listarMateriales, listarProveedores } from "@/lib/abastecimiento";
import { filtrarProveedores, ordenarProveedores, sinTelefono, type Proveedor } from "@/lib/domain/abastecimiento/proveedor";
import { materialesPorProveedor, type Material } from "@/lib/domain/abastecimiento/material";
import { opcionesDeOrden, ordenarPor, type ClaveOrden } from "@/lib/ordenar";
import { PanelPortal } from "@/components/PanelPortal";
import { BarraHerramientas } from "@/components/ui/BarraHerramientas";
import { Toast } from "@/components/ui/BarraListado";
import { BotonLapiz, alTocarFila } from "@/components/ui/BotonLapiz";
import { useEstadoPersistente } from "@/lib/useEstadoPersistente";
import { EncabezadoPagina } from "@/components/catalogo/EncabezadoPagina";
import { ProveedorModal } from "@/components/abastecimiento/ProveedorModal";

/** Las columnas de la lista desde `lg`: Proveedor · Contacto · Teléfono · Materiales · Editar. */
const COLUMNAS = "lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_13rem_7rem_3.5rem]";

interface Filtros {
  busqueda: string;
  rubro: string;
  telefono: "" | "con" | "sin";
  incluirInactivos: boolean;
  orden: ClaveOrden;
}
const SIN_FILTROS: Filtros = { busqueda: "", rubro: "", telefono: "", incluirInactivos: false, orden: "defecto" };
const ORDENES = opcionesDeOrden(["nombre", "actualizado"]);

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
  // La búsqueda, los filtros y el orden se conservan al abrir otra pantalla y volver.
  const [filtros, setFiltros] = useEstadoPersistente<Filtros>("proveedores:filtros2", SIN_FILTROS);
  const { busqueda, rubro, telefono, incluirInactivos } = filtros;
  const orden = filtros.orden ?? "defecto";
  const cambiar = (parcial: Partial<Filtros>) => setFiltros({ ...filtros, ...parcial });
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

  // Todo lo que filtra menos el rubro: de ahí salen los contadores de los chips de rubro.
  const sinRubro = useMemo(
    () =>
      proveedores
        ? filtrarProveedores(proveedores, { busqueda, incluirInactivos, soloSinTelefono: telefono === "sin" }).filter(
            (p) => telefono !== "con" || !sinTelefono(p)
          )
        : [],
    [proveedores, busqueda, incluirInactivos, telefono]
  );
  const rubros = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of sinRubro) m.set(p.rubro?.trim() || "Sin rubro", (m.get(p.rubro?.trim() || "Sin rubro") ?? 0) + 1);
    if (rubro && !m.has(rubro)) m.set(rubro, 0);
    return [...m.entries()].sort(([a], [b]) => (a === "Sin rubro" ? 1 : b === "Sin rubro" ? -1 : a.localeCompare(b, "es")));
  }, [sinRubro, rubro]);

  const visibles = useMemo(
    () =>
      proveedores
        ? ordenarPor(
            ordenarProveedores(sinRubro.filter((p) => !rubro || (p.rubro?.trim() || "Sin rubro") === rubro)),
            orden,
            { nombre: (p) => p.nombre, actualizado: (p) => p.updated_at }
          )
        : null,
    [proveedores, sinRubro, rubro, orden]
  );

  const conTel = useMemo(
    () => (proveedores ? proveedores.filter((p) => (incluirInactivos || p.activo) && !sinTelefono(p)).length : 0),
    [proveedores, incluirInactivos]
  );
  const faltanTelefono = useMemo(
    () => (proveedores ? proveedores.filter((p) => (incluirInactivos || p.activo) && sinTelefono(p)).length : 0),
    [proveedores, incluirInactivos]
  );
  const totalActivos = useMemo(() => (proveedores ? proveedores.filter((p) => incluirInactivos || p.activo).length : 0), [proveedores, incluirInactivos]);

  const hayFiltros = !!(busqueda || rubro || telefono || incluirInactivos || orden !== "defecto");
    const cerrarToast = useCallback(() => setMensaje(null), []);

  return (
    <PanelPortal compacto amplio>
      <EncabezadoPagina titulo="Proveedores" descripcion="A quién se le compra, cómo contactarlo y qué se le pide." />

      <BarraHerramientas
        buscador={{ valor: busqueda, onCambio: (v) => cambiar({ busqueda: v }), placeholder: "Buscar", etiqueta: "Buscar proveedores" }}
        secciones={[
          {
            id: "rubro",
            titulo: "Rubro",
            opciones: [{ id: "", etiqueta: "Todos", cantidad: totalActivos }, ...rubros.map(([r, n]) => ({ id: r, etiqueta: r, cantidad: n }))],
            valor: rubro,
            onCambio: (v) => cambiar({ rubro: v }),
          },
          {
            id: "telefono",
            titulo: "Teléfono",
            opciones: [
              { id: "", etiqueta: "Todos", cantidad: totalActivos },
              { id: "con", etiqueta: "Con teléfono", cantidad: conTel },
              { id: "sin", etiqueta: "Sin teléfono", cantidad: faltanTelefono },
            ],
            valor: telefono,
            onCambio: (v) => cambiar({ telefono: v as Filtros["telefono"] }),
          },
        ]}
        orden={{ opciones: ORDENES, valor: orden, onCambio: (v) => cambiar({ orden: v }) }}
        interruptores={[{ id: "inactivos", etiqueta: "Mostrar desactivados", valor: incluirInactivos, onCambio: (v) => cambiar({ incluirInactivos: v }) }]}
        agregar={{
          etiqueta: "Agregar proveedor",
          onClick: () => {
            setMensaje(null);
            setCreando(true);
          },
        }}
        resultados={visibles?.length ?? 0}
        contador={
          visibles && !error ? `${visibles.length} ${hayFiltros && proveedores ? `de ${totalActivos} proveedores` : visibles.length === 1 ? "proveedor" : "proveedores"}` : undefined
        }
        hayFiltros={hayFiltros}
        onLimpiar={() => setFiltros(SIN_FILTROS)}
      />

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-[#B42318]">
          {error}
        </p>
      )}
      {!error && proveedores === null && <p className="py-6 text-center text-sm text-[#4A5861]">Cargando proveedores…</p>}

      {!error && visibles && visibles.length === 0 && (
        <div className="rounded-lg border border-dashed border-[#7D8892] px-4 py-10 text-center text-sm text-[#3E4A52]">
          {hayFiltros ? "Ningún proveedor coincide con el filtro." : "Todavía no hay proveedores cargados."}
        </div>
      )}

      {!error && visibles && visibles.length > 0 && (
        <>
          <div className="rounded-lg border border-[#D9DFE3] bg-[#FFFFFF] lg:rounded-none">
            <div
              aria-hidden="true"
              className={`hidden h-9 border-b border-[#D9DFE3] bg-[#F1F4F6] px-4 text-[13px] font-semibold uppercase tracking-wide text-[#4A5861] lg:sticky lg:top-[var(--catalogo-barra,0px)] lg:z-10 lg:grid lg:items-center lg:gap-x-4 ${COLUMNAS}`}
            >
              <span>Proveedor</span>
              <span>Contacto</span>
              <span>Teléfono</span>
              <span className="text-center">Materiales</span>
              <span className="text-center">Editar</span>
            </div>
            <ul className="divide-y divide-[#EEF1F3]">
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

      <Toast mensaje={mensaje} onCerrar={cerrarToast} />
    </PanelPortal>
  );
}

/**
 * Una fila de proveedor. Tocar la fila entera abre la edición (y el lápiz de la derecha lo muestra); los
 * teléfonos siguen siendo links para llamar y NO abren la edición. En el celular: nombre y contacto a la
 * izquierda, teléfono y cantidad de materiales a la derecha.
 */
function FilaProveedor({ proveedor: p, materiales, onEditar }: { proveedor: Proveedor; materiales: number; onEditar: () => void }) {
  const falta = sinTelefono(p);
  return (
    <li
      onClick={alTocarFila(onEditar)}
      className={`flex min-h-[3.25rem] cursor-pointer items-center gap-3 px-4 py-1 text-[15px] leading-5 transition-colors hover:bg-[#F4F8F9] active:bg-[#EAF0F2] lg:grid lg:min-h-[3rem] lg:gap-x-4 lg:py-0 ${COLUMNAS} ${p.activo ? "" : "opacity-70"}`}
    >
      <div className="min-w-0 flex-1 lg:contents">
        <div className="flex min-w-0 items-center gap-2">
          <span className="line-clamp-2 break-words lg:truncate text-sm font-medium text-gray-900">{p.nombre}</span>
          {p.rubro && <span className="hidden shrink-0 rounded-md bg-[#EEF2F6] px-2 py-0.5 text-[13px] font-medium text-[#244B5A] lg:inline">{p.rubro}</span>}
          {!p.activo && <span className="shrink-0 rounded-full bg-[#E3ECEF] px-2 py-0.5 text-[13px] font-medium text-[#3E4A52]">Desactivado</span>}
        </div>
        <p className="hidden min-w-0 truncate text-[13px] text-[#4A5861] lg:block lg:text-sm lg:text-gray-700" title={p.contacto ?? undefined}>
          {p.contacto ?? <span>{p.rubro ?? ""}</span>}
        </p>
        <div className="min-w-0 text-sm lg:space-y-0.5">
          {falta ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-[13px] font-medium text-amber-800">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-600" />
              Falta teléfono
            </span>
          ) : (
            <span className="flex min-w-0 items-center gap-2">
              <a
                href={`tel:${telefonosDe(p.telefono!)[0].replace(/[^\d+]/g, "")}`}
                className="relative inline-flex min-w-0 items-center truncate text-[#1A3844] underline underline-offset-2 after:absolute after:-inset-x-1 after:-inset-y-3 after:content-[''] hover:no-underline"
              >
                {telefonosDe(p.telefono!)[0]}
              </a>
              {telefonosDe(p.telefono!).length > 1 && <span className="shrink-0 text-[13px] text-[#4A5861]">+{telefonosDe(p.telefono!).length - 1} más</span>}
            </span>
          )}
        </div>
      </div>
      <p className="hidden whitespace-nowrap text-right text-[13px] text-[#4A5861] sm:block lg:text-center lg:text-sm">
        {materiales === 0 ? "Sin materiales" : `${materiales} ${materiales === 1 ? "material" : "materiales"}`}
      </p>
      <span className="flex shrink-0 justify-end lg:justify-center">
        <BotonLapiz nombre={p.nombre} onClick={onEditar} />
      </span>
    </li>
  );
}
