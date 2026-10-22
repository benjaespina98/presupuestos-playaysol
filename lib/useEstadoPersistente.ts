"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Como useState, pero el valor se conserva en `sessionStorage` (por pestaña): al abrir un detalle y
 * volver, la búsqueda y los filtros siguen como estaban. Si el almacenamiento no está disponible
 * (navegación privada, bloqueado) funciona igual, sólo que sin memoria.
 *
 * El valor guardado se lee DESPUÉS de montar, así el primer render coincide con el del servidor.
 */
export function useEstadoPersistente<T>(clave: string, inicial: T): [T, (v: T) => void] {
  const [valor, setValor] = useState<T>(inicial);
  const cargado = useRef(false);

  useEffect(() => {
    try {
      const guardado = window.sessionStorage.getItem(`pys:${clave}`);
      if (guardado !== null) setValor(JSON.parse(guardado) as T);
    } catch {
      /* sin almacenamiento: queda el valor inicial */
    }
    cargado.current = true;
  }, [clave]);

  const cambiar = useCallback(
    (nuevo: T) => {
      setValor(nuevo);
      try {
        window.sessionStorage.setItem(`pys:${clave}`, JSON.stringify(nuevo));
      } catch {
        /* sin almacenamiento */
      }
    },
    [clave]
  );

  return [valor, cambiar];
}
