import { z } from "zod";

/**
 * Geometría del "Plano de Piscina" (losetas).
 *
 * Motor de dominio PURO: recibe el estado del editor y devuelve una lista de
 * primitivas de dibujo (rectángulos, líneas, círculos, textos) en coordenadas
 * de píxel, listas para que un componente React las renderice como JSX de
 * `<svg>`. No genera HTML/SVG en texto ni toca el DOM — eso es justamente lo
 * que se quiso evitar al migrar (ver Lote 2 de la auditoría de Fase 5:
 * "no conviertas el SVG en una caja negra manipulada por querySelector").
 *
 * Transcripción 1:1 de `drawSvg()` en el legacy
 * (app/dashboard/losetas/script.ts, ya borrado), verificada contra
 * losetas.test.ts de esta misma carpeta. La aritmética de m² (no la de
 * dibujo) vive aparte en lib/domain/precios/losetas.ts.
 */

export const LuzPos = z.object({ x: z.number(), y: z.number() });
export type LuzPos = z.infer<typeof LuzPos>;

export const EscaleraPos = z.enum(["solar", "opuesto", "lateral1", "lateral2"]);
export type EscaleraPos = z.infer<typeof EscaleraPos>;

export const TipoPileta = z.enum(["hormigon", "fibra"]);
export type TipoPileta = z.infer<typeof TipoPileta>;

export const Revestimiento = z.enum(["", "ceramicos", "travertino", "pintura", "otro"]);
export type Revestimiento = z.infer<typeof Revestimiento>;

export const PlanoLosetasEntrada = z.object({
  largo: z.number().min(0).default(0),
  ancho: z.number().min(0).default(0),
  solar: z.number().min(0).default(0),
  opuesto: z.number().min(0).default(0),
  lateral1: z.number().min(0).default(0),
  lateral2: z.number().min(0).default(0),
  solarHumedo: z.boolean().default(false),
  solarHumedoAncho: z.number().min(0).default(0),
  escalera: z.boolean().default(false),
  escaleraPos: EscaleraPos.default("solar"),
  tipoPileta: TipoPileta.default("hormigon"),
  labios: z.number().min(0).default(0.2),
  luces: z.boolean().default(false),
  cantLuces: z.number().min(0).default(0),
  lucesPos: z.array(LuzPos).default([]),
  revestimiento: Revestimiento.default(""),
  revestimientoOtro: z.string().default(""),
  colorAgua: z.string().default("#A6D1EC"),
  colorLoseta: z.string().default("#F7E6D3"),
  lblSolar: z.string().default("Solar"),
  lblOpuesto: z.string().default("Opuesto"),
  lblLateral1: z.string().default("Lateral 1"),
  lblLateral2: z.string().default("Lateral 2"),
});
export type PlanoLosetasEntrada = z.input<typeof PlanoLosetasEntrada>;
export type PlanoLosetasEstado = z.infer<typeof PlanoLosetasEntrada>;

const REVEST_LABELS: Record<Exclude<Revestimiento, "">, string> = {
  ceramicos: "Cerámicos",
  travertino: "Travertino",
  pintura: "Pintura",
  otro: "Otro",
};

/** Posición por defecto de la luz i-ésima de n: contra la pared del solar,
 *  repartidas a lo largo. Normalizada (0..1) dentro del rectángulo de la pileta. */
export function posicionLuzPorDefecto(i: number, n: number): LuzPos {
  return { x: 0.06, y: n <= 1 ? 0.5 : (i + 0.5) / n };
}

/** Ajusta el array de posiciones a la cantidad actual de luces: conserva las
 *  ya elegidas, agrega las que falten en su posición por defecto y descarta
 *  las sobrantes. Pura: devuelve un array nuevo, nunca muta el que recibe. */
export function ajustarLucesPos(lucesPos: LuzPos[], on: boolean, n: number): LuzPos[] {
  if (!on || n <= 0) return [];
  const resultado = lucesPos.slice(0, n);
  for (let i = 0; i < n; i++) {
    if (!resultado[i]) resultado[i] = posicionLuzPorDefecto(i, n);
  }
  return resultado;
}

