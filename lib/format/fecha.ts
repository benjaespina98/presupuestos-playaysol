/**
 * Fecha relativa corta ("hoy", "hace 3 días", "hace 2 meses") para mostrar
 * trazabilidad mínima sin ocupar una columna ancha. Pura: recibe "ahora"
 * como parámetro para poder testearla sin mockear el reloj del sistema.
 *
 * Redondea siempre hacia abajo (piso de días completos): "hace 1 día" a las
 * 23:59 de ayer y a la 00:01 de hoy son casos distintos, y no vale la pena
 * la precisión de horas/minutos para algo que es sólo una señal de
 * "¿esto está desactualizado?", no un timestamp exacto — para eso está el
 * atributo `title` con la fecha completa.
 */
export function formatFechaRelativa(iso: string, ahora: Date = new Date()): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";

  const inicioDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((inicioDia(ahora) - inicioDia(fecha)) / 86_400_000);

  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} días`;
  if (dias < 30) {
    const semanas = Math.floor(dias / 7);
    return semanas === 1 ? "hace 1 semana" : `hace ${semanas} semanas`;
  }
  if (dias < 365) {
    const meses = Math.floor(dias / 30);
    return meses === 1 ? "hace 1 mes" : `hace ${meses} meses`;
  }
  const anios = Math.floor(dias / 365);
  return anios === 1 ? "hace 1 año" : `hace ${anios} años`;
}

/** Fecha completa en formato local, para el `title` (tooltip) junto a la
 *  relativa — así quien la mire de cerca ve el día exacto. */
export function formatFechaCompleta(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  return fecha.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
}
