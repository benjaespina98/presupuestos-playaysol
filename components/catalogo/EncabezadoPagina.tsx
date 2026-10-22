/**
 * El encabezado de cada pantalla del catálogo. El título ya lo dice la pestaña activa (arriba), así que acá
 * queda sólo para los lectores de pantalla; lo visible son las acciones (agregar, exportar...): en escritorio
 * flotan a la derecha, sobre la misma fila de las pestañas (para ganar altura de lista), y en el celular van en
 * una fila angosta propia. Es el mismo en todas las pestañas, así la página se lee igual.
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
    <div data-print-hide="" className="mb-1 flex items-center justify-end gap-3 lg:relative lg:z-30 lg:float-right lg:-mt-[4.1rem] lg:mb-0">
      <div className="sr-only">
        <h1>{titulo}</h1>
        <p>{descripcion}</p>
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
