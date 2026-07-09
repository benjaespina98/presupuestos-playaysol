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
  losetas: "Plano de pileta",
  revestimientos: "Revestimientos",
};

function esTipoValido(tipo: string): tipo is TipoCalculadora {
  return (TIPOS_VALIDOS as string[]).includes(tipo);
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

  async function handleEliminar(id: string, cliente: string) {
    if (!confirm(`¿Eliminar el presupuesto de "${cliente}"? No se puede deshacer.`)) return;
    setEliminandoId(id);
    try {
      const { error } = await eliminarPresupuesto(id);
      if (error) throw error;
      setPresupuestos((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
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

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={tipoFiltro ?? ""}
          onChange={(e) => cambiarTipo(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#1B3A5C] focus:outline-none"
        >
          <option value="">Todos los tipos</option>
          {TIPOS_VALIDOS.map((t) => (
            <option key={t} value={t}>
              {TITULOS[t]}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre de cliente..."
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#1B3A5C] focus:outline-none"
        />
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
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
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
                  <td className="px-4 py-3 text-gray-700">
                    {new Date(p.created_at).toLocaleDateString("es-AR", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-4">
                      <Link
                        href={`/dashboard/${p.tipo}?id=${p.id}`}
                        className="font-medium text-[#1B3A5C] hover:underline"
                      >
                        Reabrir
                      </Link>
                      <Link
                        href={`/dashboard/${p.tipo}?duplicar=${p.id}`}
                        className="font-medium text-[#1B3A5C] hover:underline"
                      >
                        Duplicar
                      </Link>
                      <button
                        onClick={() => handleEliminar(p.id, p.cliente_nombre)}
                        disabled={eliminandoId === p.id}
                        className="font-medium text-red-600 hover:underline disabled:opacity-50"
                      >
                        {eliminandoId === p.id ? "Eliminando..." : "Eliminar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
