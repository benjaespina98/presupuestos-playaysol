"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * La barra de búsqueda y filtros COMPACTA de todas las listas del portal (Precios de venta, Materiales,
 * Proveedores, Pedidos, Historial):
 *
 *  - Escritorio: UNA sola fila de 64 px (buscador · chips en una fila con scroll · menús de stock y orden ·
 *    botón "Filtros" con contador). Queda fija arriba al bajar por la página (la lista usa el scroll de la
 *    página, no uno propio).
 *  - Celular: a lo sumo dos filas (96 px): buscador y "Filtros", y debajo una fila que se desliza con los
 *    menús y los chips.
 *
 * Publica su alto en `--catalogo-barra` para que el encabezado de la tabla se pegue justo debajo.
 */
export function BarraListado({
  buscador,
  chips,
  menus,
  filtros,
}: {
  buscador: ReactNode;
  /** Chips de categoría (una sola fila). */
  chips?: ReactNode;
  /** Menús: stock, orden... */
  menus?: ReactNode;
  /** El botón "Filtros" con su panel. */
  filtros?: ReactNode;
}) {
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

  const hayFila2 = !!(chips || menus);
  return (
    <div
      ref={ref}
      data-barra-listado=""
      className="flex flex-col gap-1 pb-0.5 lg:sticky lg:top-0 lg:z-20 lg:-mx-4 lg:h-16 lg:flex-row lg:items-center lg:gap-2 lg:bg-gray-50 lg:px-4 lg:pb-0"
    >
      <div className="flex items-center gap-2 lg:contents">
        <div className="min-w-0 flex-1 lg:order-1 lg:w-72 lg:flex-none">{buscador}</div>
        {filtros && <div className="shrink-0 lg:order-4">{filtros}</div>}
      </div>
      {hayFila2 && (
        <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [mask-image:linear-gradient(to_right,#000_calc(100%-28px),transparent)] lg:contents lg:[mask-image:none] [&::-webkit-scrollbar]:hidden">
          {menus && <div className="flex shrink-0 items-center gap-2 lg:order-3">{menus}</div>}
          {chips && <div className="min-w-0 lg:order-2 lg:flex-1">{chips}</div>}
        </div>
      )}
    </div>
  );
}

/** Una fila de chips con scroll horizontal suave y degradé en los bordes. Nunca se parte en dos filas. */
export function ChipsFila({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={etiqueta}
      className="flex min-w-0 items-center gap-2 overflow-x-auto scroll-smooth px-3 [scrollbar-width:none] lg:[mask-image:linear-gradient(to_right,transparent,#000_12px,#000_calc(100%-24px),transparent)] [&::-webkit-scrollbar]:hidden"
    >
      {children}
    </div>
  );
}

export function Chip({
  activo,
  onClick,
  cantidad,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  cantidad: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B5A]/40 ${
        activo
          ? "border-[#244B5A] bg-[#244B5A] text-[#FFFFFF] shadow-sm"
          : "border-[#7D8892] bg-[#FFFFFF] text-[#1F2A30] hover:border-[#244B5A] hover:bg-[#EAF0F2] active:bg-[#D5E0E4]"
      }`}
    >
      {children}
      <span className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${activo ? "bg-[#FFFFFF]/20 text-[#FFFFFF]" : "bg-[#E3ECEF] text-[#3E4A52]"}`}>{cantidad}</span>
    </button>
  );
}