function hexToRgb(h: string): [number, number, number] {
  let hex = String(h || "").replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  const n = parseInt(hex || "000000", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Aclara un color hex mezclándolo con blanco (t=0 sin cambio, t=1 blanco). */
export function aclararHex(hex: string, t: number): string {
  const [r, g, b] = hexToRgb(hex);
  const m = (v: number) => Math.round(v + (255 - v) * t);
  return "#" + [m(r), m(g), m(b)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export function fmtM(n: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);
}

/* ───────────────────────── Primitivas de dibujo ───────────────────────── */

export type PrimRect = {
  t: "rect";
  x: number; y: number; w: number; h: number;
  fill: string; stroke?: string; strokeWidth?: number; rx?: number;
  opacity?: number; dash?: string;
};
export type PrimLine = {
  t: "line";
  x1: number; y1: number; x2: number; y2: number;
  stroke: string; strokeWidth: number; opacity?: number;
};
export type PrimCircle = {
  t: "circle";
  cx: number; cy: number; r: number;
  fill: string; stroke?: string; strokeWidth?: number; opacity?: number;
  /** Presente sólo en el círculo de agarre interactivo de una luz. */
  luzIndex?: number;
};
export type PrimText = {
  t: "text";
  x: number; y: number; text: string;
  fontSize: number; fill: string;
  anchor?: "start" | "middle" | "end";
  central?: boolean;
  weight?: "bold";
  opacity?: number;
  rotateDeg?: number;
};
export type Prim = PrimRect | PrimLine | PrimCircle | PrimText;

export interface LegendItem {
  x: number; y: number;
  kind: "loseta" | "pileta" | "solarhumedo" | "espejo" | "escalera" | "luz";
  label: string;
}

export interface GeometriaPlano {
  viewW: number;
  svgH: number;
  /** Rectángulo de la pileta en píxeles — lo usa el editor para convertir
   *  coordenadas de puntero a posición normalizada al arrastrar una luz. */
  pool: { x: number; y: number; w: number; h: number };
  colores: { aguaTop: string; aguaBottom: string; losetaFill: string };
  fondo: Prim; // el rectángulo grande de loseta
  grid: PrimLine[];
  extras: Prim[]; // solar húmedo, escalera, espejo, luces
  dims: Prim[]; // título, cotas, etiquetas de lado
  legend: LegendItem[];
}

export interface OpcionesPlano {
  viewW: number;
  viewHmax: number;
  /** true = plano completo (imagen del cliente): grilla, cotas, leyenda.
   *  false = plano compacto (editor): sólo lo esencial. */
  showDims: boolean;
  /** true = plano del editor: dibuja el círculo de agarre de cada luz. */
  interactive: boolean;
}

function tick(x: number, y: number, color: string): PrimLine {
  return { t: "line", x1: x - 4, y1: y, x2: x + 4, y2: y, stroke: color, strokeWidth: 0.75 };
}
function tickH(x: number, y: number, color: string): PrimLine {
  return { t: "line", x1: x, y1: y - 4, x2: x, y2: y + 4, stroke: color, strokeWidth: 0.75 };
}

/**
 * Calcula la geometría completa del plano. Determinístico y sin efectos: la
 * misma entrada siempre da la misma salida, por eso es fácil de testear
 * (Lote 3 — paridad interactiva) sin levantar ningún DOM.
 */
export function calcularGeometriaPlano(entradaCruda: PlanoLosetasEntrada, opciones: OpcionesPlano): GeometriaPlano {
  const s = PlanoLosetasEntrada.parse(entradaCruda);
  const { viewW, viewHmax, showDims, interactive } = opciones;

  const padTop = showDims ? 90 : 46;
  const padSide = showDims ? 130 : 90;
  const padBottom = showDims ? 110 : 60;
  const maxW = viewW - padSide * 2;
  const maxH = viewHmax - padTop - padBottom;
  const totalW = s.largo + s.solar + s.opuesto;
  const totalH = s.ancho + s.lateral1 + s.lateral2;
  const pxPerM = Math.max(1, Math.min(maxW / Math.max(totalW, 0.01), maxH / Math.max(totalH, 0.01)));
  const ox = padSide;
  const oy = padTop;

  const poolX = ox + s.solar * pxPerM;
  const poolY = oy + s.lateral1 * pxPerM;
  const poolW = s.largo * pxPerM;
  const poolH = s.ancho * pxPerM;

  const grid: PrimLine[] = [];
  if (showDims) {
    for (let gx = 0; gx <= totalW + 0.001; gx++) {
      const x = ox + gx * pxPerM;
      grid.push({ t: "line", x1: x, y1: oy, x2: x, y2: oy + totalH * pxPerM, stroke: "#000", strokeWidth: 0.4, opacity: 0.07 });
    }
    for (let gy = 0; gy <= totalH + 0.001; gy++) {
      const y = oy + gy * pxPerM;
      grid.push({ t: "line", x1: ox, y1: y, x2: ox + totalW * pxPerM, y2: y, stroke: "#000", strokeWidth: 0.4, opacity: 0.07 });
    }
  }

  const extras: Prim[] = [];

  if (s.solarHumedo && s.solarHumedoAncho > 0) {
    const shW = Math.min(s.solarHumedoAncho, s.largo) * pxPerM;
    extras.push({ t: "rect", x: poolX, y: poolY, w: shW, h: poolH, fill: "#BFE0EF", opacity: 0.8 });
    if (shW > 60) {
      extras.push({
        t: "text", x: poolX + shW / 2, y: poolY + poolH / 2,
        text: `Solar húmedo${showDims ? " (" + fmtM(s.solarHumedoAncho) + "m)" : ""}`,
        fontSize: 12, fill: "#0C447C", anchor: "middle", central: true,
      });
    }
  }

  if (s.escalera) {
    const stepSize = Math.min(pxPerM * 0.9, poolW * 0.18, poolH * 0.35, 46);
    let sx: number, sy: number;
    if (s.escaleraPos === "solar") { sx = poolX; sy = poolY + poolH / 2 - stepSize / 2; }
    else if (s.escaleraPos === "opuesto") { sx = poolX + poolW - stepSize; sy = poolY + poolH / 2 - stepSize / 2; }
    else if (s.escaleraPos === "lateral1") { sx = poolX + poolW / 2 - stepSize / 2; sy = poolY; }
    else { sx = poolX + poolW / 2 - stepSize / 2; sy = poolY + poolH - stepSize; }
    extras.push({ t: "rect", x: sx, y: sy, w: stepSize, h: stepSize, fill: "#fff", stroke: "#1B3A5C", strokeWidth: 1.2, dash: "3 2" });
    extras.push({ t: "text", x: sx + stepSize / 2, y: sy + stepSize / 2, text: "Escalera", fontSize: 9, fill: "#1B3A5C", anchor: "middle", central: true });
  }

  let espejoW = s.largo;
  let espejoH = s.ancho;
  if (s.tipoPileta === "fibra" && s.labios > 0) {
    const labiosPx = s.labios * pxPerM;
    espejoW = Math.max(0, s.largo - 2 * s.labios);
    espejoH = Math.max(0, s.ancho - 2 * s.labios);
    extras.push({
      t: "rect", x: poolX + labiosPx, y: poolY + labiosPx,
      w: Math.max(0, poolW - 2 * labiosPx), h: Math.max(0, poolH - 2 * labiosPx),
      rx: 3, fill: "none", stroke: "#1B3A5C", strokeWidth: 1, dash: "4 3", opacity: 0.6,
    });
    if (showDims && poolW - 2 * labiosPx > 90) {
      extras.push({
        t: "text", x: poolX + poolW / 2, y: poolY + labiosPx + 14,
        text: `Espejo de agua ${fmtM(espejoW)} x ${fmtM(espejoH)} m`,
        fontSize: 11, fill: "#1B3A5C", anchor: "middle", opacity: 0.75,
      });
    }
  }

  if (s.luces && s.cantLuces > 0) {
    const n = s.cantLuces;
    const glowR = showDims ? 16 : 13;
    const bulbR = showDims ? 6 : 5;
    for (let i = 0; i < n; i++) {
      const p = s.lucesPos[i] || posicionLuzPorDefecto(i, n);
      const cx = poolX + Math.max(0, Math.min(1, p.x)) * poolW;
      const cy = poolY + Math.max(0, Math.min(1, p.y)) * poolH;
      extras.push({ t: "circle", cx, cy, r: glowR, fill: "url(#luzGlow)" });
      extras.push({ t: "circle", cx, cy, r: bulbR, fill: "#FFEFA8", stroke: "#C99A2E", strokeWidth: 1.2 });
      extras.push({ t: "circle", cx: cx - bulbR * 0.32, cy: cy - bulbR * 0.32, r: bulbR * 0.32, fill: "#FFFDF3" });
      if (interactive) {
        extras.push({ t: "circle", cx, cy, r: 16, fill: "transparent", luzIndex: i });
      }
    }
    if (interactive) {
      extras.push({
        t: "text", x: ox + (totalW * pxPerM) / 2, y: oy + totalH * pxPerM + 34,
        text: "Arrastrá las luces para ubicarlas donde quieras",
        fontSize: 11, fill: "#B98A1E", anchor: "middle",
      });
    }
  }

  const dimColor = "#1B3A5C";
  const labelColor = "#7a4a2e";

  const aguaBottom = s.colorAgua || "#A6D1EC";
  const aguaTop = String(aguaBottom).toLowerCase() === "#a6d1ec" ? "#E7F3FC" : aclararHex(aguaBottom, 0.6);
  const losetaFill = s.colorLoseta || "#F7E6D3";

  const revestText = s.revestimiento ? REVEST_LABELS[s.revestimiento] || (s.revestimiento === "otro" ? s.revestimientoOtro || "Otro" : "") : "";
  const revestTextFinal = s.revestimiento === "otro" ? s.revestimientoOtro || "Otro" : revestText;

  const dims: Prim[] = [];

  if (showDims) {
    dims.push({
      t: "text", x: poolX + poolW / 2, y: oy - 13,
      text: `Pileta ${fmtM(s.largo)} x ${fmtM(s.ancho)} m`,
      fontSize: 17, fill: dimColor, anchor: "middle", weight: "bold",
    });

    if (revestTextFinal && poolH > 90 && poolW > 150) {
      const chipLabel = "Revestimiento: " + revestTextFinal;
      const chipW = Math.min(poolW - 16, chipLabel.length * 7.0 + 28);
      const chipH = 26;
      const chipX = poolX + poolW / 2 - chipW / 2;
      const chipY = poolY + poolH - chipH - 16;
      dims.push({ t: "rect", x: chipX, y: chipY, w: chipW, h: chipH, rx: 13, fill: "#ffffff", stroke: dimColor, strokeWidth: 0.75, opacity: 0.94 });
      dims.push({ t: "text", x: poolX + poolW / 2, y: chipY + chipH / 2, text: chipLabel, fontSize: 13, fill: dimColor, anchor: "middle", central: true });
    }

    const topY = oy - 34;
    dims.push({ t: "line", x1: ox, y1: topY, x2: ox + totalW * pxPerM, y2: topY, stroke: dimColor, strokeWidth: 0.75 });
    dims.push(tickH(ox, topY, dimColor));
    dims.push(tickH(ox + totalW * pxPerM, topY, dimColor));
    dims.push({ t: "text", x: ox + (totalW * pxPerM) / 2, y: topY - 10, text: `Borde total: ${fmtM(totalW)} m`, fontSize: 13, fill: dimColor, anchor: "middle" });

    const leftX = Math.max(40, ox - 60);
    dims.push({ t: "line", x1: leftX, y1: oy, x2: leftX, y2: oy + totalH * pxPerM, stroke: dimColor, strokeWidth: 0.75 });
    dims.push(tick(leftX, oy, dimColor));
    dims.push(tick(leftX, oy + totalH * pxPerM, dimColor));
    dims.push({
      t: "text", x: leftX - 16, y: oy + (totalH * pxPerM) / 2,
      text: `Borde total: ${fmtM(totalH)} m`, fontSize: 13, fill: dimColor, anchor: "middle", central: true,
      rotateDeg: -90,
    });

    if (s.lateral1 * pxPerM > 16) {
      dims.push({ t: "text", x: poolX + poolW / 2, y: oy + (s.lateral1 * pxPerM) / 2, text: `${s.lblLateral1}: ${fmtM(s.lateral1)} m`, fontSize: 13, fill: labelColor, anchor: "middle", central: true });
    }
    if (s.lateral2 * pxPerM > 16) {
      dims.push({ t: "text", x: poolX + poolW / 2, y: oy + s.lateral1 * pxPerM + poolH + (s.lateral2 * pxPerM) / 2, text: `${s.lblLateral2}: ${fmtM(s.lateral2)} m`, fontSize: 13, fill: labelColor, anchor: "middle", central: true });
    }
    if (s.solar * pxPerM > 22) {
      dims.push({
        t: "text", x: ox + (s.solar * pxPerM) / 2, y: poolY + poolH / 2,
        text: `${s.lblSolar}: ${fmtM(s.solar)} m`, fontSize: 13, fill: labelColor, anchor: "middle", central: true,
        rotateDeg: -90,
      });
    }
    if (s.opuesto * pxPerM > 22) {
      dims.push({
        t: "text", x: ox + s.solar * pxPerM + poolW + (s.opuesto * pxPerM) / 2, y: poolY + poolH / 2,
        text: `${s.lblOpuesto}: ${fmtM(s.opuesto)} m`, fontSize: 13, fill: labelColor, anchor: "middle", central: true,
        rotateDeg: -90,
      });
    }
  } else {
    dims.push({ t: "text", x: ox + (totalW * pxPerM) / 2, y: oy - 14, text: `${s.lblLateral1}: ${fmtM(s.lateral1)} m`, fontSize: 12, fill: "#555", anchor: "middle" });
    dims.push({ t: "text", x: ox + (totalW * pxPerM) / 2, y: oy + totalH * pxPerM + 24, text: `${s.lblLateral2}: ${fmtM(s.lateral2)} m`, fontSize: 12, fill: "#555", anchor: "middle" });
    dims.push({ t: "text", x: Math.max(14, ox - 16), y: oy + (totalH * pxPerM) / 2, text: `${s.lblSolar}: ${fmtM(s.solar)} m`, fontSize: 12, fill: "#555", anchor: "end" });
    dims.push({ t: "text", x: ox + totalW * pxPerM + 16, y: oy + (totalH * pxPerM) / 2, text: `${s.lblOpuesto}: ${fmtM(s.opuesto)} m`, fontSize: 12, fill: "#555", anchor: "start" });
    dims.push({
      t: "text", x: poolX + poolW / 2, y: poolY + poolH / 2 - (revestTextFinal ? 8 : 0),
      text: `${fmtM(s.largo)} x ${fmtM(s.ancho)} m`, fontSize: 14, fill: "#1B3A5C", anchor: "middle", central: true,
    });
    if (revestTextFinal) {
      dims.push({
        t: "text", x: poolX + poolW / 2, y: poolY + poolH / 2 + 12,
        text: `Revestimiento: ${revestTextFinal}`, fontSize: 10, fill: "#1B3A5C", anchor: "middle", central: true, opacity: 0.7,
      });
    }
  }

  let svgH = oy + totalH * pxPerM + padBottom;
  const legend: LegendItem[] = [];

  if (showDims) {
    const legItems: { kind: LegendItem["kind"]; label: string }[] = [
      { kind: "loseta", label: "Borde de loseta" },
      { kind: "pileta", label: "Pileta" },
    ];
    if (s.solarHumedo && s.solarHumedoAncho > 0) legItems.push({ kind: "solarhumedo", label: "Solar húmedo" });
    if (s.tipoPileta === "fibra" && s.labios > 0) legItems.push({ kind: "espejo", label: "Espejo de agua" });
    if (s.escalera) legItems.push({ kind: "escalera", label: "Escalera" });
    if (s.luces && s.cantLuces > 0) legItems.push({ kind: "luz", label: "Luz" });

    const swW = 18, swGap = 8, itemGap = 30, rowH = 28;
    const maxRight = ox + totalW * pxPerM;
    let lx = ox;
    let ly = oy + totalH * pxPerM + 62;
    for (const it of legItems) {
      const w = swW + swGap + it.label.length * 7.4 + itemGap;
      if (lx + w > maxRight && lx > ox) { lx = ox; ly += rowH; }
      legend.push({ x: lx, y: ly, kind: it.kind, label: it.label });
      lx += w;
    }
    svgH = ly + 24;
  }

  return {
    viewW,
    svgH,
    pool: { x: poolX, y: poolY, w: poolW, h: poolH },
    colores: { aguaTop, aguaBottom, losetaFill },
    fondo: { t: "rect", x: ox, y: oy, w: totalW * pxPerM, h: totalH * pxPerM, rx: 6, fill: losetaFill, stroke: "#C0522D", strokeWidth: 1 },
    grid,
    extras,
    dims,
    legend,
  };
}
