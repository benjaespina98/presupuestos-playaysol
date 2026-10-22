"use client";

import { createContext, useCallback, useContext, useEffect, useId, useState, type ReactNode } from "react";
import { botonDe } from "./botones";

/**
 * La hoja: el marco común de todos los formularios y diálogos del portal.
 *
 * - Celular: sube desde abajo y ocupa el ancho; el encabezado (título y cerrar) y el pie (acciones)
 *   quedan fijos y SOLO el cuerpo hace scroll. Respeta el área segura del iPhone y usa `dvh`, que
 *   descuenta el teclado abierto.
 * - Escritorio: modal centrado de ancho acotado, con el mismo esquema.
 *
 * Si `hayCambios` es verdadero, cerrar (X, Escape, tocar afuera o Cancelar) primero avisa que hay
 * cambios sin guardar. Mientras `ocupado` (guardando) no se puede cerrar.
 */

const ANCHOS = { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-lg", xl: "sm:max-w-2xl" } as const;

interface ContextoHoja {
  /** Pide cerrar la hoja (respeta el aviso de cambios sin guardar). */
  cerrar: () => void;
}
const Contexto = createContext<ContextoHoja | null>(null);
export const useHoja = () => useContext(Contexto);

export function Hoja({
  titulo,
  subtitulo,
  ocupado = false,
  hayCambios = false,
  ancho = "md",
  rol = "dialog",
  aviso,
  pie,
  onCerrar,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  ocupado?: boolean;
  hayCambios?: boolean;
  ancho?: keyof typeof ANCHOS;
  /** "alertdialog" para confirmaciones (anular, descartar...). */
  rol?: "dialog" | "alertdialog";
  /** Un mensaje (por ejemplo un error de guardado) que queda fijo, encima de las acciones. */
  aviso?: ReactNode;
  /** Las acciones; quedan fijas abajo. */
  pie?: ReactNode;
  onCerrar: () => void;
  children: ReactNode;
}) {
  const id = useId();
  const [descartando, setDescartando] = useState(false);

  const cerrar = useCallback(() => {
    if (ocupado) return;
    if (hayCambios) setDescartando(true);
    else onCerrar();
  }, [ocupado, hayCambios, onCerrar]);

  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if (e.key === "Escape") cerrar();
    }
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [cerrar]);

  // El fondo no hace scroll mientras la hoja está abierta.
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = anterior;
    };
  }, []);

  return (
    <Contexto.Provider value={{ cerrar }}>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-marca/45 sm:items-center sm:p-4" onClick={cerrar}>
        <div
          role={rol}
          aria-modal="true"
          aria-labelledby={`${id}-titulo`}
          className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl ${ANCHOS[ancho]}`}
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-5 py-3">
            <div className="min-w-0 pt-1">
              <h2 id={`${id}-titulo`} className="truncate text-base font-bold text-marca">
                {titulo}
              </h2>
              {subtitulo && <p className="mt-0.5 truncate text-xs text-gray-500">{subtitulo}</p>}
            </div>
            <button
              type="button"
              onClick={cerrar}
              disabled={ocupado}
              aria-label="Cerrar ventana"
              className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl leading-none text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>

          {(pie || aviso) && (
            <footer className="shrink-0 border-t border-gray-100 bg-white px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
              {aviso && !descartando && <div className="mb-2">{aviso}</div>}
              {descartando ? (
                <div role="alertdialog" aria-label="Cambios sin guardar" className="space-y-2">
                  <p className="text-sm font-medium text-gray-800">Hay cambios sin guardar. ¿Los descartás?</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setDescartando(false)} className={botonDe("secundario", "flex-1")}>
                      Seguir editando
                    </button>
                    <button type="button" onClick={onCerrar} className={botonDe("peligro", "flex-1")}>
                      Descartar
                    </button>
                  </div>
                </div>
              ) : (
                pie
              )}
            </footer>
          )}
        </div>
      </div>
    </Contexto.Provider>
  );
}

/** El pie estándar de un formulario: Cancelar (secundario) y Guardar (primario), en una sola fila. */
export function PieAcciones({
  formId,
  guardando = false,
  etiqueta,
  etiquetaGuardando = "Guardando...",
  etiquetaCancelar = "Cancelar",
}: {
  /** El id del <form> del cuerpo: el botón Guardar está fuera del form, así que lo referencia. */
  formId: string;
  guardando?: boolean;
  etiqueta: string;
  etiquetaGuardando?: string;
  etiquetaCancelar?: string;
}) {
  const hoja = useHoja();
  return (
    <div className="flex gap-2 sm:justify-end">
      <button type="button" onClick={() => hoja?.cerrar()} disabled={guardando} className={botonDe("secundario", "flex-1 sm:min-w-28 sm:flex-none")}>
        {etiquetaCancelar}
      </button>
      <button type="submit" form={formId} disabled={guardando} className={botonDe("primario", "flex-[2] sm:min-w-44 sm:flex-none")}>
        {guardando ? etiquetaGuardando : etiqueta}
      </button>
    </div>
  );
}
