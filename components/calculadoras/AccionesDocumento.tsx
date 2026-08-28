"use client";

import { IconCloudUpload, IconFileText, IconPrinter } from "@/components/icons";

/**
 * Bloque de acciones final de las 4 calculadoras tradicionales (cercos,
 * cobertores, piscinas, revestimientos) — antes copiado y pegado idéntico en
 * los 4 archivos. Un solo lugar para la jerarquía visual de "Guardar" (acción
 * primaria, la única que persiste el trabajo) vs. "Word"/"PDF" (secundarias,
 * exportan lo que ya está guardado o en pantalla).
 *
 * `type="submit"` en el botón de Guardar: depende de estar DENTRO del <form>
 * de cada calculadora — no dispara nada por sí solo, delega en el
 * `onSubmit`/`handleSubmit` que ya tiene armado cada una.
 */
export function AccionesDocumento({
  errorGuardado,
  guardadoOk,
  errorWord,
  errorPdf,
  guardando,
  generandoWord,
  generandoPdf,
  onDescargarWord,
  onGenerarPdf,
}: {
  errorGuardado: string | null;
  guardadoOk: boolean;
  errorWord: string | null;
  errorPdf: string | null;
  guardando: boolean;
  generandoWord: boolean;
  generandoPdf: boolean;
  onDescargarWord: () => void;
  onGenerarPdf: () => void;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      {errorGuardado && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          No se pudo guardar: {errorGuardado}
        </p>
      )}
      {guardadoOk && !errorGuardado && (
        <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Presupuesto guardado en la nube.
        </p>
      )}
      {errorWord && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          No se pudo generar el Word: {errorWord}
        </p>
      )}
      {errorPdf && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          No se pudo generar el PDF: {errorPdf}
        </p>
      )}
      <button
        type="submit"
        disabled={guardando}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-[#1B3A5C] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#142c46] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <IconCloudUpload className="h-4 w-4" />
        {guardando ? "Guardando..." : "Guardar en la nube"}
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onDescargarWord}
          disabled={generandoWord}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-[#1B3A5C] px-4 text-sm font-medium text-[#1B3A5C] transition-colors hover:bg-[#1B3A5C]/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <IconFileText className="h-4 w-4" />
          {generandoWord ? "Generando..." : "Word"}
        </button>
        <button
          type="button"
          onClick={onGenerarPdf}
          disabled={generandoPdf}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-[#1B3A5C] px-4 text-sm font-medium text-[#1B3A5C] transition-colors hover:bg-[#1B3A5C]/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <IconPrinter className="h-4 w-4" />
          {generandoPdf ? "Generando..." : "PDF"}
        </button>
      </div>
    </section>
  );
}
