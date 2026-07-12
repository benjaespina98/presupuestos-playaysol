// Fallback nativo de Next (Suspense a nivel del segmento /dashboard) que se muestra
// durante la transición entre rutas si llega a suspender. Deliberadamente neutro —un
// spinner centrado en el navy de marca— para que no choque en ninguna página del
// dashboard (las calculadoras usan además el CalculatorSkeleton vía dynamic(loading),
// y el historial tiene su propio skeleton con la forma de la tabla).
export default function DashboardLoading() {
  return (
    <div
      role="status"
      aria-label="Cargando"
      className="flex min-h-[40vh] items-center justify-center"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#1B3A5C]/20 border-t-[#1B3A5C]" />
    </div>
  );
}
