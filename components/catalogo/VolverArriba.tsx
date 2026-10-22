"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Flecha para volver al principio de una lista larga. Aparece cuando se SUBE la página (ya pasado un buen trecho) y se va
 * sola a los 2,5 segundos: así nunca queda quieta encima de un botón o de un lápiz (en el celular, tapaba la esquina de los
 * botones del final de la página). Va chica, en la esquina de abajo a la izquierda, con margen del borde y del área segura
 * del iPhone.
 */
export function VolverArriba({ umbral = 400, tiempo = 2500 }: { umbral?: number; tiempo?: number }) {
  const [visible, setVisible] = useState(false);
  const ultimo = useRef(0);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    ultimo.current = window.scrollY;
    const alScrollear = () => {
      const y = window.scrollY;
      const sube = y < ultimo.current - 2;
      ultimo.current = y;
      if (y <= umbral) {
        if (reloj.current) clearTimeout(reloj.current);
        setVisible(false);
        return;
      }
      if (!sube) return;
      setVisible(true);
      if (reloj.current) clearTimeout(reloj.current);
      reloj.current = setTimeout(() => setVisible(false), tiempo);
    };
    window.addEventListener("scroll", alScrollear, { passive: true });
    return () => {
      window.removeEventListener("scroll", alScrollear);
      if (reloj.current) clearTimeout(reloj.current);
    };
  }, [umbral, tiempo]);

  if (!visible) return null;

  return (
    <button
      type="button"
      data-print-hide=""
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Volver arriba"
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] z-30 flex h-11 w-11 items-center justify-center rounded-full border border-[#FFFFFF] bg-[#244B5A] text-[#FFFFFF] shadow-md transition-colors hover:bg-[#1A3844] active:bg-[#12293A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#244B5A]"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
