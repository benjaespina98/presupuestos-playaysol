/**
 * Sincroniza esta planilla con el catálogo web de Playa y Sol.
 *
 * El catálogo web es la fuente de verdad: lo que se cambie ahí aparece acá solo
 * (cada 5 minutos, o al instante con Catálogo web → Actualizar ahora). Lo que se
 * escriba a mano en las celdas que sincroniza se pisa en la próxima actualización.
 *
 * Qué sincroniza:
 *   - Hoja "Proveedores":  columnas A..G desde la fila 6.
 *   - Hoja "Artículos":    columnas A..T desde la fila 6. La columna D (precio) NO se
 *                          escribe en los artículos cotizados en dólares: ahí queda la
 *                          fórmula =S*tipo de cambio.
 *   - Hoja "Precios y margen": la columna B (precio de venta) de cada fila que se
 *                          reconoce por su nombre (tamaños de piscina, modelos
 *                          Indusplast y la lista de adicionales). Las celdas con
 *                          fórmula no se tocan.
 *
 * Qué NO toca: fórmulas, formatos, colores, el tipo de cambio (Artículos!B3), ni las
 * hojas Presupuesto, Pedido, Mensaje y Calc.
 *
 * La URL y el token NO van en este archivo: se cargan con Catálogo web → Configurar
 * conexión y quedan guardados en las propiedades del script.
 */

var HOJA_PROVEEDORES = "Proveedores";
var HOJA_ARTICULOS = "Artículos";
var HOJA_PRECIOS = "Precios y margen";

var FILA_INICIO = 6;
var COLUMNAS_PROVEEDORES = 7; // A..G
var COLUMNAS_ARTICULOS = 20; // A..T
var MAX_FILAS_ARTICULOS = 150; // las fórmulas de la planilla leen Artículos!6:155
var MAX_FILAS_PROVEEDORES = 150;
var COLUMNA_PRECIO = 4; // D
var COLUMNA_ACTUALIZADO = 5; // E

// Nombre de la fila en "Precios y margen" → "tipo:clave" del catálogo web.
var ETIQUETAS_PRECIO = {
  "Luces de acero inoxidable": "piscinas:luces",
  "Kit de limpieza": "piscinas:kit_limpieza",
  "Climatización hasta 25.000 L": "piscinas:climatizacion25000",
  "Climatización hasta 30.000 L": "piscinas:climatizacion30000",
  "Cascada lámina de agua": "piscinas:cascada",
  "Baño químico": "piscinas:bano_quimico",
  "Retiro de tierra": "piscinas:retiro_tierra",
  "Tapa metálica de la sala de filtros": "piscinas:tapa_metalica",
  "Disqueado / remoción de revestimiento previo": "revestimientos:disqueado_revestimiento_previo",
  "Reemplazo de losetas por decks": "piscinas:reemplazo_losetas_decks",
  "Solárium con losetas": "piscinas:solarium_losetas",
  "Solárium con decks": "piscinas:solarium_decks",
  "Cobertor hasta 15 m²": "cobertores:precioMenos15",
  "Cobertor de más de 15 m²": "cobertores:precioMas15",
  "Instalación de cobertor": "cobertores:precioInstalacion",
  "Cerco perimetral sin instalación": "cercos:precioSin",
  "Cerco perimetral con instalación": "cercos:precioCon",
  "Cerámico Bali Brasil": "revestimientos:revestimiento_ceramico_bali",
  "Piedra Bali interior": "revestimientos:revestimiento_piedra_bali",
  "Travertino rústico exterior": "piscinas:travertino_rustico_exterior",
  "Travertino pulido interior": "piscinas:travertino_pulido_interior",
  "Mármol Travertino Turquía": "revestimientos:travertino",
  "Venecitas Premium España": "revestimientos:venecitas_premium_espana"
};

/**
 * La clave del catálogo ("tipo:clave") de una fila de "Precios y margen", según el
 * texto de su primera columna; null si la fila no es un precio que se sincronice.
 */
