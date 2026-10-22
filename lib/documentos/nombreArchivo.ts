/**
 * Nombre de archivo de los documentos al cliente (las 5 calculadoras):
 * `<Cliente> - <Tipo> - DD-MM-AAAA`, por ejemplo `Pérez, María José - Cerco - 20-08-2026`.
 *
 * El cliente se carga como texto libre: se usa TAL COMO se escribió (sin reordenar ni adivinar apellido y
 * nombre), sólo saneado para que Windows y macOS acepten el archivo. Se conservan tildes, eñes y la coma
 * (Windows las acepta); se sacan los caracteres que no puede llevar un nombre de archivo, los de control y
 * de formato (nulo, escape, ancho cero, el "RTL override" que da vuelta la extensión mostrada), y los puntos o
 * espacios del final.
 */

/** Largo máximo de la parte del cliente en el nombre del archivo. */
const MAX_CLIENTE = 80;

/** Caracteres que Windows no acepta en un nombre de archivo. */
const INVALIDOS_WINDOWS = /[\\/:*?"<>|]/g;

function limpiar(s: string): string {
  return String(s || "")
    .replace(INVALIDOS_WINDOWS, "")
    // Tabs y saltos de línea son separadores, no se pegan las palabras.
    .replace(/\s+/g, " ")
    // Caracteres de control y de formato (nulo, escape, ancho cero, RTL override...). Va DESPUÉS de los espacios.
    .replace(/\p{C}/gu, "")
    .trim();
}

export function armarNombreArchivo(tipo: string, cliente: string, fechaStr: string): string {
  // Un nombre larguísimo no puede hacer un archivo que Windows no deje guardar (el límite es 255 en total,
  // y a veces menos con la ruta): se recorta, sin dejar espacios, puntos ni comas colgados al final.
  const clienteLimpio =
    limpiar(cliente)
      .slice(0, MAX_CLIENTE)
      .replace(/[\s.,]+$/, "") || "Sin nombre";
  const tipoLimpio = limpiar(tipo).replace(/[\s.]+$/, "") || "Documento";

  let fecha = String(fechaStr || "");
  const match = fecha.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    // Los campos "Fecha" de las calculadoras usan DD/MM/AAAA.
    fecha = `${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}-${match[3]}`;
  } else if (!fecha) {
    const hoy = new Date();
    fecha = `${String(hoy.getDate()).padStart(2, "0")}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${hoy.getFullYear()}`;
  } else {
    fecha = limpiar(fecha).replace(/[\s.]+$/, "");
  }

  return `${clienteLimpio} - ${tipoLimpio} - ${fecha}`;
}
