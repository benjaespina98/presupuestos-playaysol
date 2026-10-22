"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Hoja } from "@/components/ui/Hoja";
import { botonDe } from "@/components/ui/botones";
import { Buscador } from "@/components/ui/FiltrosPlegables";
import { Desplegable, Interruptor, MenuSeleccion, type OpcionMenu } from "@/components/ui/BarraListado";
import { IconPlus } from "@/components/icons";
import { etiquetaCortaDeOrden, type ClaveOrden } from "@/lib/ordenar";
import { useEsAncho, useEsEscritorio } from "@/lib/useMediaQuery";

/**
 * LA barra de herramientas de todas las listas del portal (Precios, Materiales, Proveedores, Pedidos, Historial).
 * Una sola pieza, con dos presentaciones que comparten los mismos nombres y conceptos:
 *
 *  - Celular (hasta 767 px): UNA fila de 56 px: [buscador] [Filtros (con contador)] [+ de 44×44]. TODOS los filtros
 *    (categoría, proveedor, stock, orden e interruptores) viven en una hoja inferior de 92 % de la altura, con
 *    encabezado fijo, pie fijo ("Limpiar" y "Ver N resultados") y los cambios aplicados en vivo. Los filtros
 *    activos se ven debajo de la barra como chips chicos que hacen salto de línea, cada uno con su "×".
 *  - Escritorio (768 px o más): UNA fila de 64 px: buscador, un menú por filtro (con contadores), orden,
 *    "Más filtros" y "Agregar" a la derecha. (Los chips no caben junto al resto de la barra: siempre son menús.)
 *
 * La barra queda fija arriba al bajar (la lista usa el scroll de la página) y publica su alto en
 * `--catalogo-barra`, para que los encabezados de la lista se peguen justo debajo.
 */

export interface SeccionFiltro {
  id: string;
  /** "Categoría", "Proveedor", "Stock"... */
  titulo: string;
  /** Una opción por valor; la de "sin filtro" va primera (su id es `valorTodos`). */
  opciones: readonly OpcionMenu<string>[];
  valor: string;
  /** El valor de "sin filtro" (por defecto, el texto vacío). */
  valorTodos?: string;
  onCambio: (v: string) => void;
  /** Con muchas opciones, un buscador arriba de la lista (por defecto, desde 9). */
  buscable?: boolean;
}

export interface InterruptorFiltro {
  id: string;
  etiqueta: string;
  valor: boolean;
  onCambio: (v: boolean) => void;
}

export interface OrdenFiltro {
  opciones: readonly { id: ClaveOrden; etiqueta: string }[];
  valor: ClaveOrden;
  onCambio: (v: ClaveOrden) => void;
  /** Cómo se llama el campo en esta pantalla (por defecto, el de `etiquetaCortaDeOrden`). */
  etiquetaCorta?: (v: ClaveOrden) => string;
}

export interface AccionAgregar {
  /** "Agregar material": el nombre accesible, también en el botón "+" del celular. */
  etiqueta: string;
  /** Lo que dice el botón en escritorio (por defecto, "Agregar"). */
  texto?: string;
  onClick?: () => void;
  href?: string;
}

export interface AccionSecundaria {
  etiqueta: string;
  /** El texto corto del botón en la barra ancha (por defecto, `etiqueta`). */
  texto?: string;
  href: string;
  icono?: ReactNode;
}

export interface PropsBarraHerramientas {
  buscador: { valor: string; onCambio: (v: string) => void; placeholder: string; etiqueta: string };
  secciones?: readonly SeccionFiltro[];
  interruptores?: readonly InterruptorFiltro[];
  orden?: OrdenFiltro;
  agregar?: AccionAgregar;
  acciones?: readonly AccionSecundaria[];
  /** Cuántos resultados da la lista con los filtros de ahora ("Ver N resultados"). */
  resultados: number;
  /** "54 materiales" o "12 de 65 ítems"; vacío mientras carga. */
  contador?: ReactNode;
  /** Un dato a la derecha del contador (sólo en pantallas anchas). */
  contadorDerecha?: ReactNode;
  /** Hay algo para limpiar: búsqueda, filtros u orden. */
  hayFiltros: boolean;
  onLimpiar: () => void;
}

const IconFiltro = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path d="M3 4a1 1 0 0 1 1-1h12a1 1 0 0 1 .78 1.63L12 10.6V16a1 1 0 0 1-1.45.9l-2-1A1 1 0 0 1 8 15v-4.4L3.22 4.63A1 1 0 0 1 3 4z" />
  </svg>
);

const IconChevron = () => (
  <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
  </svg>
);

const etiquetaDe = (s: SeccionFiltro) => s.opciones.find((o) => o.id === s.valor)?.etiqueta ?? s.valor;
const sinFiltro = (s: SeccionFiltro) => s.valor === (s.valorTodos ?? "");

