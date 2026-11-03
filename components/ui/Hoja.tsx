"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent as EventoTeclado, type ReactNode } from "react";
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
 *
 * Es un diálogo de verdad para el teclado: al abrir, el foco entra a la hoja (o al campo con `autoFocus`), Tab no se
 * va al fondo, Escape cierra sólo la hoja de más arriba (una hoja puede abrir otra) y al cerrar el foco vuelve a donde estaba.
 */

const ANCHOS = { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-lg", xl: "sm:max-w-2xl" } as const;

interface ContextoHoja {
  /** Pide cerrar la hoja (respeta el aviso de cambios sin guardar). */
  cerrar: () => void;
  hayCambios: boolean;
}
const Contexto = createContext<ContextoHoja | null>(null);
export const useHoja = () => useContext(Contexto);

/** Las hojas abiertas, de abajo hacia arriba: Escape es sólo de la última. */
const hojasAbiertas: symbol[] = [];

const ENFOCABLES = 'a[href], button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])';

/**
 * La parte visible de la pantalla SÓLO mientras el teclado está abierto (iOS no achica el viewport de la página con el teclado).
 * Sin teclado devuelve `undefined` y la hoja ocupa la pantalla entera (`fixed` con `inset`). Antes se usaba `visualViewport` siempre:
 * en el iPhone, después de cerrar el teclado, ese alto quedaba viejo y la hoja (por ejemplo el detalle de un pedido) se veía cortada.
 */
function useAreaVisible(): CSSProperties | undefined {
  const [area, setArea] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const medir = () => {
      const activo = document.activeElement;
      const editando = activo instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(activo.tagName);
      const tecladoAbierto = editando && vv.height < window.innerHeight - 100;
      setArea(tecladoAbierto ? { top: vv.offsetTop, height: vv.height } : null);
    };
    // Al soltar el foco el teclado tarda en irse: se vuelve a medir cuando ya se fue.
    const alSoltar = () => {
      setTimeout(medir, 120);
      setTimeout(medir, 450);
    };
    medir();
    vv.addEventListener("resize", medir);
    vv.addEventListener("scroll", medir);
    document.addEventListener("focusin", medir);
    document.addEventListener("focusout", alSoltar);
    return () => {
      vv.removeEventListener("resize", medir);
      vv.removeEventListener("scroll", medir);
      document.removeEventListener("focusin", medir);
      document.removeEventListener("focusout", alSoltar);
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
  const panel = useRef<HTMLDivElement>(null);
  const propia = useRef(Symbol("hoja"));

  const cerrar = useCallback(() => {
    if (ocupado) return;
    if (hayCambios) setDescartando(true);
    else onCerrar();
  }, [ocupado, hayCambios, onCerrar]);

  useEffect(() => {
    const token = propia.current;
    hojasAbiertas.push(token);
    return () => {
      hojasAbiertas.splice(hojasAbiertas.indexOf(token), 1);
    };
  }, []);

  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if (e.key === "Escape" && hojasAbiertas[hojasAbiertas.length - 1] === propia.current) cerrar();
    }
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [cerrar]);

  // El foco entra a la hoja al abrir (salvo que un campo ya lo haya tomado con autoFocus) y vuelve al cerrar.
  useEffect(() => {
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!panel.current?.contains(document.activeElement)) panel.current?.focus({ preventScroll: true });
    return () => {
      if (previo?.isConnected) previo.focus({ preventScroll: true });
    };
  }, []);

  function encerrarTab(e: EventoTeclado<HTMLDivElement>) {
    const caja = panel.current;
    // Las teclas de una hoja o una lista abierta desde ésta también pasan por acá: se ocupan ellas.
    if (e.key !== "Tab" || !caja || (e.target as HTMLElement).closest('[role="dialog"], [role="alertdialog"]') !== caja) return;
    const enfocables = [...caja.querySelectorAll<HTMLElement>(ENFOCABLES)].filter((el) => el.offsetParent !== null);
    if (enfocables.length === 0) {
      e.preventDefault();
      return;
    }
    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    if (e.shiftKey && (document.activeElement === primero || document.activeElement === caja)) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  }

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
          ref={panel}
          role={rol}
          aria-modal="true"
          aria-labelledby={`${id}-titulo`}
          tabIndex={-1}
          onKeyDown={encerrarTab}
          className={`flex w-full flex-col overflow-hidden rounded-t-2xl bg-[#FFFFFF] shadow-2xl outline-none sm:max-h-[90%] sm:rounded-2xl ${
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
            <footer className="shrink-0 border-t border-[#D9DFE3] bg-[#FFFFFF] px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
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
  onGuardar,
  deshabilitado = false,
}: {
  /** El id del <form> del cuerpo: el botón Guardar está fuera del form, así que lo referencia. */
  formId?: string;
  /** Sin formulario: lo que hace el botón principal. */
  onGuardar?: () => void;
  deshabilitado?: boolean;
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
        type={onGuardar ? "button" : "submit"}
        form={onGuardar ? undefined : formId}
        onClick={onGuardar}
        disabled={guardando || sinCambios || deshabilitado}
        title={sinCambios ? "No hay cambios para guardar" : undefined}
        className={botonDe("primario", "min-h-12 text-base sm:min-w-44")}
      >
        {guardando ? etiquetaGuardando : etiqueta}
      </button>
    </div>
  );
}
