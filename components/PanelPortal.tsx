/**
 * Columna centrada para las pantallas de "portal" (selección de calculadora,
 * historial). El <main> del dashboard es de ancho completo porque las
 * calculadoras lo necesitan; estas pantallas piden acá su propio ancho.
 */
export function PanelPortal({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>;
}
