"use client";

import { useEffect, useState } from "react";
import { obtenerUltimoPresupuesto, type TipoCalculadora } from "@/lib/presupuestos";
import { formatFechaRelativa } from "@/lib/format/fecha";

/**
 * Atajo "duplicar el último presupuesto parecido" (Mejoras de formularios,
 * punto 5): si el vendedor arma seguido presupuestos del mismo tipo, no
 * tiene que ir a Historial a buscarlo — se lo ofrece acá mismo, arriba del
 * formulario, sólo cuando está armando uno NUEVO (nunca al editar/duplicar
 * uno ya elegido: la página que lo monta se encarga de eso).
 *
 * Reusa el mecanismo de "Duplicar" que ya existe desde Historial
 * (`?duplicar=<id>`, `paraDuplicar()` en adaptadores.ts): un <a> normal (no
 * `next/link`) para forzar una navegación completa y que la página vuelva a
 * montar desde cero con el query param nuevo — mismo patrón que usa
 * Historial, y evita tener que sincronizar a mano el estado ya cargado del
 * formulario con un presupuesto distinto sin recargar.
 */
export function DuplicarUltimoBanner({ tipo, tipoLabel }: { tipo: TipoCalculadora; tipoLabel: string }) {
  const [ultimo, setUltimo] = useState<{ id: string; cliente: string; fecha: string } | null>(null);
  const [descartado, setDescartado] = useState(false);

  useEffect(() => {
    let cancelado = false;
    obtenerUltimoPresupuesto(tipo).then((p) => {
      if (cancelado || !p) return;
      setUltimo({ id: p.id, cliente: p.cliente_nombre, fecha: p.created_at });
    });
    return () => {
      cancelado = true;
    };
  }, [tipo]);

  if (!ultimo || descartado) return null;

  return (
    <div
      role="status"
      data-print-hide=""
      className="mb-6 flex flex-col items-start justify-between gap-3 rounded-lg border border-[#1B3A5C]/20 bg-[#EEF2F6] px-4 py-3 text-sm sm:flex-row sm:items-center"
    >
      <p className="text-gray-700">
        ¿Es un {tipoLabel.toLowerCase()} parecido al último que armaste?{" "}
        <span className="text-gray-500">
          {ultimo.cliente || "Sin nombre"} — {formatFechaRelativa(ultimo.fecha)}.
        </span>
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <a
          href={`?duplicar=${ultimo.id}`}
          className="inline-flex min-h-11 items-center rounded-md bg-[#1B3A5C] px-3 text-sm font-medium text-white hover:bg-[#142c46]"
        >
          Duplicar el último
        </a>
        <button
          type="button"
          onClick={() => setDescartado(true)}
          aria-label="Descartar sugerencia"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
