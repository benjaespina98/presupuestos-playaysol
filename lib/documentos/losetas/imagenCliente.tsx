import type { GeometriaPlano, LegendItem, Prim } from "@/lib/domain/plano/losetas";

/**
 * Imagen/PDF del plano para el cliente — reemplaza el viejo camino de
 * `LosetasCalculadora.tsx` (capturar con `html2canvas` un `<div>` oculto,
 * fuera de pantalla, con `position: fixed; top:-99999px`).
 *
 * Ese camino fallaba justo donde más se usa esta pantalla: desde el
 * celular. `html2canvas` clona el DOM y vuelve a medirlo con su propio motor
 * de layout — un `<div>` fixed empujado kilómetros afuera del viewport se
 * mide distinto según el navegador (Safari/Chrome de Android en particular),
 * así que el plano salía con las medidas corridas o directamente cortado, y
 * el nombre del cliente (que vive en el mismo bloque) quedaba afuera del
 * recorte. Encima esa librería sólo entiende colores rgb/hex/hsl: un solo
 * `oklch()` colado en el árbol (los tokens de paleta de Tailwind v4) tira
 * "unsupported color function" y no exporta nada.
 *
 * Acá no hay DOM que clonar ni medir: el plano YA es una lista de primitivas
 * (`GeometriaPlano`, en `lib/domain/plano/losetas.ts`) — lo mismo que pinta
 * `PlanoLosetasSvg.tsx` en pantalla. Este módulo arma un `<svg>` standalone
 * con esas mismas primitivas + un título simple + el pie, y lo rasteriza con
 * el Canvas nativo del navegador (`new Image()` + `<canvas>`), que en
 * cualquier celular mide exactamente lo que el `viewBox` dice que mide — no
 * hay reflow de un DOM ajeno de por medio. El PDF reusa ese mismo PNG (mismo
 * contenido, WYSIWYG entre "Imagen" y "PDF") envuelto en una página de
 * `@react-pdf/renderer` con el tamaño de la imagen.
 *
 * Sin el banner de marca (header-teal/navy.png): ese banner es el membrete
 * de un PRESUPUESTO (piscinas/revestimientos/cobertores/cercos) — acá el
 * entregable es un plano técnico, no un presupuesto, y llevarlo lo hacía más
 * pesado y ruidoso sin sumar nada (a pedido explícito, ver conversación).
 * Por eso tampoco hay ninguna variante para elegir: un solo estilo, fijo.
 */

export interface ParametrosImagenCliente {
  /** Geometría "completa" (showDims:true, interactive:false) — la misma que
   *  ya usa `geometriaCliente` en LosetasCalculadora.tsx. */
  geometria: GeometriaPlano;
  nombreCliente: string;
}

function blobADataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(blob);
  });
}

/* ───────────────────────── Prim[] → SVG (texto) ───────────────────────── */

function escaparXml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function attr(nombre: string, valor: string | number | undefined | boolean): string {
  if (valor === undefined || valor === false) return "";
  return ` ${nombre}="${valor === true ? "" : valor}"`;
}

function primASvg(p: Prim): string {
  switch (p.t) {
    case "rect":
      return `<rect${attr("x", p.x)}${attr("y", p.y)}${attr("width", Math.max(0, p.w))}${attr("height", Math.max(0, p.h))}${attr("fill", p.fill)}${attr("stroke", p.stroke)}${attr("stroke-width", p.strokeWidth)}${attr("rx", p.rx)}${attr("opacity", p.opacity)}${attr("stroke-dasharray", p.dash)} />`;
    case "line":
      return `<line${attr("x1", p.x1)}${attr("y1", p.y1)}${attr("x2", p.x2)}${attr("y2", p.y2)}${attr("stroke", p.stroke)}${attr("stroke-width", p.strokeWidth)}${attr("opacity", p.opacity)} />`;
    case "circle":
      return `<circle${attr("cx", p.cx)}${attr("cy", p.cy)}${attr("r", p.r)}${attr("fill", p.fill)}${attr("stroke", p.stroke)}${attr("stroke-width", p.strokeWidth)}${attr("opacity", p.opacity)} />`;
    case "text": {
      const transform = p.rotateDeg ? ` transform="rotate(${p.rotateDeg} ${p.x} ${p.y})"` : "";
      return `<text${attr("x", p.x)}${attr("y", p.y)} font-family="Arial, Helvetica, sans-serif"${attr("font-size", p.fontSize)}${attr("fill", p.fill)}${attr("text-anchor", p.anchor ?? "start")}${p.central ? ' dominant-baseline="central"' : ""}${p.weight ? ' font-weight="bold"' : ""}${attr("opacity", p.opacity)}${transform}>${escaparXml(p.text)}</text>`;
    }
  }
}