function claveDePrecio(etiqueta) {
  var t = String(etiqueta === null || etiqueta === undefined ? "" : etiqueta).trim();
  if (Object.prototype.hasOwnProperty.call(ETIQUETAS_PRECIO, t)) return ETIQUETAS_PRECIO[t];
  // Piscina de hormigón por tamaño: "8x4", "7x3.50", "6.5x2.5".
  // (El primer punto pasa a "_", igual que en la migración que cargó estos precios.)
  if (/^\d+(\.\d+)?x\d+(\.\d+)?$/.test(t)) return "piscinas:lista_hormigon_" + t.replace(".", "_");
  // Piscina de fibra Indusplast: "RACIONALISTA 400", "SPA 240".
  var m = /^(RACIONALISTA|CARIBE|FINESA|LAGUNE|SPA) (\d+)$/.exec(t);
  if (m) return "piscinas:indusplast_" + m[1].toLowerCase() + "_" + m[2];
  return null;
}

/**
 * Lo que se escribe en la celda de precio: el número, "A cotizar" si el catálogo no
 * tiene precio, o undefined si el catálogo no conoce ese ítem (no se toca la celda).
 */
function valorDePrecio(precios, clave) {
  if (!Object.prototype.hasOwnProperty.call(precios, clave)) return undefined;
  var p = precios[clave];
  return p === null ? "A cotizar" : p;
}

/** Valida lo que mandó la web ANTES de tocar la planilla: un catálogo vacío o roto
 *  nunca tiene que borrar la planilla. Devuelve un mensaje de error, o null si está bien. */
function validarDatos(datos) {
  if (!datos || typeof datos !== "object") return "La respuesta del catálogo no es válida.";
  if (!Array.isArray(datos.proveedores) || !Array.isArray(datos.articulos) || !datos.precios) {
    return "La respuesta del catálogo está incompleta.";
  }
  if (datos.proveedores.length === 0 || datos.articulos.length === 0) {
    return "El catálogo no tiene proveedores o materiales: no se actualiza la planilla para no borrarla.";
  }
  if (datos.articulos.length > MAX_FILAS_ARTICULOS) {
    return "Hay " + datos.articulos.length + " materiales y la planilla admite " + MAX_FILAS_ARTICULOS + ".";
  }
  if (datos.proveedores.length > MAX_FILAS_PROVEEDORES) {
    return "Hay demasiados proveedores para la planilla (máximo " + MAX_FILAS_PROVEEDORES + ").";
  }
  for (var i = 0; i < datos.articulos.length; i++) {
    if (!datos.articulos[i].fila || datos.articulos[i].fila.length !== COLUMNAS_ARTICULOS) {
      return "El material " + (i + 1) + " no tiene las " + COLUMNAS_ARTICULOS + " columnas esperadas.";
    }
  }
  for (var j = 0; j < datos.proveedores.length; j++) {
    if (datos.proveedores[j].length !== COLUMNAS_PROVEEDORES) {
      return "El proveedor " + (j + 1) + " no tiene las " + COLUMNAS_PROVEEDORES + " columnas esperadas.";
    }
  }
  return null;
}

function celdaVacia_(c) {
  return c === null || c === undefined ? "" : c;
}

// ───────────────────────────── Escritura en la planilla ─────────────────────────────

function escribirProveedores_(hoja, filas) {
  var ultima = Math.max(hoja.getLastRow(), FILA_INICIO + filas.length - 1);
  hoja.getRange(FILA_INICIO, 1, ultima - FILA_INICIO + 1, COLUMNAS_PROVEEDORES).clearContent();
  var valores = filas.map(function (f) { return f.map(celdaVacia_); });
  hoja.getRange(FILA_INICIO, 1, valores.length, COLUMNAS_PROVEEDORES).setValues(valores);
}

