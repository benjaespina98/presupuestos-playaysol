const SIN_CONEXION = "No se pudo conectar con el servidor. Probá de nuevo en un momento.";

/**
 * Lo que se le muestra a quien no pudo ingresar. Supabase responde en inglés: acá se traducen los casos comunes.
 * Si el servidor falla sin decir nada (mensaje vacío o un objeto vacío, `{}`) se avisa que no hubo conexión, en
 * lugar de mostrar el texto crudo. El resto se muestra tal cual.
 */
export function mensajeDeIngreso(mensaje: string | null | undefined): string {
  const m = (mensaje ?? "").trim();
  if (m === "" || /^[{[]\s*[}\]]$/.test(m)) return SIN_CONEXION;
  if (/invalid login credentials/i.test(m)) return "El email o la contraseña no son correctos. Revisalos e intentá de nuevo.";
  if (/email not confirmed/i.test(m)) return "Ese email todavía no fue confirmado.";
  if (/rate limit|too many/i.test(m)) return "Demasiados intentos seguidos. Esperá un momento y volvé a probar.";
  if (/fetch|network/i.test(m)) return "No se pudo conectar. Revisá tu conexión a internet e intentá de nuevo.";
  return m;
}