const LEGEND_SW = 18;

function legendASvg(items: LegendItem[], losetaFill: string): string {
  if (items.length === 0) return "";
  const glifos = items
    .map((it) => {
      const sy = it.y - LEGEND_SW / 2;
      let glifo = "";
      if (it.kind === "loseta") glifo = `<rect x="${it.x}" y="${sy}" width="${LEGEND_SW}" height="${LEGEND_SW}" rx="2" fill="${losetaFill}" stroke="#C0522D" stroke-width="1" />`;
      else if (it.kind === "pileta") glifo = `<rect x="${it.x}" y="${sy}" width="${LEGEND_SW}" height="${LEGEND_SW}" rx="2" fill="url(#poolGrad)" stroke="#1B3A5C" stroke-width="1" />`;
      else if (it.kind === "solarhumedo") glifo = `<rect x="${it.x}" y="${sy}" width="${LEGEND_SW}" height="${LEGEND_SW}" rx="2" fill="#BFE0EF" stroke="#0C447C" stroke-width="0.75" />`;
      else if (it.kind === "espejo") glifo = `<rect x="${it.x}" y="${sy}" width="${LEGEND_SW}" height="${LEGEND_SW}" rx="2" fill="url(#poolGrad)" stroke="#1B3A5C" stroke-width="1" stroke-dasharray="3 2" />`;
      else if (it.kind === "escalera") glifo = `<rect x="${it.x}" y="${sy}" width="${LEGEND_SW}" height="${LEGEND_SW}" rx="1" fill="#ffffff" stroke="#1B3A5C" stroke-width="1.1" stroke-dasharray="3 2" />`;
      else if (it.kind === "luz") {
        const cx = it.x + LEGEND_SW / 2;
        glifo = `<circle cx="${cx}" cy="${it.y}" r="9" fill="url(#luzGlow)" /><circle cx="${cx}" cy="${it.y}" r="4" fill="#FFEFA8" stroke="#C99A2E" stroke-width="1" />`;
      }
      const texto = `<text x="${it.x + LEGEND_SW + 8}" y="${it.y}" font-family="Arial, Helvetica, sans-serif" font-size="13" fill="#42525E" dominant-baseline="central">${escaparXml(it.label)}</text>`;
      return glifo + texto;
    })
    .join("");
  return glifos;
}

function geometriaASvg(g: GeometriaPlano): string {
  const partes: string[] = [];
  partes.push(primASvg(g.fondo));
  for (const p of g.grid) partes.push(primASvg(p));
  partes.push(
    `<rect x="${g.pool.x}" y="${g.pool.y}" width="${g.pool.w}" height="${g.pool.h}" rx="4" fill="url(#poolGrad)" stroke="#1B3A5C" stroke-width="1" />`
  );
  partes.push(
    `<rect x="${g.pool.x + 2}" y="${g.pool.y + 2}" width="${Math.max(0, g.pool.w - 4)}" height="${Math.max(0, g.pool.h - 4)}" rx="3" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.35" />`
  );
  for (const p of g.extras) partes.push(primASvg(p));
  for (const p of g.dims) partes.push(primASvg(p));
  if (g.legend.length > 0) {
    partes.push(
      `<text x="${g.legend[0].x}" y="${g.legend[0].y - 18}" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#1B3A5C" font-weight="bold" letter-spacing="1">REFERENCIAS</text>`
    );
    partes.push(legendASvg(g.legend, g.colores.losetaFill));
  }
  return partes.join("\n");
}

/* ─────────────────────────── Layout de la página ─────────────────────────── */

// Único estilo, fijo — mismo navy/teal de marca que el resto de la app
// (ver PlanoLosetasSvg.tsx), sin variante para elegir (ver comentario de
// arriba: acá no hay membrete de presupuesto).
const COLOR_TITULO = "#244B5A";
const COLOR_DIVISOR = "#00829C";

const PAG_PAD = 40;
const CARD_PAD = 24;

interface SvgClienteResultado {
  svg: string;
  width: number;
  height: number;
}

