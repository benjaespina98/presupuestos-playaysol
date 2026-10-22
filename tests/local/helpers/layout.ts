import type { Page } from "@playwright/test";

/**
 * Chequeos de la DISPOSICIÓN de una pantalla, medidos en el navegador real (cajas y estilos calculados):
 *
 *  - scroll horizontal de la página;
 *  - texto cortado sin elipsis intencional (se corta por un `overflow` o se sale de la pantalla);
 *  - elementos que se solapan (cajas de texto y de controles que se cruzan sin que uno contenga al otro);
 *  - controles tapados por un elemento fijo o flotante (lo que hay en el centro del control no es el control);
 *  - controles fuera del viewport (a los costados).
 *
 * Lo de contraste, tipografía y zonas táctiles está en `medir.ts`. Sólo mira: no toca nada de la página.
 * Ignora el indicador de desarrollo de Next (`nextjs-portal`).
 */
export interface ProblemasDeLayout {
  scrollHorizontal: string[];
  textosCortados: string[];
  solapes: string[];
  tapados: string[];
  fueraDePantalla: string[];
}

export async function medirLayout(page: Page): Promise<ProblemasDeLayout> {
  return page.evaluate(() => {
    const ancho = window.innerWidth;
    const alto = window.innerHeight;
    const nombre = (el: Element) =>
      ((el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || el.tagName).trim().replace(/\s+/g, " ")).slice(0, 40);
    const etiqueta = (el: Element) => `<${el.tagName.toLowerCase()}> "${nombre(el)}"`;
    const oculto = (el: Element) => !!el.closest("nextjs-portal, [aria-hidden=true], .sr-only, [inert], [hidden]");
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") return false;
      return !oculto(el);
    };

    /** El contenedor con scroll horizontal propio más cercano (lo que está adentro puede salirse a propósito). */
    const scrollerH = (el: Element): Element | null => {
      for (let e: Element | null = el.parentElement; e && e !== document.body; e = e.parentElement) {
        const ox = getComputedStyle(e).overflowX;
        if ((ox === "auto" || ox === "scroll") && e.scrollWidth > e.clientWidth + 1) return e;
      }
      return null;
    };

    const problemas: ProblemasDeLayout = { scrollHorizontal: [], textosCortados: [], solapes: [], tapados: [], fueraDePantalla: [] };

    // 1) Scroll horizontal de la página.
    const de = document.documentElement;
    if (de.scrollWidth > ancho + 1) {
      const culpables: string[] = [];
      document.querySelectorAll("body *").forEach((el) => {
        if (!visible(el)) return;
        const r = el.getBoundingClientRect();
        if (r.right > ancho + 1 && !scrollerH(el) && !el.closest("[data-scroll-h]")) culpables.push(etiqueta(el));
      });
      problemas.scrollHorizontal.push(`la página mide ${de.scrollWidth}px en una pantalla de ${ancho}px. Se pasan: ${culpables.slice(0, 4).join(", ")}`);
    }

    // 2) Textos: cortados por un overflow, o fuera de la pantalla.
    interface Linea {
      el: Element;
      rect: DOMRect;
      texto: string;
    }
    const lineas: Linea[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const rango = document.createRange();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = (n.textContent ?? "").trim();
      const p = n.parentElement;
      if (!t || !p || !visible(p)) continue;
      // El dibujo del plano (SVG) escala sus rótulos: no es texto de la interfaz.
      if (p.closest("svg")) continue;
      rango.selectNodeContents(n);
      for (const r of Array.from(rango.getClientRects())) {
        if (r.width < 1 || r.height < 1) continue;
        lineas.push({ el: p, rect: r, texto: t.slice(0, 30) });
      }
    }

    const cortados = new Set<string>();
    for (const l of lineas) {
      const sc = scrollerH(l.el);
      // Fuera de la pantalla (a los costados), salvo dentro de una región con scroll horizontal propio.
      if (!sc && !l.el.closest("[data-scroll-h]") && (l.rect.right > ancho + 1 || l.rect.left < -1)) {
        cortados.add(`texto fuera de la pantalla: ${etiqueta(l.el)} ("${l.texto}") x=${Math.round(l.rect.left)}..${Math.round(l.rect.right)} de ${ancho}`);
        continue;
      }
      // Cortado por un ancestro con overflow que no sea una elipsis ni un line-clamp intencional.
      for (let e: Element | null = l.el; e && e !== document.body; e = e.parentElement) {
        const cs = getComputedStyle(e);
        const elipsis = cs.textOverflow === "ellipsis";
        const clamp = (cs as unknown as { webkitLineClamp?: string }).webkitLineClamp;
        const conClamp = !!clamp && clamp !== "none";
        const recorta = (v: string) => v === "hidden" || v === "clip";
        if (recorta(cs.overflowX) || recorta(cs.overflowY)) {
          if (elipsis || conClamp) break; // intencional
          const b = e.getBoundingClientRect();
          const cortaX = recorta(cs.overflowX) && (l.rect.right > b.right + 1 || l.rect.left < b.left - 1);
          const cortaY = recorta(cs.overflowY) && (l.rect.bottom > b.bottom + 1 || l.rect.top < b.top - 1);
          // Un elemento "oculto" a propósito (alto 0, colapsado) no cuenta: su texto ni se ve.
          if ((cortaX || cortaY) && b.height > 4 && b.width > 4) {
            cortados.add(`texto cortado por ${etiqueta(e)}: ${etiqueta(l.el)} ("${l.texto}")`);
          }
          break;
        }
        // Una elipsis intencional del propio elemento o de un ancestro cercano.
        if (elipsis) break;
      }
    }
    // Elementos con el contenido más grande que su caja y overflow oculto, sin elipsis: se ve cortado.
    document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
      if (!visible(el)) return;
      const cs = getComputedStyle(el);
      if (cs.overflowX !== "hidden" && cs.overflowX !== "clip") return;
      if (cs.textOverflow === "ellipsis") return;
      const clamp = (cs as unknown as { webkitLineClamp?: string }).webkitLineClamp;
      if (clamp && clamp !== "none") return;
      if (!(el.textContent ?? "").trim()) return;
      if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 4) cortados.add(`contenido más ancho que ${etiqueta(el)} (${el.scrollWidth} > ${el.clientWidth})`);
    });
    problemas.textosCortados.push(...cortados);

    // 3) Controles: dentro del viewport (a los costados) y no tapados.
    const selector = "a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=menuitem], [role=option], [role=radio], summary";
    const controles = [...document.querySelectorAll<HTMLElement>(selector)].filter((el) => {
      if (!visible(el)) return false;
      // Los checkbox/radio de los interruptores están ocultos a la vista (sr-only) y su control visible es el label.
      return true;
    });

    // La parte de arriba que ocupan las barras fijas o pegadas: lo que se scrolleó por debajo de ellas está tapado a propósito.
    let tope = 0;
    document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "sticky") return;
      if (!visible(el)) return;
      const r = el.getBoundingClientRect();
      if (r.top <= 1 && r.bottom > 0 && r.width > ancho * 0.5 && r.bottom < alto * 0.5) tope = Math.max(tope, r.bottom);
    });

    const fuera = new Set<string>();
    const tapados = new Set<string>();
    for (const el of controles) {
      const r = el.getBoundingClientRect();
      const dentroDeScrollH = !!scrollerH(el) || !!el.closest("[data-scroll-h]");
      if (!dentroDeScrollH && (r.right > ancho + 1 || r.left < -1)) fuera.add(`${etiqueta(el)} x=${Math.round(r.left)}..${Math.round(r.right)} de ${ancho}`);

      // ¿Lo que hay en el centro del control es el control (o algo suyo)? Si no, está tapado.
      const cx = Math.min(Math.max(r.left + r.width / 2, 1), ancho - 1);
      const cy = r.top + r.height / 2;
      if (cy < tope + 2 || cy > alto - 1 || cy < 0) continue; // fuera de lo que se ve ahora
      if (dentroDeScrollH && (cx < 0 || cx > ancho)) continue;
      const arriba = document.elementFromPoint(cx, cy);
      if (!arriba) continue;
      if (el.contains(arriba) || arriba.contains(el)) continue;
      // Un <label> que envuelve al control (interruptores) o un control dentro de su etiqueta no cuenta.
      if (arriba.closest("label") && arriba.closest("label")!.contains(el)) continue;
      if ((arriba as HTMLElement).closest?.("nextjs-portal")) continue;
      // Un control dentro de una fila clicable: la fila no lo tapa (es su ancestro). Lo demás, sí.
      tapados.add(`${etiqueta(el)} lo tapa ${etiqueta(arriba)}`);
    }
    problemas.fueraDePantalla.push(...fuera);
    problemas.tapados.push(...tapados);

    // 4) Solapes: cajas de texto y de controles que se cruzan sin que una contenga a la otra.
    interface Caja {
      el: Element;
      rect: DOMRect;
      tipo: "texto" | "control";
    }
    const cajas: Caja[] = [];
    for (const l of lineas) cajas.push({ el: l.el, rect: l.rect, tipo: "texto" });
    for (const c of controles) {
      // Los campos que sólo sirven para el lector de pantalla (sr-only) o un checkbox escondido no cuentan.
      if (c instanceof HTMLInputElement && (c.type === "checkbox" || c.type === "radio")) continue;
      const r = c.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      cajas.push({ el: c, rect: r, tipo: "control" });
    }
    const solapes = new Set<string>();
    const relacionados = (a: Element, b: Element) => a === b || a.contains(b) || b.contains(a);
    for (let i = 0; i < cajas.length; i++) {
      for (let j = i + 1; j < cajas.length; j++) {
        const a = cajas[i];
        const b = cajas[j];
        if (a.tipo === "texto" && b.tipo === "texto" && a.el === b.el) continue; // dos líneas del mismo texto
        if (relacionados(a.el, b.el)) continue; // el texto de un botón, el botón y su texto
        const x = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
        const y = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
        if (x > 3 && y > 3) {
          // Una región con scroll horizontal recorta a sus hijos: lo que está fuera de su caja no se ve.
          solapes.add(`${a.tipo} ${etiqueta(a.el)} se pisa con ${b.tipo} ${etiqueta(b.el)} (${Math.round(x)}x${Math.round(y)} px)`);
        }
      }
    }
    problemas.solapes.push(...solapes);
    return problemas;
  });
}
