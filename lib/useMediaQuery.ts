import { useSyncExternalStore } from "react";

/**
 * Si la pantalla cumple una media query (por ejemplo `(min-width: 768px)`). Devuelve `null` hasta que la página
 * termina de cargar en el navegador (así no se dibuja un instante la versión equivocada) y, donde no existe
 * `matchMedia` (las pruebas con jsdom), `true`: se ve la versión de escritorio.
 */
export function useMediaQuery(consulta: string): boolean | null {
  return useSyncExternalStore<boolean | null>(
    (avisar) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mq = window.matchMedia(consulta);
      mq.addEventListener("change", avisar);
      return () => mq.removeEventListener("change", avisar);
    },
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(consulta).matches : true),
    () => null
  );
}

/** Desde 768 px: la barra de herramientas pasa de "Filtros en una hoja" a una fila con menús. */
export const useEsEscritorio = () => useMediaQuery("(min-width: 768px)");
/** Desde 1024 px: entran también las acciones secundarias (por ejemplo "Planilla de costos"). */
export const useEsAncho = () => useMediaQuery("(min-width: 1024px)");