function escribirArticulos_(hoja, articulos) {
  // "Actualizado" es un texto ("18/06/2026"): sin formato de texto, Sheets lo convertiría en fecha.
  hoja.getRange(FILA_INICIO, COLUMNA_ACTUALIZADO, MAX_FILAS_ARTICULOS, 1).setNumberFormat("@");
  hoja.getRange(FILA_INICIO, 1, MAX_FILAS_ARTICULOS, COLUMNAS_ARTICULOS).clearContent();
  var valores = articulos.map(function (a) { return a.fila.map(celdaVacia_); });
  hoja.getRange(FILA_INICIO, 1, valores.length, COLUMNAS_ARTICULOS).setValues(valores);
  // Los cotizados en dólares: el precio en pesos es una fórmula (USD ref. × tipo de cambio).
  articulos.forEach(function (a, i) {
    if (a.usd) {
      var fila = FILA_INICIO + i;
      hoja.getRange(fila, COLUMNA_PRECIO).setFormula("=S" + fila + "*$B$3");
    }
  });
}

function escribirPrecios_(hoja, precios) {
  var ultima = hoja.getLastRow();
  if (ultima < 1) return 0;
  var rango = hoja.getRange(1, 1, ultima, 2);
  var valores = rango.getValues();
  var formulas = rango.getFormulas();
  var cambios = 0;
  for (var i = 0; i < valores.length; i++) {
    var clave = claveDePrecio(valores[i][0]);
    if (!clave) continue;
    if (formulas[i][1]) continue; // una fórmula nunca se pisa
    var nuevo = valorDePrecio(precios, clave);
    if (nuevo === undefined) continue;
    if (valores[i][1] !== nuevo) {
      hoja.getRange(i + 1, 2).setValue(nuevo);
      cambios++;
    }
  }
  return cambios;
}

function hoja_(nombre) {
  var h = SpreadsheetApp.getActive().getSheetByName(nombre);
  if (!h) throw new Error('No encuentro la hoja "' + nombre + '".');
  return h;
}

// ───────────────────────────────── Sincronización ─────────────────────────────────

/** Trae el catálogo y actualiza la planilla. `forzar` = escribir aunque no haya cambios. */
function sincronizar_(forzar) {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty("URL");
  var token = props.getProperty("TOKEN");
  if (!url || !token) throw new Error("Falta configurar la conexión: Catálogo web → Configurar conexión.");

  var candado = LockService.getScriptLock();
  if (!candado.tryLock(10000)) return { estado: "ocupado" };
  try {
    var resp = UrlFetchApp.fetch(url, {
      headers: { Authorization: "Bearer " + token },
      muteHttpExceptions: true
    });
    var codigo = resp.getResponseCode();
    if (codigo === 401) throw new Error("El catálogo rechazó el token (401). Revisá Configurar conexión.");
    if (codigo === 503) throw new Error("El catálogo todavía no tiene activada la sincronización (503).");
    if (codigo !== 200) throw new Error("El catálogo respondió " + codigo + ".");

    var datos = JSON.parse(resp.getContentText());
    var problema = validarDatos(datos);
    if (problema) throw new Error(problema);

    if (!forzar && datos.version === props.getProperty("VERSION")) return { estado: "sin cambios" };

    escribirProveedores_(hoja_(HOJA_PROVEEDORES), datos.proveedores);
    escribirArticulos_(hoja_(HOJA_ARTICULOS), datos.articulos);
    var precios = escribirPrecios_(hoja_(HOJA_PRECIOS), datos.precios);
    SpreadsheetApp.flush();

    props.setProperty("VERSION", datos.version);
    props.setProperty("ULTIMA", new Date().toISOString());
    props.deleteProperty("ULTIMO_ERROR");
    return {
      estado: "actualizada",
      proveedores: datos.proveedores.length,
      materiales: datos.articulos.length,
      precios: precios
    };
  } finally {
    candado.releaseLock();
  }
}

