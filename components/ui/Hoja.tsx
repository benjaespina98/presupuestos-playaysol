"use client";

import { createContext, useCallback, useContext, useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import { botonDe } from "./botones";

/**
 * La hoja: el marco común de TODAS las ediciones y diálogos del portal (material, proveedor, ítem del catálogo,
 * anular, ingreso, venta, ajustar conteo...).
 *
 * - Celular: hoja inferior de casi toda la altura (92 %) con encabezado fijo (título grande, subtítulo gris
 *   con el nombre del ítem y cerrar de 44 px) y pie fijo con las acciones; SOLO el cuerpo hace scroll.
 *   Respeta el área segura del iPhone y el teclado abierto: la hoja se acota a la parte visible de la pantalla
 *   (`visualViewport`), así el pie con Guardar nunca queda tapado.
 * - Escritorio: modal centrado de ancho acotado, con el mismo esquema.
 *
 * Si `hayCambios` es verdadero, cerrar (X, Escape, tocar afuera o Cancelar) primero avisa que hay cambios sin
 * guardar (Seguir editando o Descartar). Mientras `ocupado` (guardando) no se puede cerrar.
 */

const ANCHOS = { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-lg", xl: "sm:max-w-2xl" } as const;

interface ContextoHoja {
  /** Pide cerrar la hoja (respeta el aviso de cambios sin guardar). */
  cerrar: () => void;
  hayCambios: boolean;
}
const Contexto = createContext<ContextoHoja | null>(null);
export const useHoja = () => useContext(Contexto);

/** La parte visible de la pantalla (descuenta el teclado en iOS, que no achica el viewport de la página). */
function useAreaVisible(): CSSProperties | undefined {
  const [area, setArea] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const medir = () => setArea({ top: vv.offsetTop, height: vv.height });
    medir();
    vv.addEventListener("resize", medir);
    vv.addEventListener("scroll", medir);
    return () => {
      vv.removeEventListener("resize", medir);
      vv.removeEventListener("scroll", medir);
    };
  }, []);
  return area ? { top: area.top, height: area.height, bottom: "auto" } : undefined;
}

export function Hoja({
  titulo,
  subtitulo,
  ocupado = false,
  hayCambios = false,
  ancho = "md",
  alto = "auto",
  rol = "dialog",
  aviso,
  pie,
  onCerrar,
  children,
}: {
  titulo: string;
  /** Debajo del título, en gris chico: normalmente el nombre del ítem que se edita. */
  subtitulo?: string;
  ocupado?: boolean;
  hayCambios?: boolean;
  ancho?: keyof typeof ANCHOS;
  /** "completo": 92 % de la altura en el celular (formularios). "auto": lo que mida el contenido (confirmaciones). */
  alto?: "completo" | "auto";
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
  const area = useAreaVisible();

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
    <Contexto.Provider value={{ cerrar, hayCambios }}>
      <div
        className="fixed inset-x-0 bottom-0 top-0 z-50 flex items-end justify-center bg-[#244B5A]/45 sm:items-center sm:p-4"
        style={area}
        onClick={cerrar}
      >
        <div
          role={rol}
          aria-modal="true"
          aria-labelledby={`${id}-titulo`}
          className={`flex w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90%] sm:rounded-2xl ${
            alto === "completo" ? "h-[92%] sm:h-auto" : "max-h-[92%]"
          } ${ANCHOS[ancho]}`}
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#D9DFE3] px-5 py-3">
            <div className="min-w-0 pt-0.5">
              <h2 id={`${id}-titulo`} className="break-words text-xl font-bold leading-tight text-[#244B5A]">
                {titulo}
              </h2>
              {subtitulo && <p className="mt-1 break-words text-[13px] leading-snug text-[#4A5861]">{subtitulo}</p>}
            </div>
            <button
              type="button"
              onClick={cerrar}
              disabled={ocupado}
              aria-label="Cerrar ventana"
              className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl leading-none text-[#3E4A52] transition-colors hover:bg-[#EAF0F2] hover:text-[#1A3844] active:bg-[#D5E0E4] disabled:opacity-50"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>

          {(pie || aviso) && (
            <footer className="shrink-0 border-t border-[#D9DFE3] bg-white px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
              {aviso && !descartando && <div className="mb-2">{aviso}</div>}
              {descartando ? (
                <div role="alertdialog" aria-label="Cambios sin guardar" className="space-y-2">
                  <p className="text-base font-medium text-[#1F2A30]">Hay cambios sin guardar. ¿Los descartás?</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setDescartando(false)} className={botonDe("secundario", "min-h-12 flex-1 text-base")}>
                      Seguir editando
                    </button>
                    <button type="button" onClick={onCerrar} className={botonDe("peligro", "min-h-12 flex-1 text-base")}>
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

/**
 * El pie estándar de un formulario: Cancelar (secundario) y Guardar (primario), del mismo ancho, de 48 px.
 * Con `soloConCambios` (ediciones), Guardar queda deshabilitado —pero legible— mientras no se cambió nada.
 */
export function PieAcciones({
  formId,
  guardando = false,
  etiqueta,
  etiquetaGuardando = "Guardando...",
  etiquetaCancelar = "Cancelar",
  soloConCambios = false,
}: {
  /** El id del <form> del cuerpo: el botón Guardar está fuera del form, así que lo referencia. */
  formId: string;
  guardando?: boolean;
  etiqueta: string;
  etiquetaGuardando?: string;
  etiquetaCancelar?: string;
  soloConCambios?: boolean;
}) {
  const hoja = useHoja();
  const sinCambios = soloConCambios && !hoja?.hayCambios;
  return (
    <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-end">
      <button type="button" onClick={() => hoja?.cerrar()} disabled={guardando} className={botonDe("secundario", "min-h-12 text-base sm:min-w-32")}>
        {etiquetaCancelar}
      </button>
      <button
        type="submit"
        form={formId}
        disabled={guardando || sinCambios}
        title={sinCambios ? "No hay cambios para guardar" : undefined}
        className={botonDe("primario", "min-h-12 text-base sm:min-w-44")}
      >
        {guardando ? etiquetaGuardando : etiqueta}
      </button>
    </div>
  );
}
