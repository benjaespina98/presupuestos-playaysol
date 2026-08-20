/**
 * Formato de números y dinero en argentino.
 *
 * Existe porque hoy el sistema IMPRIME `$ 2.650.000` pero no lo ACEPTA de vuelta:
 * `parseNum()` en los -calc.js borra todo lo que no sea dígito o punto y llama a
 * parseFloat, así que entiende 2,65 pesos. Está congelado en
 * tests/unit/formato-numerico.test.ts como el comportamiento actual.
 *
 * Este módulo es el reemplazo correcto. Todavía NO se usa en producción: entra
 * cuando se migre la primera calculadora (Fase 5). Hasta entonces conviven.
 *
 * Convención argentina: el punto separa miles, la coma separa decimales.
 */

/** Lo que se guarda como dato es siempre el número. El texto formateado es
 *  presentación y nunca se persiste. */
export type Monto = number;

const SIN_DIGITOS = /[^\d.,-]/g;

/**
 * Interpreta lo que una persona tipeó en un campo de precio o medida.
 *
 * Devuelve `null` para vacío, que NO es lo mismo que cero: en el catálogo, un
 * precio `null` significa "a cotizar" y se imprime distinto que `$ 0`.
 *
 * Cómo resuelve la ambigüedad del punto:
 *
 *   - Si hay coma, la coma es el decimal y todos los puntos son miles.
 *       "1.500,50"  → 1500.5
 *   - Si no hay coma y cada punto separa grupos de exactamente 3 dígitos,
 *     son separadores de miles.
 *       "1.500"     → 1500
 *       "2.650.000" → 2650000
 *   - Si no, el punto es el decimal (alguien tipeando en formato de teclado).
 *       "1.5"       → 1.5
 *       "0.75"      → 0.75
 *
 * Ignora el símbolo de moneda, los espacios (incluido el espacio duro que mete
 * Intl) y cualquier otro caracter suelto.
 */
export function parseARS(entrada: string | number | null | undefined): Monto | null {
  if (entrada === null || entrada === undefined) return null;
  if (typeof entrada === "number") return Number.isFinite(entrada) ? entrada : null;

  const limpio = entrada.replace(SIN_DIGITOS, "").trim();
  if (!limpio || limpio === "-") return null;

  const negativo = limpio.startsWith("-");
  const cuerpo = negativo ? limpio.slice(1) : limpio;

  let normalizado: string;

  if (cuerpo.includes(",")) {
    // La coma manda: es el decimal. Los puntos que haya son miles.
    const [enteros, ...resto] = cuerpo.split(",");
    normalizado = `${enteros.replace(/\./g, "")}.${resto.join("")}`;
  } else if (esAgrupacionDeMiles(cuerpo)) {
    normalizado = cuerpo.replace(/\./g, "");
  } else {
    normalizado = cuerpo;
  }

  const n = Number(normalizado);
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

/** "1.500" y "2.650.000" sí; "1.5", "1.50" y "1.5000" no. */
function esAgrupacionDeMiles(s: string): boolean {
  if (!s.includes(".")) return false;
  return /^\d{1,3}(\.\d{3})+$/.test(s);
}

/**
 * Igual que parseARS pero devuelve 0 en vez de null. Para campos donde vacío y
 * cero son lo mismo (metros, cantidades), no para precios.
 */
export function parseARSOCero(entrada: string | number | null | undefined): Monto {
  return parseARS(entrada) ?? 0;
}

const FORMATO_MONEDA = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 2,
});

const FORMATO_NUMERO = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 2,
});

/**
 * Importe con símbolo, como sale hoy en el documento: `$ 2.650.000`.
 *
 * El separador que usa Intl entre "$" y el número puede ser un espacio duro
 * según la versión de ICU; acá se arma a mano para que sea siempre el mismo
 * caracter y el texto del documento no dependa del navegador.
 */
export function formatARS(n: Monto | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "";
  return `$ ${FORMATO_MONEDA.format(n)}`;
}

/** Número sin símbolo: medidas, metros, m². */
export function formatNumero(n: Monto | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "";
  return FORMATO_NUMERO.format(n);
}

/**
 * Lo que va DENTRO de un campo de texto editable. A diferencia de formatARS,
 * no lleva símbolo ni separadores de miles: es el número tal cual, para que al
 * volver a tipear encima no se arrastre formato.
 *
 * La separación entre "valor interno" y "valor visual" es justamente esto:
 *   valor interno (lo que se guarda) : 2650000
 *   valor visual  (lo que se muestra): $ 2.650.000
 *   valor de edición (lo que se tipea): 2650000
 */
export function paraEditar(n: Monto | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "";
  return String(n);
}
