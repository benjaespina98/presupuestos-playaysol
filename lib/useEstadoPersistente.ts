"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

/**
 * Como useState, pero el valor se conserva en `sessionStorage` (por pestaña): al abrir un detalle y
 * volver, la búsqueda y los filtros siguen como estaban. Si el almacenamiento no está disponible
 * (navegación privada, bloqueado) funciona igual durante la visita, sólo que sin memoria al volver.
 *
 * Se lee con `useSyncExternalStore`: en el servidor (y en el primer render del navegador) vale el
 * valor inicial, así la hidratación coincide; después pasa al valor guardado.
 */

const oyentes = new Set<() => void>();
/** Respaldo en memoria si `sessionStorage` no se puede usar. */
const enMemoria = new Map<string, string>();

function suscribir(cb: () => void) {
  oyentes.add(cb);
  return () => {
    oyentes.delete(cb);
  };
}

function leer(clave: string): string | null {
  try {
    return window.sessionStorage.getItem(clave);
  } catch {
    return enMemoria.get(clave) ?? null;
  }
}

function escribir(clave: string, valor: string) {
  try {
    window.sessionStorage.setItem(clave, valor);
  } catch {
    enMemoria.set(clave, valor);
  }
  oyentes.forEach((cb) => cb());
}

export function useEstadoPersistente<T>(clave: string, inicial: T): [T, (v: T) => void] {
  const claveCompleta = `pys:${clave}`;
  // El valor inicial se toma una sola vez (suele pasarse como un objeto literal, que cambia en cada render).
  const [valorInicial] = useState(inicial);
  const crudo = useSyncExternalStore(
    suscribir,
    () => leer(claveCompleta),
    () => null
  );

  const valor = useMemo<T>(() => {
    if (crudo === null) return valorInicial;
    try {
      return JSON.parse(crudo) as T;
    } catch {
      return valorInicial;
    }
  }, [crudo, valorInicial]);

  const cambiar = useCallback((nuevo: T) => escribir(claveCompleta, JSON.stringify(nuevo)), [claveCompleta]);

  return [valor, cambiar];
}