interface FiltroActivo {
  id: string;
  texto: string;
  quitar: () => void;
}

function filtrosActivos({ secciones = [], interruptores = [], orden }: Pick<PropsBarraHerramientas, "secciones" | "interruptores" | "orden">): FiltroActivo[] {
  return [
    ...secciones.filter((s) => !sinFiltro(s)).map((s) => ({ id: s.id, texto: `${s.titulo}: ${etiquetaDe(s)}`, quitar: () => s.onCambio(s.valorTodos ?? "") })),
    ...interruptores.filter((i) => i.valor).map((i) => ({ id: i.id, texto: i.etiqueta, quitar: () => i.onCambio(false) })),
    ...(orden && orden.valor !== "defecto"
      ? [{ id: "orden", texto: `Orden: ${(orden.etiquetaCorta ?? etiquetaCortaDeOrden)(orden.valor)}`, quitar: () => orden.onCambio("defecto") }]
      : []),
  ];
}

export function BarraHerramientas(props: PropsBarraHerramientas) {
  const { contador, contadorDerecha } = props;
  const escritorio = useEsEscritorio();
  const ref = useRef<HTMLDivElement>(null);

  // Publica el alto de la barra: los encabezados de la lista se pegan justo debajo.
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

  const activos = filtrosActivos(props);

  // "contents": la barra pegada se apoya en la columna de la pantalla (si no, sólo se pegaría dentro de este bloque).
  return (
    <div data-barra-listado="" className="contents">
      <div
        ref={ref}
        data-barra-herramientas=""
        className="sticky top-0 z-30 -mx-4 flex h-14 items-center gap-2 border-b border-[#D9DFE3] bg-gray-50 px-4 md:h-16"
      >
        {escritorio === null ? null : escritorio ? (
          <FilaEscritorio {...props} />
        ) : (
          <FilaCelular {...props} activos={activos} />
        )}
      </div>

      {escritorio === false && <ChipsActivos activos={activos} />}

      {(contador || contadorDerecha) && (
        <p className="flex flex-wrap items-baseline justify-between gap-x-4 py-1.5 text-[13px] text-[#4A5861]" aria-live="polite">
          <span>{contador}</span>
          {contadorDerecha && <span className="hidden sm:inline">{contadorDerecha}</span>}
        </p>
      )}
    </div>
  );
}

/** El botón "+" (celular) o "Agregar" (escritorio). */
function BotonAgregar({ agregar, compacto }: { agregar: AccionAgregar; compacto: boolean }) {
  const clase = compacto ? botonDe("primario", "h-11 w-11 shrink-0 px-0") : botonDe("primario", "shrink-0 px-4");
  const contenido = (
    <>
      <IconPlus className="h-5 w-5" />
      {!compacto && <span>{agregar.texto ?? "Agregar"}</span>}
    </>
  );
  if (agregar.href)
    return (
      <Link href={agregar.href} aria-label={agregar.etiqueta} className={clase}>
        {contenido}
      </Link>
    );
  return (
    <button type="button" onClick={agregar.onClick} aria-label={agregar.etiqueta} className={clase}>
      {contenido}
    </button>
  );
}

// ── Celular ─────────────────────────────────────────────────────────────────────────────────────

function FilaCelular({ buscador, agregar, activos, ...resto }: PropsBarraHerramientas & { activos: FiltroActivo[] }) {
  const [abierta, setAbierta] = useState(false);
  const cerrar = useCallback(() => setAbierta(false), []);
  const hayAlgoParaFiltrar = !!(resto.secciones?.length || resto.interruptores?.length || resto.orden);
  return (
    <>
      <div className="min-w-0 flex-1">
        <Buscador valor={buscador.valor} onCambio={buscador.onCambio} placeholder={buscador.placeholder} etiqueta={buscador.etiqueta} />
      </div>
      {hayAlgoParaFiltrar && (
        <button
          type="button"
          onClick={() => setAbierta(true)}
          aria-haspopup="dialog"
          aria-label={activos.length ? `Filtros, ${activos.length} ${activos.length === 1 ? "activo" : "activos"}` : "Filtros"}
          className={botonDe(activos.length ? "suave" : "secundario", "relative shrink-0 gap-1.5 px-3")}
        >
          <IconFiltro />
          <span>Filtros</span>
          {activos.length > 0 && (
            <span aria-hidden="true" className="rounded-full bg-[#244B5A] px-1.5 py-0.5 text-xs font-bold leading-none text-[#FFFFFF] tabular-nums">
              {activos.length}
            </span>
          )}
        </button>
      )}
      {agregar && <BotonAgregar agregar={agregar} compacto />}
      {abierta && typeof document !== "undefined" && createPortal(<HojaFiltros {...resto} buscador={buscador} activos={activos} onCerrar={cerrar} />, document.body)}
    </>
  );
}

