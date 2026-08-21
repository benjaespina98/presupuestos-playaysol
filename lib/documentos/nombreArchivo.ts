/**
 * Nombre de archivo unificado para las 5 calculadoras:
 * `Presupuesto_<Tipo>_<Cliente>_<Fecha>`.
 *
 * Port 1:1 de `public/nombre-archivo.js` (usado hoy por las 5 calculadoras
 * legacy vía `window.armarNombreArchivo`). Mismo comportamiento carácter por
 * carácter — nombre de archivo es "contrato" (Lote 2 de la Fase 5 lo pide
 * explícitamente) — sólo que ahora es un módulo TS importable en vez de vivir
 * en `window`.
 */
export function armarNombreArchivo(tipo: string, cliente: string, fechaStr: string): string {
  // Marcas de acento combinantes (rango Unicode ̀-ͯ), lo que queda
  // de una letra acentuada después de normalizar a NFD ("é" -> "e" + "´").
  const COMBINING_MARKS = /[̀-ͯ]/g;

  function sinTildes(s: string): string {
    return String(s || "").normalize("NFD").replace(COMBINING_MARKS, "");
  }

  // Saca tildes, cualquier caracter que rompa un nombre de archivo en
  // Windows/Mac (barra invertida, barra, dos puntos, asterisco, signo de
  // pregunta, comillas, los signos < >, y la barra vertical), la coma del
  // formato "Apellido, Nombre" del campo cliente, y colapsa espacios en un
  // solo guion bajo.
  function limpiar(s: string): string {
    return sinTildes(s)
      .replace(/[\\/:*?"<>|,]/g, "")
      .trim()
      .replace(/\s+/g, "_");
  }

  const clienteLimpio = limpiar(cliente) || "Sin_nombre";
  const tipoLimpio = limpiar(tipo);

  let fecha = fechaStr;
  const match = String(fecha || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    // Los campos "Fecha" de las calculadoras usan DD/MM/YYYY -- se normaliza a YYYY-MM-DD.
    fecha = `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  } else if (!fecha) {
    fecha = new Date().toISOString().slice(0, 10);
  } else {
    fecha = limpiar(fecha);
  }

  return `Presupuesto_${tipoLimpio}_${clienteLimpio}_${fecha}`;
}
