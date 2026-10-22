"use client";

import { useEffect, useState } from "react";

/**
 * Botón flotante para volver al principio de una lista larga. Aparece recién
 * cuando se bajó un buen trecho; antes sería sólo ruido.
 */
export function VolverArriba({ umbral = 400 }: { umbral?: number }) {
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
      className="fixed bottom-4 left-3 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-[#FFFFFF]/40 bg-[#244B5A] text-[#FFFFFF] shadow-md transition-colors hover:bg-[#1A3844] active:bg-[#12293A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#244B5A] sm:left-4"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
