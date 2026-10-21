/**
 * A dónde mandar al usuario después de iniciar sesión.
 *
 * `/login?redirectTo=...` viene de la URL, o sea que lo controla quien arma el
 * link. Usarlo tal cual en `router.push` permitía un enlace como
 * `/login?redirectTo=https://sitio-malo.com`: la víctima ingresa sus datos en
 * el portal verdadero y después aterriza en el sitio del atacante.
 *
 * Sólo se acepta una ruta INTERNA: empieza con una única "/" (no "//", que el
 * navegador interpreta como "mismo esquema, otro host"), sin "\" (varios
 * navegadores lo tratan como "/": "/\x.com" equivale a "//x.com") y sin
 * caracteres de control (los tabuladores y saltos de línea se descartan al
 * parsear la URL: "/\t/x.com" termina siendo "//x.com"). También se mira la
 * versión decodificada, para no depender de cómo la interprete cada capa.
 * Cualquier otra cosa cae en la ruta por defecto.
 */
export const RUTA_POR_DEFECTO = "/dashboard";

const CARACTERES_DE_CONTROL = /[\p{C}\s]/u;

function esSegura(ruta: string): boolean {
  if (!ruta.startsWith("/")) return false;
  if (ruta.startsWith("//")) return false;
  if (ruta.includes("\\")) return false;
  if (CARACTERES_DE_CONTROL.test(ruta)) return false;
  return true;
}

export function rutaInternaSegura(destino: string | null | undefined): string {
  if (typeof destino !== "string" || destino === "") return RUTA_POR_DEFECTO;
  if (!esSegura(destino)) return RUTA_POR_DEFECTO;

  let decodificada: string;
  try {
    decodificada = decodeURIComponent(destino);
  } catch {
    return RUTA_POR_DEFECTO;
  }
  if (!esSegura(decodificada)) return RUTA_POR_DEFECTO;

  return destino;
}
