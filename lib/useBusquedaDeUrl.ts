"use client";

import { useEffect, useEffectEvent } from "react";

/**
 * Para llegar a una lista con una búsqueda hecha (`?buscar=...`), como desde el buscador de Inicio. Aplica la búsqueda
 * una vez y la saca de la dirección: de ahí en más queda en los filtros de la lista, igual que si se hubiera escrito.
 */
export function useBusquedaDeUrl(aplicar: (busqueda: string) => void) {
  const alLlegar = useEffectEvent(aplicar);

  useEffect(() => {
    const url = new URL(window.location.href);
    const busqueda = url.searchParams.get("buscar");
    if (!busqueda) return;
    url.searchParams.delete("buscar");
    window.history.replaceState(window.history.state, "", url);
    alLlegar(busqueda);
  }, []);
}
