"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { obtenerPresupuesto } from "@/lib/presupuestos";
import { leerPresupuesto, paraDuplicar, type PresupuestoLeido } from "@/lib/domain/presupuesto/adaptadores";
import { LosetasCalculadora } from "@/components/calculadoras/losetas/LosetasCalculadora";

/**
 * Losetas ("Plano de Piscina") — editor SVG en React + el motor de dominio
 * (lib/domain/precios/losetas.ts, lib/domain/plano/losetas.ts) + exportación
 * a PNG con html2canvas. Reemplaza a `app/dashboard/losetas/{calculator,
 * markup,script,styles}.ts` (Fase 5, última calculadora — Lote 7).
 *
 * A diferencia de las otras 4, no lee el catálogo compartido: el legacy
 * nunca sembró materiales de losetas ahí (ver comentario en
 * LosetasCalculadora.tsx), así que no hace falta pedirlo.
 */
export default function LosetasPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-8 text-sm text-gray-500">Cargando…</div>}>
      <LosetasContenido />
    </Suspense>
  );
}

function LosetasContenido() {
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");
  const duplicarParam = searchParams.get("duplicar");

  const [presupuestoInicial, setPresupuestoInicial] = useState<PresupuestoLeido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(!!(idParam || duplicarParam));

  useEffect(() => {
    const idACargar = idParam || duplicarParam;
    // Nada que pedir: `cargando` ya arrancó en `false` (ver el useState de
    // arriba, calculado con estos mismos parámetros). Este efecto corre una
    // sola vez al montar (deps vacías), así que ese valor inicial sigue
    // siendo válido acá.
    if (!idACargar) return;
    let cancelado = false;
    (async () => {
      try {
        const fila = await obtenerPresupuesto(idACargar);
        if (cancelado) return;
        const leido = leerPresupuesto("losetas", fila.datos);
        setPresupuestoInicial(
          duplicarParam
            ? { presupuesto: paraDuplicar(leido.presupuesto), preciosCongelados: false, clavesIncluidas: [] }
            : leido
        );
      } catch (err) {
        if (!cancelado) {
          setError(
            "No se pudo abrir ese presupuesto. Puede que lo hayan borrado, o que se haya cortado la conexión: " +
              (err instanceof Error ? err.message : String(err))
          );
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-900">Plano de Piscina</h1>
      <p className="mt-1 text-sm text-gray-500">Plano del borde perimetral y cálculo de m² a cotizar.</p>

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {!error && cargando && <p className="mt-4 text-sm text-gray-500">Cargando…</p>}
      {!error && !cargando && (
        <div className="mt-6">
          <LosetasCalculadora presupuestoId={idParam} presupuestoInicial={presupuestoInicial} />
        </div>
      )}
    </div>
  );
}
