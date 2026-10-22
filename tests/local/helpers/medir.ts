import type { Page } from "@playwright/test";

/**
 * Medidas que se sacan de la página real (estilos calculados, no del código): sirven para el relevamiento
 * de responsive y para la prueba de contraste. Se ejecutan dentro del navegador con page.evaluate.
 * Ignoran el indicador de desarrollo de Next (`nextjs-portal`), que no es parte del portal.
 */

export interface Medidas {
  scrollHorizontal: boolean;
  textosChicos: string[];
  zonasChicas: string[];
  contraste: string[];
  /** Controles que al pasar el mouse no muestran la manito (en escritorio no parecen botones). */
  cursores: string[];
  controles: number;
}

export async function medirPagina(page: Page): Promise<Medidas> {
  return page.evaluate(() => {
    type RGBA = [number, number, number, number];
    // Los colores de Tailwind salen del navegador como oklch() o color(srgb ...): se pasan a rgba con un canvas.
    const lienzo = document.createElement("canvas");
    lienzo.width = lienzo.height = 1;
    const ctx2d = lienzo.getContext("2d", { willReadFrequently: true })!;
    const cacheColor = new Map<string, RGBA | null>();
    const parse = (c: string): RGBA | null => {
      if (cacheColor.has(c)) return cacheColor.get(c)!;
      const m = c.match(/^rgba?\(([^)]+)\)$/);
      let r: RGBA | null = null;
      if (m) {
        const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        r = [p[0], p[1], p[2], p[3] ?? 1];
      } else if (c) {
        ctx2d.clearRect(0, 0, 1, 1);
        ctx2d.fillStyle = "#000000";
        ctx2d.fillStyle = c;
        ctx2d.fillRect(0, 0, 1, 1);
        const d = ctx2d.getImageData(0, 0, 1, 1).data;
        r = [d[0], d[1], d[2], d[3] / 255];
      }
      cacheColor.set(c, r);
      return r;
    };
    const mezclar = (sobre: RGBA, fondo: RGBA): RGBA => {
      const a = sobre[3];
      return [sobre[0] * a + fondo[0] * (1 - a), sobre[1] * a + fondo[1] * (1 - a), sobre[2] * a + fondo[2] * (1 - a), 1];
    };
    const lum = (c: RGBA) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    };
    const razon = (a: RGBA, b: RGBA) => {
      const l1 = lum(a), l2 = lum(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    /** El fondo real: se apilan los fondos de los ancestros (con su transparencia) sobre blanco. */
    const fondoReal = (el: Element): RGBA => {
      const cadena: RGBA[] = [];
      for (let e: Element | null = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        const bg = parse(cs.backgroundColor);
        if (bg && bg[3] > 0) cadena.push(bg);
        if (bg && bg[3] >= 1) break;
        if (cs.backgroundImage !== "none" && !cs.backgroundImage.includes("url(")) break;
      }
      let base: RGBA = [255, 255, 255, 1];
      for (const c of cadena.reverse()) base = mezclar(c, base);
      return base;
    };
    const opacidad = (el: Element) => {
      let op = 1;
      for (let e: Element | null = el; e; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
      return op;
    };
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") return false;
      if (el.closest("nextjs-portal, [aria-hidden=true], .sr-only, [inert]")) return false;
      return true;
    };
    const nombre = (el: Element) =>
      ((el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || el.tagName).trim().replace(/\s+/g, " ")).slice(0, 36);

    // 1) Textos visibles con tipografía menor a 13 px.
    const textosChicos = new Set<string>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = (n.textContent ?? "").trim();
      const p = n.parentElement;
      if (!t || !p || !visible(p)) continue;
      let fs = parseFloat(getComputedStyle(p).fontSize);
      // El texto de un dibujo SVG (el plano) se escala con el dibujo: cuenta el tamaño con que se ve en pantalla.
      const svgEl = p as unknown as SVGGraphicsElement;
      if (typeof svgEl.getScreenCTM === "function" && p.namespaceURI === "http://www.w3.org/2000/svg") fs *= svgEl.getScreenCTM()?.a ?? 1;
      if (fs < 12.99) textosChicos.add(`${fs.toFixed(1)}px "${t.slice(0, 30)}" <${p.tagName.toLowerCase()}>`);
    }

    // 2) Controles visibles: zona táctil y contraste.
    const selector = "a[href], button, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea, [role=button], [role=menuitem], [role=option], [role=radio], summary";
    const zonasChicas = new Set<string>();
    const contraste = new Set<string>();
    const cursores = new Set<string>();
    let controles = 0;
    document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      if (!visible(el)) return;
      controles++;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const deshabilitado = (el as HTMLButtonElement).disabled === true || el.getAttribute("aria-disabled") === "true";
      const esCampoDeTexto =
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLInputElement && !["checkbox", "radio", "file", "color", "submit", "button", "range"].includes(el.type));
      if (!esCampoDeTexto) {
        const esperado = deshabilitado ? "not-allowed" : "pointer";
        if (cs.cursor !== esperado) cursores.add(`cursor ${cs.cursor} (debería ser ${esperado}) ${el.tagName.toLowerCase()} "${nombre(el)}"`);
      }
      const estirado = getComputedStyle(el, "::after").position === "absolute";
      if (!estirado && !(r.width <= 2 && r.height <= 2) && (r.height < 43.5 || r.width < 43.5) && !el.closest("a[href]:not(:is(a))")) {
        // Un link dentro de un texto corrido no cuenta (WCAG: "en línea").
        const enLinea = el.tagName === "A" && cs.display === "inline" && !!el.parentElement && /P|SPAN|LI|DD/.test(el.parentElement.tagName) && (el.parentElement.textContent ?? "").trim().length > (el.textContent ?? "").trim().length + 3;
        if (!enLinea) zonasChicas.add(`${el.tagName.toLowerCase()} "${nombre(el)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      // Contraste del texto (4.5:1; 3:1 si es texto grande) contra el fondo real.
      const op = opacidad(el);
      const fondo = fondoReal(el);
      const color = parse(cs.color);
      const tieneTexto = el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement
        ? true
        : [...el.childNodes].some((c) => c.nodeType === 3 && (c.textContent ?? "").trim().length > 0) || (el.textContent ?? "").trim().length > 0;
      if (color && tieneTexto) {
        const real = mezclar([color[0], color[1], color[2], color[3] * op], fondo);
        const fondoOp = mezclar([fondo[0], fondo[1], fondo[2], 1], [255, 255, 255, 1]);
        const fs = parseFloat(cs.fontSize);
        const grande = fs >= 24 || (fs >= 18.66 && Number(cs.fontWeight) >= 700);
        const minimo = grande ? 3 : 4.5;
        const x = razon(real, fondoOp);
        if (x < minimo) contraste.add(`texto ${x.toFixed(2)}:1 (<${minimo}) ${el.tagName.toLowerCase()} "${nombre(el)}"`);
      }
      // Controles con borde propio y sin relleno (secundarios, campos): el borde contra su fondo real, 3:1.
      const bw = parseFloat(cs.borderTopWidth);
      const bc = parse(cs.borderTopColor);
      const borde = bw >= 1 && cs.borderTopStyle !== "none" && bc && bc[3] > 0;
      const fondoPropio = parse(cs.backgroundColor);
      const relleno = fondoPropio && fondoPropio[3] > 0.5;
      const padre = el.parentElement ? fondoReal(el.parentElement) : ([255, 255, 255, 1] as RGBA);
      if (borde && (!relleno || razon(mezclar(fondoPropio!, padre), padre) < 1.5)) {
        const x = razon(mezclar(bc!, padre), padre);
        if (x < 3) contraste.add(`borde ${x.toFixed(2)}:1 (<3) ${el.tagName.toLowerCase()} "${nombre(el)}"`);
      }
      // Ícono solo (sin texto): su color contra el fondo, 3:1.
      const svg = el.querySelector("svg");
      if (svg && !(el.textContent ?? "").trim() && visible(svg)) {
        const c = parse(getComputedStyle(svg).color);
        if (c) {
          const x = razon(mezclar([c[0], c[1], c[2], c[3] * op], fondo), fondo);
          if (x < 3) contraste.add(`ícono ${x.toFixed(2)}:1 (<3) ${el.tagName.toLowerCase()} "${nombre(el)}"`);
        }
      }
    });

    return {
      scrollHorizontal: document.documentElement.scrollWidth > window.innerWidth + 1,
      textosChicos: [...textosChicos],
      zonasChicas: [...zonasChicas],
      contraste: [...contraste],
      cursores: [...cursores],
      controles,
    };
  });
}