/** La hoja de filtros: encabezado fijo, un acordeón por filtro (las opciones de 48 px), interruptores y pie fijo. */
function HojaFiltros({
  secciones = [],
  interruptores = [],
  orden,
  acciones = [],
  resultados,
  hayFiltros,
  onLimpiar,
  activos,
  onCerrar,
}: PropsBarraHerramientas & { activos: FiltroActivo[]; onCerrar: () => void }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const id = useId();
  return (
    <Hoja
      titulo="Filtros"
      alto="completo"
      onCerrar={onCerrar}
      pie={
        <div className="grid grid-cols-[minmax(6.5rem,0.55fr)_1fr] gap-3">
          <button type="button" onClick={onLimpiar} disabled={!hayFiltros && activos.length === 0} className={botonDe("secundario", "min-h-12 text-base")}>
            Limpiar
          </button>
          <button type="button" onClick={onCerrar} className={botonDe("primario", "min-h-12 text-base")}>
            Ver {resultados} {resultados === 1 ? "resultado" : "resultados"}
          </button>
        </div>
      }
    >
      <div className="-my-1 divide-y divide-[#E3E8EB]">
        {secciones.map((s) => (
          <Acordeon
            key={s.id}
            id={`${id}-${s.id}`}
            titulo={s.titulo}
            resumen={etiquetaDe(s)}
            activo={!sinFiltro(s)}
            abierto={abierto === s.id}
            onAlternar={() => setAbierto(abierto === s.id ? null : s.id)}
          >
            <OpcionesUnicas
              etiqueta={s.titulo}
              opciones={s.opciones}
              valor={s.valor}
              onElegir={(v) => {
                s.onCambio(v);
                setAbierto(null);
              }}
            />
          </Acordeon>
        ))}
        {orden && (
          <Acordeon
            id={`${id}-orden`}
            titulo="Orden"
            resumen={orden.opciones.find((o) => o.id === orden.valor)?.etiqueta ?? ""}
            activo={orden.valor !== "defecto"}
            abierto={abierto === "orden"}
            onAlternar={() => setAbierto(abierto === "orden" ? null : "orden")}
          >
            <OpcionesUnicas
              etiqueta="Orden"
              opciones={orden.opciones}
              valor={orden.valor}
              onElegir={(v) => {
                orden.onCambio(v as ClaveOrden);
                setAbierto(null);
              }}
            />
          </Acordeon>
        )}
        {interruptores.length > 0 && (
          <div className="py-1">
            {interruptores.map((i) => (
              <Interruptor key={i.id} checked={i.valor} onChange={i.onCambio}>
                {i.etiqueta}
              </Interruptor>
            ))}
          </div>
        )}
        {acciones.map((a) => (
          <a key={a.href} href={a.href} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center gap-2 py-1 text-base font-semibold text-[#1A3844] underline underline-offset-2">
            {a.icono}
            {a.etiqueta}
          </a>
        ))}
      </div>
    </Hoja>
  );
}

function Acordeon({
  id,
  titulo,
  resumen,
  activo,
  abierto,
  onAlternar,
  children,
}: {
  id: string;
  titulo: string;
  resumen: string;
  activo: boolean;
  abierto: boolean;
  onAlternar: () => void;
  children: ReactNode;
}) {
  return (
    <section>
      <button
        type="button"
        id={`${id}-boton`}
        aria-expanded={abierto}
        aria-controls={`${id}-lista`}
        onClick={onAlternar}
        className="flex min-h-12 w-full items-center justify-between gap-3 py-1 text-left hover:bg-[#F4F8F9] active:bg-[#EAF0F2]"
      >
        <span className="text-base font-semibold text-[#1F2A30]">{titulo}</span>
        <span className={`flex min-w-0 items-center gap-1.5 text-base ${activo ? "font-semibold text-[#244B5A]" : "text-[#4A5861]"}`}>
          <span className="truncate">{resumen}</span>
          <span className={abierto ? "rotate-180" : ""}>
            <IconChevron />
          </span>
        </span>
      </button>
      {abierto && (
        <div id={`${id}-lista`} className="pb-2">
          {children}
        </div>
      )}
    </section>
  );
}

function OpcionesUnicas({
  etiqueta,
  opciones,
  valor,
  onElegir,
}: {
  etiqueta: string;
  opciones: readonly { id: string; etiqueta: string; cantidad?: number; descripcion?: string; tono?: "aviso" }[];
  valor: string;
  onElegir: (v: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta}>
      {opciones.map((o) => {
        const marcada = o.id === valor;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={marcada}
            onClick={() => onElegir(o.id)}
            className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-1.5 text-left hover:bg-[#EAF0F2] active:bg-[#D5E0E4] ${marcada ? "bg-[#F1F6F8]" : ""}`}
          >
            <span className="min-w-0 flex-1">
              <span className={`block text-base ${marcada ? "font-semibold" : "font-medium"} ${o.tono === "aviso" ? "text-[#B42318]" : "text-[#1F2A30]"}`}>
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
  );
}

/** Los filtros activos, debajo de la barra: chips chicos que hacen salto de línea, cada uno con su "×". Sólo existen si hay filtros. */
function ChipsActivos({ activos }: { activos: FiltroActivo[] }) {
  if (activos.length === 0) return null;
  return (
    <ul aria-label="Filtros activos" className="flex flex-wrap gap-x-1.5 gap-y-2 pb-1 pt-2">
      {activos.map((a) => (
        <li key={a.id} className="max-w-full">
          <button
            type="button"
            onClick={a.quitar}
            aria-label={`Quitar filtro: ${a.texto}`}
            className="relative inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-[#244B5A] bg-[#E3ECEF] pl-3 pr-2.5 text-[13px] font-medium text-[#1A3844] after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] hover:bg-[#D3E1E6] active:bg-[#C2D4DB]"
          >
            <span className="truncate">{a.texto}</span>
            <span aria-hidden="true" className="text-base leading-none">
              ×
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ── Escritorio ──────────────────────────────────────────────────────────────────────────────────

function FilaEscritorio({ buscador, secciones = [], interruptores = [], orden, agregar, acciones = [], hayFiltros, onLimpiar }: PropsBarraHerramientas) {
  const ancho = useEsAncho();
  const activosInterruptores = interruptores.filter((i) => i.valor).length;
  const masActivos = activosInterruptores;
  return (
    <>
      <div className="w-52 shrink-0 lg:w-72">
        <Buscador valor={buscador.valor} onCambio={buscador.onCambio} placeholder={buscador.placeholder} etiqueta={buscador.etiqueta} />
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {secciones.map((s) => (
          <MenuSeleccion
            key={s.id}
            etiqueta={`Filtrar por ${s.titulo.toLowerCase()}`}
            titulo={s.titulo}
            opciones={s.opciones}
            valor={s.valor}
            porDefecto={s.valorTodos ?? ""}
            onCambio={s.onCambio}
            buscable={s.buscable ?? s.opciones.length > 8}
            textoBoton={sinFiltro(s) ? s.titulo : `${s.titulo}: ${etiquetaDe(s)}`}
          />
        ))}
        {orden && (
          <MenuSeleccion
            etiqueta="Ordenar"
            titulo="Orden"
            opciones={orden.opciones}
            valor={orden.valor}
            porDefecto="defecto"
            onCambio={orden.onCambio}
            textoBoton={(orden.etiquetaCorta ?? etiquetaCortaDeOrden)(orden.valor)}
          />
        )}
        {(interruptores.length > 0 || (!ancho && acciones.length > 0)) && (
          <Desplegable
            etiqueta="Más filtros"
            activo={masActivos > 0}
            ancho="w-80"
            boton={
              <>
                <span>Más filtros</span>
                {masActivos > 0 && (
                  <span aria-hidden="true" className="rounded-full bg-[#244B5A] px-1.5 py-0.5 text-xs font-bold leading-none text-[#FFFFFF] tabular-nums">
                    {masActivos}
                  </span>
                )}
              </>
            }
          >
            {(cerrar) => (
              <div className="space-y-1 px-2 py-1">
                {interruptores.map((i) => (
                  <Interruptor key={i.id} checked={i.valor} onChange={i.onCambio}>
                    {i.etiqueta}
                  </Interruptor>
                ))}
                {!ancho &&
                  acciones.map((a) => (
                    <a key={a.href} href={a.href} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-2 text-sm font-semibold text-[#1A3844] underline underline-offset-2">
                      {a.icono}
                      {a.etiqueta}
                    </a>
                  ))}
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
        )}
        {hayFiltros && interruptores.length === 0 && (
          <button type="button" onClick={onLimpiar} className="min-h-11 shrink-0 whitespace-nowrap rounded-lg px-2 text-sm font-semibold text-[#1A3844] underline underline-offset-2 hover:bg-[#EAF0F2]">
            Limpiar filtros
          </button>
        )}
      </div>
      {ancho &&
        acciones.map((a) => (
          <a key={a.href} href={a.href} target="_blank" rel="noopener noreferrer" aria-label={a.etiqueta} className={botonDe("secundario", "shrink-0 px-4")}>
            {a.icono}
            {a.texto ?? a.etiqueta}
          </a>
        ))}
      {agregar && <BotonAgregar agregar={agregar} compacto={false} />}
    </>
  );
}
