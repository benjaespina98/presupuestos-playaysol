/**
 * El encabezado de cada pantalla del catálogo: título y una línea de ayuda a la
 * izquierda, acciones a la derecha. Es el mismo en las cuatro pestañas, así la
 * página se lee igual en todas. En pantallas chicas las acciones pasan abajo.
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
    <div data-print-hide="" className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="min-w-0 sm:flex-1">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{titulo}</h1>
        <p className="mt-1 text-sm text-gray-500">{descripcion}</p>
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
