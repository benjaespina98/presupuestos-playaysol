/**
 * El título de cada pantalla del catálogo. Lo visible ya lo dicen la barra principal y la pestaña activa, así que
 * acá queda sólo para los lectores de pantalla (y para el título de la página). Las acciones (agregar, exportar...)
 * viven en la barra de herramientas de cada lista (`BarraHerramientas`).
 */
export function EncabezadoPagina({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <div data-print-hide="" className="sr-only">
      <h1>{titulo}</h1>
      <p>{descripcion}</p>
    </div>
  );
}
