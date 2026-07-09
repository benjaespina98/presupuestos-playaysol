"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  listarTodosLosPresupuestos,
  eliminarPresupuesto,
  resumenPresupuesto,
  type Presupuesto,
  type TipoCalculadora,
} from "@/lib/presupuestos";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { IconEdit, IconCopy, IconTrash, IconSearch } from "@/components/icons";

const TIPOS_VALIDOS: TipoCalculadora[] = [
  "piscinas",
  "cercos",
  "cobertores",
  "losetas",
  "revestimientos",
];

const TITULOS: Record<TipoCalculadora, string> = {
  piscinas: "Piscinas",
  cercos: "Cercos",
  cobertores: "Cobertores",
  losetas: "Plano de Piscina",
  revestimientos: "Revestimientos",
};

function esTipoValido(tipo: string): tipo is TipoCalculadora {
  return (TIPOS_VALIDOS as string[]).includes(tipo);
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function HistorialPage() {
  return (
    <Suspense fallback={null}>
      <HistorialTabla />
    </Suspense>
  );
}

function HistorialTabla() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tipoParam = searchParams.get("tipo");
  const tipoFiltro = tipoParam && esTipoValido(tipoParam) ? tipoParam : null;

  const [presupuestos, setPresupuestos] = useState<Presupuesto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [porEliminar, setPorEliminar] = useState<Presupuesto | null>(null);

  useEffect(() => {
    let cancelado = false;
    listarTodosLosPresupuestos()
      .then((data) => {
        if (!cancelado) setPresupuestos(data);
      })
      .catch((err) => {
        if (!cancelado) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelado = true;
    };
  }, []);

  function cambiarTipo(tipo: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (tipo) params.set("tipo", tipo);
    else params.delete("tipo");
    router.push(`/dashboard/historial${params.toString() ? `?${params}` : ""}`);
  }

  const presupuestosFiltrados = useMemo(() => {
    if (!presupuestos) return null;
    const q = busqueda.trim().toLowerCase();
    return presupuestos.filter((p) => {
      if (tipoFiltro && p.tipo !== tipoFiltro) return false;
      if (q && !p.cliente_nombre.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [presupuestos, busqueda, tipoFiltro]);

  async function confirmarEliminar() {
    if (!porEliminar) return;
    const id = porEliminar.id;
    setEliminandoId(id);
    try {
      const { error } = await eliminarPresupuesto(id);
      if (error) throw error;
      setPresupuestos((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
      setPorEliminar(null);
    } catch (err) {
      alert("Error al eliminar: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setEliminandoId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Historial de presupuestos</h1>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <select
          value={tipoFiltro ?? ""}
          onChange={(e) => cambiarTipo(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#1B3A5C] focus:outline-none sm:w-auto"
        >
          <option value="">Todos los tipos</option>
          {TIPOS_VALIDOS.map((t) => (
            <option key={t} value={t}>
              {TITULOS[t]}
            </option>
          ))}
        </select>

        <div className="relative w-full sm:max-w-sm">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre de cliente..."
            className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#1B3A5C] focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          Error al cargar el historial: {error}
        </p>
      )}

      {!error && presupuestos === null && <p className="text-sm text-gray-500">Cargando...</p>}

      {presupuestosFiltrados && presupuestosFiltrados.length === 0 && (
        <p className="text-sm text-gray-500">
          {busqueda || tipoFiltro
            ? "Ningún presupuesto coincide con el filtro."
            : "Todavía no hay presupuestos guardados en la nube."}
        </p>
      )}

      {presupuestosFiltrados && presupuestosFiltrados.length > 0 && (
        <>
          {/* Desktop / tablet: tabla completa */}
          <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm sm:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-700">
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Detalle</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {presupuestosFiltrados.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 text-gray-700">{TITULOS[p.tipo]}</td>
                    <td className="px-4 py-3 text-gray-900">{p.cliente_nombre}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {resumenPresupuesto(p.tipo, p.datos)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{formatFecha(p.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/dashboard/${p.tipo}?id=${p.id}`}
                          title="Editar"
                          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-[#1B3A5C] hover:bg-[#1B3A5C]/8"
                        >
                          <IconEdit className="h-4 w-4" />
                          Editar
                        </Link>
                        <Link
                          href={`/dashboard/${p.tipo}?duplicar=${p.id}`}
                          title="Duplicar"
                          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-[#1B3A5C] hover:bg-[#1B3A5C]/8"
                        >
                          <IconCopy className="h-4 w-4" />
                          Duplicar
                        </Link>
                        <button
                          onClick={() => setPorEliminar(p)}
                          title="Eliminar"
                          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                          <IconTrash className="h-4 w-4" />
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: tarjetas — la tabla obligaba a scroll horizontal para llegar a
              las acciones, que quedaban fuera de pantalla en un celular en vertical. */}
          <div className="flex flex-col gap-3 sm:hidden">
            {presupuestosFiltrados.map((p) => {
              const detalle = resumenPresupuesto(p.tipo, p.datos);
              return (
                <div
                  key={p.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">{p.cliente_nombre}</p>
                      <p className="text-sm text-gray-500">
                        {TITULOS[p.tipo]}
                        {detalle ? ` · ${detalle}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">
                      {formatFecha(p.created_at)}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3">
                    <Link
                      href={`/dashboard/${p.tipo}?id=${p.id}`}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[#1B3A5C] px-3 py-2 text-sm font-medium text-white"
                    >
                      <IconEdit className="h-4 w-4" />
                      Editar
                    </Link>
                    <Link
                      href={`/dashboard/${p.tipo}?duplicar=${p.id}`}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-[#1B3A5C] px-3 py-2 text-sm font-medium text-[#1B3A5C]"
                    >
                      <IconCopy className="h-4 w-4" />
                      Duplicar
                    </Link>
                    <button
                      onClick={() => setPorEliminar(p)}
                      title="Eliminar"
                      className="flex items-center justify-center rounded-md border border-red-200 px-3 py-2 text-red-600"
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <ConfirmDialog
        open={porEliminar !== null}
        title="Eliminar presupuesto"
        message={
          porEliminar
            ? `Vas a eliminar el presupuesto de "${porEliminar.cliente_nombre}". No se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar"
        danger
        loading={eliminandoId !== null}
        onConfirm={confirmarEliminar}
        onCancel={() => setPorEliminar(null)}
      />
    </div>
  );
}
