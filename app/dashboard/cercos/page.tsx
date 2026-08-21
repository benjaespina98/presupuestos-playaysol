"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { obtenerCatalogo, type CatalogoRow } from "@/lib/catalogo";
import { obtenerPresupuesto } from "@/lib/presupuestos";
import { leerPresupuesto, paraDuplicar, type PresupuestoLeido } from "@/lib/domain/presupuesto/adaptadores";
import { CercosCalculadora } from "@/components/calculadoras/cercos/CercosCalculadora";
import { DuplicarUltimoBanner } from "@/components/DuplicarUltimoBanner";

/**
 * Cercos perimetrales — React + RHF/Zod + el motor de dominio
 * (lib/domain/precios/cercos.ts) + generación de Word/PDF/fotos
 * (lib/documentos). Reemplaza a `public/cercos-calc.js` (Fase 5, Lote 3 —
 * ver docs/decisiones-tecnicas.md, decisión 10): paridad de cálculo
 * verificada contra el oráculo, paridad documental verificada contra el
 * mismo contenido que armaba `buildDocumentBody()`.
 */
export default function CercosPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-8 text-sm text-gray-500">Cargando…</div>}>
      <CercosContenido />
    </Suspense>
  );
}

function CercosContenido() {
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");
  const duplicarParam = searchParams.get("duplicar");

  const [catalogo, setCatalogo] = useState<CatalogoRow[] | null>(null);
  const [presupuestoInicial, setPresupuestoInicial] = useState<PresupuestoLeido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const rows = await obtenerCatalogo("cercos");
        if (cancelado) return;
        setCatalogo(rows);

        const idACargar = idParam || duplicarParam;
        if (idACargar) {
          const fila = await obtenerPresupuesto(idACargar);
          if (cancelado) return;
          const leido = leerPresupuesto("cercos", fila.datos);
          setPresupuestoInicial(
            duplicarParam
              ? { presupuesto: paraDuplicar(leido.presupuesto), preciosCongelados: false, clavesIncluidas: [] }
              : leido
          );
        }
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
      <h1 className="text-2xl font-semibold text-gray-900">Cercos perimetrales</h1>

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {!error && cargando && <p className="mt-4 text-sm text-gray-500">Cargando…</p>}
      {!error && !cargando && catalogo && (
        <div className="mt-6">
          {!idParam && !duplicarParam && <DuplicarUltimoBanner tipo="cercos" tipoLabel="Cerco perimetral" />}
          <CercosCalculadora catalogo={catalogo} presupuestoId={idParam} presupuestoInicial={presupuestoInicial} />
        </div>
      )}
    </div>
  );
}