// ──────────────────────────────── Menú y disparador ────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Catálogo web")
    .addItem("Actualizar ahora", "actualizarAhora")
    .addSeparator()
    .addItem("Configurar conexión", "configurar")
    .addItem("Activar actualización automática", "activarAutomatica")
    .addItem("Desactivar actualización automática", "desactivarAutomatica")
    .addItem("Estado", "mostrarEstado")
    .addToUi();
}

function configurar() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();
  var url = ui.prompt(
    "Configurar conexión (1 de 2)",
    "Dirección de sincronización del catálogo. Termina en /api/sheets/catalogo",
    ui.ButtonSet.OK_CANCEL
  );
  if (url.getSelectedButton() !== ui.Button.OK) return;
  var token = ui.prompt(
    "Configurar conexión (2 de 2)",
    "Token de sincronización (el mismo que está cargado en Vercel como SHEETS_SYNC_TOKEN)",
    ui.ButtonSet.OK_CANCEL
  );
  if (token.getSelectedButton() !== ui.Button.OK) return;
  props.setProperty("URL", url.getResponseText().trim());
  props.setProperty("TOKEN", token.getResponseText().trim());
  props.deleteProperty("VERSION");
  ui.alert("Listo. Ahora probá Catálogo web → Actualizar ahora.");
}

function actualizarAhora() {
  var ui = SpreadsheetApp.getUi();
  try {
    var r = sincronizar_(true);
    if (r.estado === "ocupado") ui.alert("Ya hay una actualización en curso. Probá de nuevo en un momento.");
    else ui.alert("Planilla actualizada: " + r.proveedores + " proveedores, " + r.materiales + " materiales y " + r.precios + " precios de venta cambiados.");
  } catch (e) {
    ui.alert("No se pudo actualizar: " + e.message);
  }
}

/** Es lo que corre solo cada pocos minutos. Nunca muestra ventanas. */
function sincronizarAutomatico() {
  try {
    sincronizar_(false);
  } catch (e) {
    PropertiesService.getScriptProperties().setProperty("ULTIMO_ERROR", new Date().toISOString() + " · " + e.message);
    console.error(e);
  }
}

function activarAutomatica() {
  desactivarAutomatica_();
  ScriptApp.newTrigger("sincronizarAutomatico").timeBased().everyMinutes(5).create();
  SpreadsheetApp.getUi().alert("Actualización automática activada: la planilla se actualiza sola cada 5 minutos.");
}

function desactivarAutomatica() {
  var n = desactivarAutomatica_();
  SpreadsheetApp.getUi().alert(n > 0 ? "Actualización automática desactivada." : "No había actualización automática activada.");
}

function desactivarAutomatica_() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "sincronizarAutomatico") {
      ScriptApp.deleteTrigger(t);
      n++;
    }
  });
  return n;
}

function mostrarEstado() {
  var props = PropertiesService.getScriptProperties();
  var automatica = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === "sincronizarAutomatico"; });
  var texto =
    "Conexión: " + (props.getProperty("URL") && props.getProperty("TOKEN") ? "configurada" : "SIN configurar") + "\n" +
    "Actualización automática: " + (automatica ? "activada (cada 5 minutos)" : "desactivada") + "\n" +
    "Última actualización: " + (props.getProperty("ULTIMA") || "nunca") + "\n" +
    "Último error: " + (props.getProperty("ULTIMO_ERROR") || "ninguno");
  SpreadsheetApp.getUi().alert("Catálogo web", texto, SpreadsheetApp.getUi().ButtonSet.OK);
}

// Sólo para las pruebas automáticas del proyecto (en Google Apps Script `module` no existe).
if (typeof module !== "undefined" && module.exports) {
  module.exports = { claveDePrecio: claveDePrecio, valorDePrecio: valorDePrecio, validarDatos: validarDatos, ETIQUETAS_PRECIO: ETIQUETAS_PRECIO };
}
