/**
 * El encabezado de cada pantalla del catálogo: título (y una línea de ayuda, sólo en pantallas
 * medianas y grandes) a la izquierda, acciones a la derecha. Es el mismo en todas las pestañas, así
 * la página se lee igual. En el celular ocupa una sola fila angosta para dejar lugar a la lista.
 */
export function EncabezadoPagina({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion: string;
  /** Botones de acción (agregar, exportar...). */
  children?: React.ReactNode;
}) {
  return (
    <div data-print-hide="" className="mb-3 flex items-center justify-between gap-3 sm:mb-4 sm:items-end sm:gap-6">
      <div className="min-w-0 sm:flex-1">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">{titulo}</h1>
        <p className="mt-1 hidden text-sm text-gray-500 sm:block">{descripcion}</p>
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
