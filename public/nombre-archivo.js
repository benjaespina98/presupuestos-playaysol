// Nombre de archivo unificado para las 5 calculadoras: Presupuesto_<Tipo>_<Cliente>_<Fecha>
// Antes cada -calc.js armaba su propio nombre a mano (con sus propias reglas de
// sanitizado, incompletas o inconsistentes entre calculadoras -- losetas ni siquiera
// sacaba tildes ni tenia fecha/tipo en el nombre). Este archivo es el unico lugar
// que define el formato; se carga antes que cada -calc.js / script de losetas.
function armarNombreArchivo(tipo, cliente, fechaStr) {
  var COMBINING_MARKS = new RegExp(String.fromCharCode(91) + String.fromCharCode(92) + 'u0300-' + String.fromCharCode(92) + 'u036f' + String.fromCharCode(93), 'g');

  function sinTildes(s) {
    return String(s || '').normalize('NFD').replace(COMBINING_MARKS, '');
  }

  // Saca tildes, cualquier caracter que rompa un nombre de archivo en Windows/Mac
  // (barra invertida, barra, dos puntos, asterisco, signo de pregunta, comillas,
  // los signos < >, y la barra vertical), y colapsa espacios en un solo guion bajo.
  function limpiar(s) {
    return sinTildes(s)
      .replace(/[\\/:*?"<>|]/g, '')
      .trim()
      .replace(/\s+/g, '_');
  }

  var clienteLimpio = limpiar(cliente) || 'Sin_nombre';
  var tipoLimpio = limpiar(tipo);

  var fecha = fechaStr;
  var match = String(fecha || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    // Los campos "Fecha" de las calculadoras usan DD/MM/YYYY -- se normaliza a YYYY-MM-DD.
    fecha = match[3] + '-' + match[2].padStart(2, '0') + '-' + match[1].padStart(2, '0');
  } else if (!fecha) {
    fecha = new Date().toISOString().slice(0, 10);
  } else {
    fecha = limpiar(fecha);
  }

  return 'Presupuesto_' + tipoLimpio + '_' + clienteLimpio + '_' + fecha;
}
window.armarNombreArchivo = armarNombreArchivo;
