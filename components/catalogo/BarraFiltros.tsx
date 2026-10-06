"use client";

import { useEffect, useRef } from "react";

/**
 * La barra de filtros de las pantallas del catálogo. En pantallas medianas y
 * grandes queda fija arriba al bajar por la lista, así la búsqueda y los
 * filtros siempre están a mano.
 *
 * Publica su alto en la variable CSS `--catalogo-barra`: el encabezado de
 * columnas de las listas se pega justo debajo de ella (`top-[var(--catalogo-barra)]`)
 * sin que ninguna pantalla tenga que conocer cuánto mide.
 */
export function BarraFiltros({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const raiz = document.documentElement;
    const publicar = () => raiz.style.setProperty("--catalogo-barra", `${el.offsetHeight}px`);
    publicar();
    if (typeof ResizeObserver === "undefined") return () => raiz.style.removeProperty("--catalogo-barra");
    const obs = new ResizeObserver(publicar);
    obs.observe(el);
    return () => {
      obs.disconnect();
      raiz.style.removeProperty("--catalogo-barra");
    };
  }, []);

  return (
    <div
      ref={ref}
      className="space-y-2.5 pb-3 md:sticky md:top-0 md:z-20 md:-mx-4 md:bg-gray-50 md:px-4 md:pt-3"
    >
      {children}
    </div>
  );
}
