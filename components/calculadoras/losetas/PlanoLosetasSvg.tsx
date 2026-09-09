"use client";

import { useRef, useState } from "react";
import type { GeometriaPlano, LuzPos, Prim, TipoArrastrable } from "@/lib/domain/plano/losetas";

/**
 * Renderiza la geometría calculada por `calcularGeometriaPlano` como JSX de
 * `<svg>` — nunca como HTML armado a mano ni por `dangerouslySetInnerHTML`.
 * El estado (posición de cada objeto arrastrable) vive en el formulario del
 * componente padre; este componente sólo pinta lo que recibe y, si es
 * interactivo, avisa hacia arriba cuándo el usuario arrastró uno.
 *
 * El arrastre se captura sobre el propio `<svg>` (no sobre cada círculo)
 * porque cada movimiento vuelve a renderizar todo el árbol de primitivas: el
 * círculo original puede dejar de existir en ese frame, pero el puntero
 * sigue capturado por el `<svg>`, así que el gesto no se corta a mitad de
 * camino. Mismo criterio que `initLuzDrag` en el legacy.
 */
type Arrastre = { tipo: TipoArrastrable; indice: number };

/** Un callback `(indice, pos) => void` por tipo de objeto arrastrable — la
 *  escalera libre es la excepción (un solo objeto, `indice` siempre 0), así
 *  que su callback no lo recibe. */