/** Interruptor accesible: un checkbox real (por eso se prueba con su label) con el aspecto de un switch. */
export function Interruptor({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-[#1F2A30]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className="relative h-5 w-9 shrink-0 rounded-full bg-[#7D8892] transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-[#244B5A] peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-[#244B5A]/40"
      />
      {children}
    </label>
  );
}

const CLASE_DISPARADOR =
  "relative inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B5A]/40";
const CLASE_INACTIVO = "border-[#7D8892] bg-[#FFFFFF] text-[#1F2A30] hover:border-[#244B5A] hover:bg-[#EAF0F2] active:bg-[#D5E0E4]";
const CLASE_ACTIVO = "border-[#244B5A] bg-[#E3ECEF] text-[#1A3844] hover:bg-[#D3E1E6] active:bg-[#C2D4DB]";

/**
 * Un panel que se abre desde un botón. Se dibuja en el <body> (ningún `overflow` de la barra lo recorta); en
 * escritorio queda pegado al botón, en el celular sube como una hoja desde abajo. Se cierra tocando afuera o con Escape.
 */
function Desplegable({
  etiqueta,
  boton,
  activo,
  ancho = "w-72",
  children,
}: {
  etiqueta: string;
  boton: ReactNode;
  activo: boolean;
  ancho?: string;
  children: (cerrar: () => void) => ReactNode;
}) {
  const id = useId();
  const disparador = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | "hoja" | null>(null);

  const cerrar = useCallback(() => setPos(null), []);
  const estabaAbierto = useRef(false);

  // Al cerrar, el foco vuelve al botón que abrió el panel.
  useEffect(() => {
    if (pos) estabaAbierto.current = true;
    else if (estabaAbierto.current) {
      estabaAbierto.current = false;
      disparador.current?.focus({ preventScroll: true });
    }
  }, [pos]);

  function abrir() {
    const r = disparador.current?.getBoundingClientRect();
    if (!r) return;
    if (window.innerWidth < 1024) return setPos("hoja");
    const ancho = 320;
    setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.right - ancho, window.innerWidth - ancho - 8)) });
  }

  useEffect(() => {
    if (!pos) return;
    const alTocar = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !disparador.current?.contains(e.target as Node)) setPos(null);
    };
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    document.addEventListener("mousedown", alTocar);
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("mousedown", alTocar);
      document.removeEventListener("keydown", alTeclear);
    };
  }, [pos, cerrar]);

  return (
    <>
      <button
        ref={disparador}
        type="button"
        aria-label={etiqueta}
        aria-haspopup="dialog"
        aria-expanded={pos !== null}
        aria-controls={pos ? `${id}-panel` : undefined}
        onClick={() => (pos ? cerrar() : abrir())}
        className={`${CLASE_DISPARADOR} ${activo || pos ? CLASE_ACTIVO : CLASE_INACTIVO}`}
      >
        {boton}
      </button>
      {pos &&
        createPortal(
          <>
            {pos === "hoja" && <div aria-hidden="true" className="fixed inset-0 z-[55] bg-[#244B5A]/45" onClick={cerrar} />}
            <div
              ref={panel}
              id={`${id}-panel`}
              role="dialog"
              aria-label={etiqueta}
              style={pos === "hoja" ? undefined : { position: "fixed", top: pos.top, left: pos.left }}
              className={
                pos === "hoja"
                  ? "fixed inset-x-0 bottom-0 z-[60] max-h-[80dvh] overflow-y-auto rounded-t-2xl bg-white p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl"
                  : `z-[60] ${ancho} overflow-hidden rounded-xl border border-[#D9DFE3] bg-white p-1.5 shadow-xl`
              }
            >
              {pos === "hoja" && <p className="px-3 pb-1 pt-2 text-lg font-bold text-[#244B5A]">{etiqueta}</p>}
              {children(cerrar)}
            </div>
          </>,
          document.body
        )}
    </>
  );
}

export interface OpcionMenu<T extends string> {
  id: T;
  etiqueta: string;
  cantidad?: number;
  /** "aviso" = el mismo color de la marca de stock negativo. */
  tono?: "aviso";
  descripcion?: string;
}

/**
 * Un menú de opciones únicas (stock, orden), con contadores. El botón dice el título y la opción actual; si no
 * es la de por defecto, se marca. Opciones de 48 px, la actual con tilde.
 */
