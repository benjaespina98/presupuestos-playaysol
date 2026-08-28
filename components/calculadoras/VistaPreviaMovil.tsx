"use client";

import { useState, type ReactNode } from "react";

/**
 * Editar / Vista previa en celular.
 *
 * El grid de cada calculadora (`grid-cols-1 lg:grid-cols-[1fr_420px]`) ya
 * pone el formulario y el documento lado a lado desde `lg:` en adelante —
 * ahí este componente no hace nada, las dos columnas se ven siempre juntas,
 * igual que antes. Por debajo de `lg:` (celular, y tablet en vertical) las
 * columnas se apilaban una abajo de la otra: para ver cómo iba quedando el
 * presupuesto había que bajar con el dedo pasando TODO el formulario. Eso
 * es justo lo que separación "edición vs. resultado final" pide evitar.
 *
 * La solución es una pestaña, no una pantalla nueva ni una ruta: el
 * documento en vivo (`snapshotEnVivo`) sigue siendo el mismo, sólo cambia
 * cuál de las dos columnas se ve. `lg:block` en las dos ramas asegura que a
 * partir de ese breakpoint el estado de la pestaña deja de importar y
 * vuelven a verse ambas — ninguna lógica de datos depende de esto.
 */
export function VistaPreviaMovil({ formulario, documento }: { formulario: ReactNode; documento: ReactNode }) {
  const [vista, setVista] = useState<"editar" | "vista-previa">("editar");

  return (
    <>
      <div
        data-print-hide=""
        className="sticky top-0 z-10 -mt-2 mb-4 flex gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm lg:hidden"
      >
        <PestanaVista activa={vista === "editar"} onClick={() => setVista("editar")}>
          Editar
        </PestanaVista>
        <PestanaVista activa={vista === "vista-previa"} onClick={() => setVista("vista-previa")}>
          Vista previa
        </PestanaVista>
      </div>

      <div data-print-hide="" className={`${vista === "editar" ? "block" : "hidden"} space-y-6 lg:block`}>
        {formulario}
      </div>

      <div className={`${vista === "vista-previa" ? "block" : "hidden"} lg:block`}>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm print:border-0 print:p-0 print:shadow-none">
          {documento}
        </div>
      </div>
    </>
  );
}

function PestanaVista({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={`min-h-11 flex-1 rounded-md text-sm font-semibold transition-colors ${
        activa ? "bg-[#1B3A5C] text-white" : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}
