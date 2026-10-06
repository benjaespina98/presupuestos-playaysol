"use client";

import { useRef } from "react";
import type { FormatoPedido, ModoPedido } from "@/lib/documentos/pedidos/exportar";

/**
 * "Exportar": un menú con las cuatro salidas formales del pedido, más el CSV
 * simple. Se usa igual al armar un pedido y al abrir uno guardado.
 *
 *   PDF / Excel  ×  todo junto / uno por proveedor (ZIP)
 *
 * Con un solo proveedor "uno por proveedor" no tiene sentido y se oculta.
 */
export function MenuExportar({
  onExportar,
  onCsv,
  variosProveedores,
  ocupado = false,
}: {
  onExportar: (formato: FormatoPedido, modo: ModoPedido) => void;
  onCsv?: () => void;
  variosProveedores: boolean;
  /** Mientras se genera un archivo no se puede pedir otro. */
  ocupado?: boolean;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const cerrar = () => ref.current?.removeAttribute("open");

  const opcion = (etiqueta: string, ayuda: string, formato: FormatoPedido, modo: ModoPedido) => (
    <button
      type="button"
      role="menuitem"
      disabled={ocupado}
      onClick={() => {
        cerrar();
        onExportar(formato, modo);
      }}
      className="flex w-full flex-col items-start rounded-md px-3 py-2 text-left hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="text-sm font-medium text-gray-900">{etiqueta}</span>
      <span className="text-xs text-gray-500">{ayuda}</span>
    </button>
  );

  return (
    <details ref={ref} className="relative" data-print-hide="">
      <summary
        aria-label="Exportar"
        className={`flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-[#1B3A5C] shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50 [&::-webkit-details-marker]:hidden ${ocupado ? "pointer-events-none opacity-60" : ""}`}
      >
        {ocupado ? "Generando…" : "Exportar"}
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div role="menu" aria-label="Opciones de exportación" className="absolute right-0 z-30 mt-1.5 w-72 rounded-lg border border-gray-200 bg-white p-1.5 shadow-xl">
        <p className="px-3 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">PDF</p>
        {opcion("PDF — todo junto", "Un documento con todos los proveedores", "pdf", "junto")}
        {variosProveedores && opcion("PDF — uno por proveedor", "Un PDF para cada uno, en un ZIP", "pdf", "por-proveedor")}
        <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Excel</p>
        {opcion("Excel — todo junto", "Un libro con una hoja por proveedor", "xlsx", "junto")}
        {variosProveedores && opcion("Excel — uno por proveedor", "Un Excel para cada uno, en un ZIP", "xlsx", "por-proveedor")}
        {onCsv && (
          <>
            <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Otros</p>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                cerrar();
                onCsv();
              }}
              className="flex w-full flex-col items-start rounded-md px-3 py-2 text-left hover:bg-gray-50"
            >
              <span className="text-sm font-medium text-gray-900">CSV simple</span>
              <span className="text-xs text-gray-500">Una tabla para abrir en Excel</span>
            </button>
          </>
        )}
      </div>
    </details>
  );
}
