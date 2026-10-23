"use client";

import { useEffect } from "react";

/**
 * Safari de iOS: después de cerrar el teclado, lo que está `fixed` (menús, avisos, hojas) puede quedar posicionado con el alto
 * viejo, a mitad de pantalla, hasta que la página se mueve. Al soltar el foco de un campo, cuando el teclado ya se fue, se
 * mueve la página un píxel y se la devuelve: el navegador recalcula la posición de lo fijo. No hace nada si no hay un
 * `visualViewport` o si el teclado sigue abierto.
 */
export function ArreglosTeclado() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let reloj: ReturnType<typeof setTimeout> | null = null;
    const alSoltar = () => {
      if (reloj) clearTimeout(reloj);
      reloj = setTimeout(() => {
        const activo = document.activeElement;
        const editando = activo instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(activo.tagName);
        if (editando || vv.height < window.innerHeight - 100) return; // el teclado sigue ahí
        const y = window.scrollY;
        window.scrollTo(window.scrollX, y + 1);
        window.scrollTo(window.scrollX, y);
      }, 350);
    };
    document.addEventListener("focusout", alSoltar);
    return () => {
      document.removeEventListener("focusout", alSoltar);
      if (reloj) clearTimeout(reloj);
    };
  }, []);
  return null;
}
