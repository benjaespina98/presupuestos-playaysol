export type SeccionPortal = "presupuestos" | "precios" | "compras";

/**
 * A qué sección del menú pertenece una ruta. Inicio (/dashboard) no pertenece a ninguna: se llega con el logo. Las
 * calculadoras cuelgan de /dashboard/<tipo> y son parte de Presupuestos.
 */
export function seccionDeRuta(pathname: string): SeccionPortal | null {
  if (pathname === "/dashboard") return null;
  if (pathname === "/dashboard/catalogo" || pathname.startsWith("/dashboard/catalogo/actualizar-precios")) return "precios";
  if (pathname.startsWith("/dashboard/catalogo/")) return "compras";
  return "presupuestos";
}
