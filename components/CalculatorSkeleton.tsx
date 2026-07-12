// Skeleton de carga de las calculadoras. Se usa en dos momentos para que la
// transición nunca muestre una pantalla en blanco:
//   1) como `loading` del dynamic(import) de cada page.tsx — mientras baja el chunk
//      del calculador (lo más lento en la primera visita / conexiones lentas).
//   2) dentro de calculator.tsx mientras el CSS legacy todavía no cargó (evita el
//      salto entre "chunk listo" y "estilos listos").
// Imita la forma real: panel de formulario a la izquierda + documento/preview a la
// derecha en desktop, una sola columna en mobile.
export function CalculatorSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid animate-pulse grid-cols-1 gap-6 md:grid-cols-[clamp(340px,32%,460px)_1fr]"
    >
      {/* Panel de formulario */}
      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="h-6 w-2/3 rounded bg-gray-200" />
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 flex-1 rounded bg-gray-100" />
          ))}
        </div>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3 w-24 rounded bg-gray-100" />
            <div className="h-9 w-full rounded bg-gray-200" />
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          <div className="h-11 flex-1 rounded-md bg-gray-200" />
          <div className="h-11 flex-1 rounded-md bg-gray-200" />
        </div>
      </div>

      {/* Panel de documento / preview (oculto en mobile, como el layout real que
          prioriza el formulario en pantalla angosta) */}
      <div className="hidden rounded-lg border border-gray-200 bg-white p-8 shadow-sm md:block">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="mb-8 h-24 w-full rounded bg-gray-100" />
          <div className="h-4 w-1/2 rounded bg-gray-200" />
          <div className="h-3 w-full rounded bg-gray-100" />
          <div className="h-3 w-full rounded bg-gray-100" />
          <div className="h-3 w-4/5 rounded bg-gray-100" />
          <div className="mt-6 h-40 w-full rounded bg-gray-100" />
          <div className="h-3 w-full rounded bg-gray-100" />
          <div className="h-3 w-3/4 rounded bg-gray-100" />
        </div>
      </div>
    </div>
  );
}
