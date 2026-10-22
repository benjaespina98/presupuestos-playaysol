/**
 * Columna centrada para las pantallas de "portal" (selección de calculadora,
 * historial). El <main> del dashboard es de ancho completo porque las
 * calculadoras lo necesitan; estas pantallas piden acá su propio ancho.
 */
export function PanelPortal({
  children,
  compacto = false,
  amplio = false,
}: {
  children: React.ReactNode;
  compacto?: boolean;
  /** Para las pantallas con tablas anchas (historial, catálogo): usa más ancho en monitores grandes. */
  amplio?: boolean;
}) {
  return <div className={`mx-auto ${amplio ? "max-w-7xl" : "max-w-5xl"} px-4 ${compacto ? "pb-8 pt-5" : "py-8"}`}>{children}</div>;
}
