"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { obtenerCatalogo, type CatalogoRow } from "@/lib/catalogo";
import { obtenerPresupuesto } from "@/lib/presupuestos";
import { leerPresupuesto, paraDuplicar, type PresupuestoLeido } from "@/lib/domain/presupuesto/adaptadores";
import { CercosCalculadora } from "@/components/calculadoras/cercos/CercosCalculadora";

/**
 * Vertical slice de la Fase 5: la calculadora de Cercos reconstruida en
 * React + RHF + Zod + el motor de dominio (lib/domain/precios/cercos.ts),
 * con generación de Word/PDF y fotos (lib/documentos).
 *
 * Vive en /dashboard/cercos/nuevo, todavía NO en /dashboard/cercos: falta la
 * verificación de paridad documental (Lote 2) antes de reemplazar la ruta
 * que usa el equipo — ver docs/decisiones-tecnicas.md, decisión 10.
 */
export default function NuevoCercoPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-8 text-sm text-gray-500">Cargando…</div>}>
      <NuevoCercoContenido />
    </Suspense>
  );
}

function NuevoCercoContenido() {
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
        const [rows] = await Promise.all([obtenerCatalogo("cercos")]);
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
      <h1 className="text-2xl font-semibold text-gray-900">Cercos perimetrales (nueva versión)</h1>
      <p className="mb-6 mt-1 text-sm text-gray-500">
        Calcula, guarda y genera el documento. Todavía no reemplaza la calculadora actual — para eso usá{" "}
        <Link href="/dashboard/cercos" className="font-medium text-[#1B3A5C] underline">
          la calculadora actual
        </Link>
        .
      </p>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {!error && cargando && <p className="text-sm text-gray-500">Cargando…</p>}
      {!error && !cargando && catalogo && (
        <CercosCalculadora
          catalogo={catalogo}
          presupuestoId={idParam}
          presupuestoInicial={presupuestoInicial}
        />
      )}
    </div>
  );
}
