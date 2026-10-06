"use client";

import { useState } from "react";
import type { FormatoPedido, ModoPedido } from "@/lib/documentos/pedidos/exportar";

/**
 * "Exportar": un menú con las cuatro salidas formales del pedido, más el CSV
 * simple. Se usa igual al armar un pedido y al abrir uno guardado.
 *
 *   PDF / Excel  ×  todo junto / uno por proveedor (ZIP)
 *
 * Con un solo proveedor "uno por proveedor" no tiene sentido y se oculta.
 *
 * Arriba se elige si el archivo lleva precios. Por defecto SIN: es lo que se le
 * manda a un proveedor para pedirle (los precios son tentativos y de uso
 * interno). "Con precios" es para tener la orientación de costos en casa.
 */
export function MenuExportar({
  onExportar,
  onCsv,
  variosProveedores,
  ocupado = false,
}: {
  onExportar: (formato: FormatoPedido, modo: ModoPedido, conPrecios: boolean) => void;
  onCsv?: (conPrecios: boolean) => void;
  variosProveedores: boolean;
  /** Mientras se genera un archivo no se puede pedir otro. */
  ocupado?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const cerrar = () => setAbierto(false);
  const [conPrecios, setConPrecios] = useState(false);

  const opcion = (etiqueta: string, ayuda: string, formato: FormatoPedido, modo: ModoPedido) => (
    <button
      type="button"
      role="menuitem"
      disabled={ocupado}
      onClick={() => {
        cerrar();
        onExportar(formato, modo, conPrecios);
      }}
      className="flex w-full flex-col items-start rounded-md px-3 py-2 text-left hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="text-sm font-medium text-gray-900">{etiqueta}</span>
      <span className="text-xs text-gray-500">{ayuda}</span>
    </button>
  );

  return (
    <details open={abierto} onToggle={(e) => setAbierto(e.currentTarget.open)} className="group relative" data-print-hide="">
      <summary
        aria-label="Exportar"
        className={`flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-[#1B3A5C] shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50 [&::-webkit-details-marker]:hidden ${ocupado ? "pointer-events-none opacity-60" : ""}`}
      >
        {ocupado ? "Generando…" : "Exportar"}
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      {/* Celular: el menú sube como una hoja desde abajo (no se corta contra el borde) y se cierra tocando afuera. */}
      <div aria-hidden="true" onClick={cerrar} className="fixed inset-0 z-40 hidden bg-black/30 group-open:block sm:group-open:hidden" />
      <div
        role="menu"
        aria-label="Opciones de exportación"
        className="fixed inset-x-3 bottom-3 z-50 max-h-[85dvh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:z-30 sm:mt-1.5 sm:max-h-none sm:w-80 sm:rounded-lg sm:p-1.5 sm:shadow-xl"
      >
        <div role="group" aria-label="Precios en el archivo" className="mb-1 grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
          {([
            [false, "Sin precios", "Para pedir"],
            [true, "Con precios", "Uso interno"],
          ] as const).map(([valor, titulo, ayuda]) => (
            <button
              key={titulo}
              type="button"
              aria-pressed={conPrecios === valor}
              onClick={() => setConPrecios(valor)}
              className={`flex min-h-11 flex-col items-center justify-center rounded-md px-2 text-center transition-colors ${
                conPrecios === valor ? "bg-white text-[#1B3A5C] shadow-sm" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <span className="text-sm font-semibold">{titulo}</span>
              <span className="text-[11px] leading-tight">{ayuda}</span>
            </button>
          ))}
        </div>
        <p className="px-2 pb-1 text-[11px] text-gray-500">
          {conPrecios
            ? "Los precios son tentativos: sirven de orientación interna, no se le mandan al proveedor."
            : "Sin precios ni totales: listo para mandarle al proveedor."}
        </p>
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
                onCsv(conPrecios);
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
