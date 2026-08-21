"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { obtenerCatalogo, type CatalogoRow } from "@/lib/catalogo";
import { CercosCalculadora } from "@/components/calculadoras/cercos/CercosCalculadora";

/**
 * Vertical slice de la Fase 5: la calculadora de Cercos reconstruida en
 * React + RHF + Zod + el motor de dominio (lib/domain/precios/cercos.ts).
 *
 * Vive en /dashboard/cercos/nuevo, NO en /dashboard/cercos, a propósito: esta
 * versión todavía no genera el documento (Word/PDF), no maneja fotos ni abre
 * presupuestos existentes (?id=/?duplicar=). Reemplazar la ruta actual antes
 * de tener paridad en eso rompería la única salida real de estas
 * calculadoras — el documento que se le entrega al cliente — que es
 * exactamente lo que la Fase 2 puso como prioridad número uno no hacer.
 * Ver "Requisitos manuales pendientes" en el resumen de Fase 5.
 */
export default function NuevoCercoPage() {
  const [catalogo, setCatalogo] = useState<CatalogoRow[] | null>(null);

  useEffect(() => {
    let cancelado = false;
    obtenerCatalogo("cercos").then((rows) => {
      if (!cancelado) setCatalogo(rows);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-900">Cercos perimetrales (nueva versión)</h1>
      <p className="mb-6 mt-1 text-sm text-gray-500">
        Calcula y guarda el presupuesto en la nube. Todavía no genera el documento Word/PDF ni
        sube fotos — para eso usá{" "}
        <Link href="/dashboard/cercos" className="font-medium text-[#1B3A5C] underline">
          la calculadora actual
        </Link>
        .
      </p>

      {!catalogo && <p className="text-sm text-gray-500">Cargando catálogo…</p>}
      {catalogo && <CercosCalculadora catalogo={catalogo} />}
    </div>
  );
}
