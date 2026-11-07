/**
 * Qué incluye un precio respecto de la instalación: "Sin instalación", "Con instalación" o, para el costo fijo
 * de los cobertores, "Se suma al total con instalación". Se lee de la clave del precio base de cada calculadora y,
 * para el resto, de lo que dice el nombre ("instalado", "con instalación", "sin instalación").
 * Devuelve null si el precio no habla de instalación (un opcional suelto, un material...).
 *
 * Es sólo para mostrar (pastilla en Precios y aclaración en la planilla): no se guarda ni cambia ningún precio.
 */
export type CondicionInstalacion = "Sin instalación" | "Con instalación" | "Se suma al total con instalación";

const POR_CLAVE: Record<string, CondicionInstalacion> = {
  precioSin: "Sin instalación",
  precioCon: "Con instalación",
  precioMenos15: "Sin instalación",
  precioMas15: "Sin instalación",
  precioInstalacion: "Se suma al total con instalación",
};

export function condicionInstalacion(item: { clave: string; descripcion: string | null }): CondicionInstalacion | null {
  const porClave = POR_CLAVE[item.clave];
  if (porClave) return porClave;
  const texto = (item.descripcion ?? "").toLowerCase();
  if (/sin\s+instalaci[oó]n/.test(texto)) return "Sin instalación";
  if (/con\s+instalaci[oó]n|instalad[oa]s?\b|instalaci[oó]n\s+incluida/.test(texto)) return "Con instalación";
  return null;
}
