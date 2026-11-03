import type { ReactNode } from "react";

/** Una lista sin nada para mostrar: qué pasa y, si corresponde, qué hacer. Igual en todas las pantallas. */
export function ListaVacia({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-[#7D8892] px-4 py-10 text-center">
      <p className="text-sm text-[#3E4A52]">{children}</p>
      {accion && <div className="mt-3">{accion}</div>}
    </div>
  );
}

/** Lo que se ve mientras carga una lista: la forma de lo que viene, para que la pantalla no salte al llegar los datos. */
export function ListaCargando({ filas = 8 }: { filas?: number }) {
  return (
    <div role="status" aria-label="Cargando" className="overflow-hidden rounded-lg border border-[#D9DFE3] bg-[#FFFFFF]">
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="flex animate-pulse items-center justify-between gap-4 border-b border-[#EEF1F3] px-4 py-3.5 last:border-0">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-2/5 max-w-64 rounded bg-[#E3E8EB]" />
            <div className="h-3 w-1/4 max-w-40 rounded bg-[#EEF1F3]" />
          </div>
          <div className="h-3.5 w-20 rounded bg-[#E3E8EB]" />
        </div>
      ))}
    </div>
  );
}