export function MenuSeleccion<T extends string>({
  etiqueta,
  titulo,
  opciones,
  valor,
  porDefecto,
  onCambio,
  textoBoton,
  buscable = false,
}: {
  etiqueta: string;
  titulo: string;
  opciones: readonly OpcionMenu<T>[];
  valor: T;
  porDefecto: T;
  onCambio: (v: T) => void;
  /** Lo que dice el botón (por defecto: "<titulo>: <opción>"). */
  textoBoton?: string;
  /** Con muchas opciones, un buscador arriba de la lista. */
  buscable?: boolean;
}) {
  const actual = opciones.find((o) => o.id === valor);
  const [q, setQ] = useState("");
  const visibles = q.trim() ? opciones.filter((o) => o.etiqueta.toLowerCase().includes(q.trim().toLowerCase())) : opciones;
  return (
    <Desplegable
      etiqueta={etiqueta}
      activo={valor !== porDefecto}
      boton={
        <>
          <span>{textoBoton ?? `${titulo}: ${actual?.etiqueta ?? ""}`}</span>
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
          </svg>
        </>
      }
    >
      {(cerrar) => (
        <div role="radiogroup" aria-label={etiqueta} className="max-h-[60dvh] overflow-y-auto">
          {buscable && (
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar…"
              aria-label={`Buscar en ${titulo}`}
              className="mb-1 min-h-12 w-full rounded-lg border bg-white px-3 text-base"
            />
          )}
          {visibles.map((o) => {
            const marcada = o.id === valor;
            const vacia = o.cantidad === 0 && !marcada;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={marcada}
                onClick={() => {
                  onCambio(o.id);
                  cerrar();
                }}
                className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-1.5 text-left hover:bg-[#EAF0F2] active:bg-[#D5E0E4] ${marcada ? "bg-[#F1F6F8]" : ""}`}
              >
                <span className="min-w-0 flex-1">
                  <span className={`block text-base ${marcada ? "font-semibold" : "font-medium"} ${o.tono === "aviso" ? "text-[#B42318]" : "text-[#1F2A30]"} ${vacia ? "opacity-80" : ""}`}>
                    {o.tono === "aviso" && <span aria-hidden="true">⚠ </span>}
                    {o.etiqueta}
                  </span>
                  {o.descripcion && <span className="block text-[13px] leading-snug text-[#4A5861]">{o.descripcion}</span>}
                </span>
                {o.cantidad !== undefined && (
                  <span className={`rounded-full px-2 py-0.5 text-[13px] tabular-nums ${o.tono === "aviso" ? "bg-[#FEF3F2] text-[#B42318]" : "bg-[#E3ECEF] text-[#3E4A52]"}`}>{o.cantidad}</span>
                )}
                <span aria-hidden="true" className={`w-5 text-lg text-[#244B5A] ${marcada ? "" : "invisible"}`}>
                  ✓
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Desplegable>
  );
}

/** El botón "Filtros" con la cantidad de filtros activos; abre un panel con los interruptores y "Limpiar filtros". */
export function BotonFiltros({
  contador,
  hayFiltros,
  onLimpiar,
  children,
}: {
  contador: number;
  hayFiltros: boolean;
  onLimpiar: () => void;
  children?: ReactNode;
}) {
  return (
    <Desplegable
      etiqueta="Filtros"
      activo={contador > 0}
      ancho="w-80"
      boton={
        <>
          Filtros
          {contador > 0 && (
            <span className="rounded-full bg-[#244B5A] px-1.5 py-0.5 text-xs font-bold leading-none text-[#FFFFFF] tabular-nums" aria-label={`${contador} activos`}>
              {contador}
            </span>
          )}
        </>
      }
    >
      {(cerrar) => (
        <div className="space-y-1 px-2 py-1">
          {children}
          {hayFiltros && (
            <button
              type="button"
              onClick={() => {
                onLimpiar();
                cerrar();
              }}
              className="mt-1 flex min-h-12 w-full items-center justify-center rounded-lg border border-[#244B5A] bg-[#FFFFFF] px-3 text-base font-semibold text-[#1A3844] hover:bg-[#EAF0F2] active:bg-[#D5E0E4] sm:text-sm"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}
    </Desplegable>
  );
}

/** Aviso breve de "se guardó": aparece abajo, se va solo y no mueve la lista. */
export function Toast({ mensaje, onCerrar, tipo = "ok" }: { mensaje: string | null; onCerrar: () => void; tipo?: "ok" | "aviso" }) {
  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(onCerrar, 5000);
    return () => clearTimeout(t);
  }, [mensaje, onCerrar]);
  if (!mensaje) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4 pb-[env(safe-area-inset-bottom)]" data-print-hide="">
      <p
        role="status"
        className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-xl ${
          tipo === "ok" ? "bg-[#1F5F3A] text-[#FFFFFF]" : "bg-[#7A3E00] text-[#FFFFFF]"
        }`}
      >
        <span className="min-w-0 break-words">{mensaje}</span>
        <button type="button" onClick={onCerrar} aria-label="Cerrar aviso" className="-my-2 -mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg hover:bg-white/15 active:bg-white/25">
          <span aria-hidden="true">✕</span>
        </button>
      </p>
    </div>
  );
}