export function PlanoLosetasSvg({
  geometria,
  interactive,
  onMoverLuz,
  onMoverEscalera,
  onMoverSkimmer,
  onMoverHidromasaje,
  ariaLabel,
}: {
  geometria: GeometriaPlano;
  interactive: boolean;
  onMoverLuz?: (indice: number, pos: LuzPos) => void;
  onMoverEscalera?: (pos: LuzPos) => void;
  onMoverSkimmer?: (indice: number, pos: LuzPos) => void;
  onMoverHidromasaje?: (indice: number, pos: LuzPos) => void;
  ariaLabel?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [arrastrando, setArrastrando] = useState<Arrastre | null>(null);

  function normalizar(clientX: number, clientY: number): LuzPos | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    // El <svg> se dibuja a width:100% sin alto propio, así que su alto en
    // pantalla sigue siempre la proporción del viewBox: no hay "letterboxing"
    // que compensar y una escala uniforme alcanza (a diferencia de un
    // preserveAspectRatio con relación de aspecto distinta a la del contenedor).
    const escala = geometria.viewW / rect.width;
    const x = (clientX - rect.left) * escala;
    const y = (clientY - rect.top) * escala;
    const { pool } = geometria;
    if (pool.w <= 0 || pool.h <= 0) return null;
    return {
      x: Math.max(0, Math.min(1, (x - pool.x) / pool.w)),
      y: Math.max(0, Math.min(1, (y - pool.y) / pool.h)),
    };
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!interactive) return;
    const el = e.target as Element;
    const handle = el.closest?.("[data-drag]");
    if (!handle) return;
    const [tipo, indiceStr] = handle.getAttribute("data-drag")!.split(":");
    setArrastrando({ tipo: tipo as TipoArrastrable, indice: Number(indiceStr) });
    try {
      svgRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* algunos entornos de test no implementan pointer capture */
    }
    e.preventDefault();
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (arrastrando === null) return;
    const pos = normalizar(e.clientX, e.clientY);
    if (!pos) return;
    e.preventDefault();
    const { tipo, indice } = arrastrando;
    if (tipo === "luz") onMoverLuz?.(indice, pos);
    else if (tipo === "escalera") onMoverEscalera?.(pos);
    else if (tipo === "skimmer") onMoverSkimmer?.(indice, pos);
    else onMoverHidromasaje?.(indice, pos);
  }

  function terminarArrastre(e: React.PointerEvent<SVGSVGElement>) {
    if (arrastrando === null) return;
    setArrastrando(null);
    try {
      svgRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* idem */
    }
  }

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={ariaLabel ?? "Plano de la piscina"}
      width="100%"
      viewBox={`0 0 ${geometria.viewW} ${geometria.svgH}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={terminarArrastre}
      onPointerCancel={terminarArrastre}
      className={interactive ? "pys-plano-editor" : undefined}
    >
      <defs>
        <linearGradient id="poolGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={geometria.colores.aguaTop} />
          <stop offset="1" stopColor={geometria.colores.aguaBottom} />
        </linearGradient>
        <radialGradient id="luzGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFF6CE" stopOpacity={0.95} />
          <stop offset="0.55" stopColor="#FFE08A" stopOpacity={0.5} />
          <stop offset="1" stopColor="#FFE08A" stopOpacity={0} />
        </radialGradient>
      </defs>

      <PrimSvg p={geometria.fondo} />
      {geometria.grid.map((p, i) => (
        <PrimSvg key={`grid-${i}`} p={p} />
      ))}
      <rect x={geometria.pool.x} y={geometria.pool.y} width={geometria.pool.w} height={geometria.pool.h} rx={4} fill="url(#poolGrad)" stroke="#1B3A5C" strokeWidth={1} />
      <rect
        x={geometria.pool.x + 2}
        y={geometria.pool.y + 2}
        width={Math.max(0, geometria.pool.w - 4)}
        height={Math.max(0, geometria.pool.h - 4)}
        rx={3}
        fill="none"
        stroke="#ffffff"
        strokeWidth={1}
        opacity={0.35}
      />
      {/* Sólo lo decorativo acá — las manijas de arrastre (`p.drag`) van
          aparte, después de dims/leyenda (ver más abajo): si quedaran
          mezcladas en este mismo paso, un texto que cayera justo encima
          (p.ej. la medida "8 x 4 m", que se dibuja en el centro de la
          pileta — el mismo lugar donde arranca la escalera libre por
          defecto) tapa el círculo invisible y el click/touch le pega al
          texto en vez de agarrar el objeto. Bug real, reportado. */}
      {geometria.extras
        .filter((p) => !(p.t === "circle" && p.drag))
        .map((p, i) => (
          <PrimSvg key={`extra-${i}`} p={p} />
        ))}
      {geometria.dims.map((p, i) => (
        <PrimSvg key={`dim-${i}`} p={p} />
      ))}
      {geometria.legend.length > 0 && (
        <>
          <text x={geometria.legend[0].x} y={geometria.legend[0].y - 18} fontSize={12} fill="#1B3A5C" fontWeight="bold" letterSpacing={1}>
            REFERENCIAS
          </text>
          {geometria.legend.map((item, i) => (
            <LegendGlyph key={i} item={item} losetaFill={geometria.colores.losetaFill} />
          ))}
        </>
      )}

      {/* Capa de arrastre: siempre la última en pintarse, así ningún otro
          elemento (por más que caiga en el mismo punto) puede taparla. */}
      {interactive &&
        geometria.extras
          .filter((p) => p.t === "circle" && p.drag)
          .map((p, i) => <PrimSvg key={`drag-${i}`} p={p} />)}
      {arrastrando !== null && <ArrastreActivoResaltado extras={geometria.extras} arrastrando={arrastrando} />}
    </svg>
  );
}

/**
 * Anillo de resalte alrededor de lo que se está arrastrando. En touch no hay
 * hover/cursor que muestre qué está "agarrado" — sin esto, con varios
 * objetos cerca es fácil perder de vista cuál se está moviendo mientras el
 * dedo lo tapa.
 */
function ArrastreActivoResaltado({ extras, arrastrando }: { extras: Prim[]; arrastrando: Arrastre }) {
  const activa = extras.find(
    (p): p is Extract<Prim, { t: "circle" }> =>
      p.t === "circle" && p.drag?.tipo === arrastrando.tipo && p.drag?.indice === arrastrando.indice
  );
  if (!activa) return null;
  return <circle cx={activa.cx} cy={activa.cy} r={22} fill="none" stroke="#1B3A5C" strokeWidth={2} strokeDasharray="4 3" />;
}

function PrimSvg({ p }: { p: Prim }) {
  switch (p.t) {
    case "rect":
      return (
        <rect
          x={p.x} y={p.y} width={p.w} height={p.h}
          fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth}
          rx={p.rx} opacity={p.opacity} strokeDasharray={p.dash}
        />
      );
    case "line":
      return <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.stroke} strokeWidth={p.strokeWidth} opacity={p.opacity} />;
    case "circle":
      return (
        <circle
          cx={p.cx} cy={p.cy} r={p.r} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth}
          opacity={p.opacity}
          data-luz={p.drag?.tipo === "luz" ? p.drag.indice : undefined}
          data-escalera={p.drag?.tipo === "escalera" ? "" : undefined}
          data-drag={p.drag ? `${p.drag.tipo}:${p.drag.indice}` : undefined}
          className={p.drag ? "pys-luz-drag" : undefined}
        />
      );
    case "text":
      return (
        <text
          x={p.x} y={p.y} fontSize={p.fontSize} fill={p.fill}
          textAnchor={p.anchor} dominantBaseline={p.central ? "central" : undefined}
          fontWeight={p.weight} opacity={p.opacity}
          transform={p.rotateDeg ? `rotate(${p.rotateDeg} ${p.x} ${p.y})` : undefined}
        >
          {p.text}
        </text>
      );
  }
}

const LEGEND_SW = 18;

function LegendGlyph({
  item,
  losetaFill,
}: {
  item: { x: number; y: number; kind: string; label: string };
  losetaFill: string;
}) {
  const sy = item.y - LEGEND_SW / 2;
  return (
    <>
      {item.kind === "loseta" && <rect x={item.x} y={sy} width={LEGEND_SW} height={LEGEND_SW} rx={2} fill={losetaFill} stroke="#C0522D" strokeWidth={1} />}
      {item.kind === "pileta" && <rect x={item.x} y={sy} width={LEGEND_SW} height={LEGEND_SW} rx={2} fill="url(#poolGrad)" stroke="#1B3A5C" strokeWidth={1} />}
      {item.kind === "solarhumedo" && <rect x={item.x} y={sy} width={LEGEND_SW} height={LEGEND_SW} rx={2} fill="#BFE0EF" stroke="#0C447C" strokeWidth={0.75} />}
      {item.kind === "espejo" && <rect x={item.x} y={sy} width={LEGEND_SW} height={LEGEND_SW} rx={2} fill="url(#poolGrad)" stroke="#1B3A5C" strokeWidth={1} strokeDasharray="3 2" />}
      {item.kind === "escalera" && <rect x={item.x} y={sy} width={LEGEND_SW} height={LEGEND_SW} rx={1} fill="#ffffff" stroke="#1B3A5C" strokeWidth={1.1} strokeDasharray="3 2" />}
      {item.kind === "luz" && (
        <>
          <circle cx={item.x + LEGEND_SW / 2} cy={item.y} r={9} fill="url(#luzGlow)" />
          <circle cx={item.x + LEGEND_SW / 2} cy={item.y} r={4} fill="#FFEFA8" stroke="#C99A2E" strokeWidth={1} />
        </>
      )}
      {item.kind === "skimmer" && (
        <>
          <rect x={item.x} y={sy + 2} width={LEGEND_SW} height={LEGEND_SW - 4} rx={2} fill="#EAF0F3" stroke="#1B3A5C" strokeWidth={1} />
          <rect x={item.x + 3} y={item.y - 2} width={LEGEND_SW - 6} height={4} rx={1} fill="#1B3A5C" opacity={0.55} />
        </>
      )}
      {item.kind === "hidromasaje" && (
        <>
          <circle cx={item.x + LEGEND_SW / 2} cy={item.y} r={8} fill="#ffffff" stroke="#0C7A8C" strokeWidth={1.4} />
          <circle cx={item.x + LEGEND_SW / 2} cy={item.y} r={3.5} fill="#4FC7D9" stroke="#0C7A8C" strokeWidth={1} />
        </>
      )}
      <text x={item.x + LEGEND_SW + 8} y={item.y} dominantBaseline="central" fontSize={13} fill="#42525E">
        {item.label}
      </text>
    </>
  );
}
