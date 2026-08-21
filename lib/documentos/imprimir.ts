/**
 * `window.print()` con el título del documento cambiado al nombre de archivo
 * que se le quiere sugerir al PDF ("Guardar como PDF" lee el `<title>`, no
 * hay otra forma de nombrar ese archivo). Port 1:1 de `imprimirConNombre` en
 * cada `-calc.js` — compartido entre las 5 calculadoras, así que vive acá y
 * no adentro de una sola.
 *
 * Los dos timeouts no son adorno: existen por comportamiento real observado
 * en mobile (ver comentarios en el propio cuerpo) y sacarlos rompe el nombre
 * del PDF en iOS/Android específicamente, no en desktop — donde el bug no se
 * nota al probar.
 */
export function imprimirConNombre(nombreArchivo: string): void {
  const tituloOriginal = document.title;
  document.title = nombreArchivo;

  const restaurarTitulo = () => {
    window.removeEventListener("afterprint", restaurarTitulo);
    setTimeout(() => {
      document.title = tituloOriginal;
    }, 3000);
  };
  window.addEventListener("afterprint", restaurarTitulo);

  setTimeout(() => window.print(), 60);
}
