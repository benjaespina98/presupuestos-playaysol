export type SeccionPortal = "presupuestos" | "precios" | "stock" | "compras";

/**
 * A qué sección del menú pertenece una ruta. Inicio (/dashboard) y el plano de piscina no pertenecen a ninguna: se
 * llega con el logo y la tarjeta de Inicio. Las calculadoras de presupuestos cuelgan de /dashboard/<tipo>.
 */
export function seccionDeRuta(pathname: string): SeccionPortal | null {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/losetas")) return null;
  if (pathname.startsWith("/dashboard/stock")) return "stock";
  if (pathname === "/dashboard/catalogo" || pathname.startsWith("/dashboard/catalogo/actualizar-precios")) return "precios";
  if (pathname.startsWith("/dashboard/catalogo/")) return "compras";
  return "presupuestos";
}
