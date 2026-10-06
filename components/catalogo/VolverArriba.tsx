"use client";

import { useEffect, useState } from "react";

/**
 * Botón flotante para volver al principio de una lista larga. Aparece recién
 * cuando se bajó un buen trecho; antes sería sólo ruido.
 */
export function VolverArriba({ umbral = 500 }: { umbral?: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const alScrollear = () => setVisible(window.scrollY > umbral);
    alScrollear();
    window.addEventListener("scroll", alScrollear, { passive: true });
    return () => window.removeEventListener("scroll", alScrollear);
  }, [umbral]);

  if (!visible) return null;

  return (
    <button
      type="button"
      data-print-hide=""
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Volver arriba"
      className="fixed bottom-5 right-5 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-[#1B3A5C] text-white shadow-lg transition-colors hover:bg-[#142c46] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B3A5C]"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
