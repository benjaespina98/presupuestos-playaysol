"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface AccionMenu {
  /** El texto del renglón del menú (y su nombre accesible). */
  etiqueta: string;
  onClick: () => void;
}

/**
 * Un botón "⋯" que abre un menú de acciones. El menú se dibuja fuera de la lista (en el <body>) para
 * que ningún contenedor con `overflow` lo recorte, se cierra al tocar afuera, con Escape o al mover la
 * página, y se puede recorrer con las flechas. Cada renglón mide al menos 44 px.
 */
export function MenuAcciones({ etiqueta, acciones }: { etiqueta: string; acciones: AccionMenu[] }) {
  const id = useId();
  const boton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [posicion, setPosicion] = useState<{ top?: number; bottom?: number; right: number } | null>(null);

  const cerrar = useCallback((devolverFoco = false) => {
    setPosicion(null);
    if (devolverFoco) boton.current?.focus();
  }, []);

  function abrir() {
    const r = boton.current?.getBoundingClientRect();
    if (!r) return;
    const alto = acciones.length * 44 + 16;
    const hayLugarAbajo = window.innerHeight - r.bottom > alto + 8;
    setPosicion({
      right: Math.max(8, window.innerWidth - r.right),
      ...(hayLugarAbajo ? { top: r.bottom + 4 } : { bottom: window.innerHeight - r.top + 4 }),
    });
  }

  useEffect(() => {
    if (!posicion) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    const yAlAbrir = window.scrollY;
    const alTocar = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node) && !boton.current?.contains(e.target as Node)) cerrar();
    };
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar(true);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
        const i = items.indexOf(document.activeElement as HTMLElement);
        items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus({ preventScroll: true });
      }
    };
    // Se cierra si la página se mueve de verdad (no por el foco o un ajuste de unos pocos píxeles).
    const alMover = () => {
      if (Math.abs(window.scrollY - yAlAbrir) > 24) cerrar();
    };
    document.addEventListener("mousedown", alTocar);
    document.addEventListener("keydown", alTeclear);
    window.addEventListener("scroll", alMover, true);
    window.addEventListener("resize", alMover);
    return () => {
      document.removeEventListener("mousedown", alTocar);
      document.removeEventListener("keydown", alTeclear);
      window.removeEventListener("scroll", alMover, true);
      window.removeEventListener("resize", alMover);
    };
  }, [posicion, cerrar]);

  return (
    <>
      <button
        ref={boton}
        type="button"
        aria-label={etiqueta}
        aria-haspopup="menu"
        aria-expanded={posicion !== null}
        aria-controls={posicion ? `${id}-menu` : undefined}
        onClick={() => (posicion ? cerrar() : abrir())}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-marca/40 bg-white text-lg font-bold leading-none text-marca shadow-sm transition-colors hover:border-marca hover:bg-marca/5 active:bg-marca/10"
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {posicion &&
        createPortal(
          <div
            ref={menu}
            id={`${id}-menu`}
            role="menu"
            aria-label={etiqueta}
            style={{ position: "fixed", top: posicion.top, bottom: posicion.bottom, right: posicion.right }}
            className="z-[60] min-w-48 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
          >
            {acciones.map((a) => (
              <button
                key={a.etiqueta}
                type="button"
                role="menuitem"
                onClick={() => {
                  cerrar();
                  a.onClick();
                }}
                className="flex min-h-11 w-full items-center px-4 text-left text-sm font-medium text-gray-800 hover:bg-marca/8 focus-visible:bg-marca/8 focus-visible:outline-none"
              >
                {a.etiqueta}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