function construirSvgCliente({ geometria, nombreCliente }: ParametrosImagenCliente): SvgClienteResultado {
  const pageW = geometria.viewW + PAG_PAD * 2;

  let y = PAG_PAD;
  const tituloY = y + 22;
  const nombreY = y + 42;
  const divisorY = y + 56;
  y = divisorY + 24;
  const cardY = y;
  const cardH = geometria.svgH + CARD_PAD * 2;
  y = cardY + cardH + 28;
  const footerLineY = y;
  const footerTextY = y + 22;
  const pageH = footerTextY + 18;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pageW}" height="${pageH}" viewBox="0 0 ${pageW} ${pageH}">
  <defs>
    <linearGradient id="poolGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${geometria.colores.aguaTop}" />
      <stop offset="1" stop-color="${geometria.colores.aguaBottom}" />
    </linearGradient>
    <radialGradient id="luzGlow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#FFF6CE" stop-opacity="0.95" />
      <stop offset="0.55" stop-color="#FFE08A" stop-opacity="0.5" />
      <stop offset="1" stop-color="#FFE08A" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="${pageW}" height="${pageH}" fill="#ffffff" />
  <text x="${PAG_PAD}" y="${tituloY}" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="bold" fill="${COLOR_TITULO}" letter-spacing="0.5">PLANO DE PISCINA</text>
  <text x="${PAG_PAD}" y="${nombreY}" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#6B7680">${escaparXml(nombreCliente)}</text>
  <line x1="${PAG_PAD}" y1="${divisorY}" x2="${pageW - PAG_PAD}" y2="${divisorY}" stroke="${COLOR_DIVISOR}" stroke-width="2" />
  <rect x="${PAG_PAD}" y="${cardY}" width="${geometria.viewW}" height="${cardH}" rx="8" fill="#EEF2F6" stroke="#E1E7EC" stroke-width="1" />
  <g transform="translate(${PAG_PAD + CARD_PAD}, ${cardY + CARD_PAD})">
    ${geometriaASvg(geometria)}
  </g>
  <line x1="${PAG_PAD}" y1="${footerLineY}" x2="${pageW - PAG_PAD}" y2="${footerLineY}" stroke="${COLOR_DIVISOR}" stroke-width="2" />
  <text x="${PAG_PAD}" y="${footerTextY}" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="bold" fill="${COLOR_TITULO}" letter-spacing="0.5">Playa y Sol S.A.S. — Corrientes 1210, Villa María</text>
</svg>`;

  return { svg, width: pageW, height: pageH };
}

/* ───────────────────────────── Rasterización ───────────────────────────── */

/** Escala de rasterizado: bastante para que se vea nítido en la pantalla de
 *  un celular y al hacer zoom en WhatsApp, sin generar un PNG desmedido. */
const ESCALA_RASTER = 2.5;

function rasterizarSvg(svg: string, width: number, height: number, escala: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width * escala);
        canvas.height = Math.round(height * escala);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("El navegador no pudo crear el lienzo para la imagen.");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          if (blob) resolve(blob);
          else reject(new Error("No se pudo generar el PNG del plano."));
        }, "image/png");
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo dibujar el plano — revisá los datos cargados."));
    };
    img.src = url;
  });
}

async function generarPngClientePlano(params: ParametrosImagenCliente): Promise<{ blob: Blob; width: number; height: number }> {
  const { svg, width, height } = construirSvgCliente(params);
  const blob = await rasterizarSvg(svg, width, height, ESCALA_RASTER);
  return { blob, width: width * ESCALA_RASTER, height: height * ESCALA_RASTER };
}

/** PNG del plano listo para descargar/compartir — a escala, con las medidas
 *  y el nombre del cliente, sin nada de precios. */
export async function generarImagenClientePlano(params: ParametrosImagenCliente): Promise<Blob> {
  const { blob } = await generarPngClientePlano(params);
  return blob;
}

/**
 * PDF de una página con el mismo plano — mismo contenido pixel a pixel que
 * "Imagen" (reusa el mismo PNG ya rasterizado), sólo que envuelto en una
 * página de `@react-pdf/renderer` en vez de servido como PNG suelto. Se
 * importa todo de forma perezosa (mismo criterio que `pdfGenerator.tsx`): no
 * hace falta cargar `@react-pdf/renderer` hasta que alguien apreta "PDF".
 */
export async function generarPdfClientePlano(params: ParametrosImagenCliente): Promise<Blob> {
  const { blob: pngBlob, width, height } = await generarPngClientePlano(params);
  const pngDataUri = await blobADataUri(pngBlob);
  const [{ pdf }, { PlanoPdfDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/documentos/pdf/PlanoPdfDocument"),
  ]);
  return pdf(<PlanoPdfDocument pngDataUri={pngDataUri} width={width} height={height} />).toBlob();
}
