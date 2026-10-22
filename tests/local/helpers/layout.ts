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
 * Reglas que NO cuentan como falla (son a propósito):
 *  - una elipsis (`truncate`) o un `line-clamp`: el texto que no entra se recorta;
 *  - lo que está dentro de una región con scroll (se llega deslizando);
 *  - lo que está dentro de un <details> cerrado;
 *  - una ventana modal abierta tapa el resto de la pantalla (se mide sólo lo de adentro), y un menú o panel flotante
 *    pasa por encima de lo que tiene debajo;
 *  - los íconos y botones "absolutos" que viven dentro de un campo (el ✕ de limpiar de un buscador);
 *  - una barra fija o pegada pasa por encima del contenido que se desliza debajo.
 *
 * Lo de contraste, tipografía y zonas táctiles está en `medir.ts`. Sólo mira: no toca nada de la página.
 * Ignora el indicador de desarrollo de Next (`nextjs-portal`).
 */
export interface ProblemasDeLayout {
  scrollDePagina: string[];
  textosCortados: string[];
  solapes: string[];
  tapados: string[];
  fueraDePantalla: string[];
}

export async function medirLayout(page: Page): Promise<ProblemasDeLayout> {
  // El ancho del DISPOSITIVO (el que se configuró), no `window.innerWidth`: con una página más ancha que la pantalla, el
  // navegador del celular la achica para que entre (shrink-to-fit) y `innerWidth` pasa a valer lo mismo que la página:
  // ese scroll horizontal no se vería. Así se detecta aunque el navegador "arregle" la escala.
  const anchoDispositivo = page.viewportSize()?.width ?? 0;
  return page.evaluate((anchoConfigurado) => {
    const ancho = anchoConfigurado || window.innerWidth;
    const alto = window.innerHeight;
    const nombre = (el: Element) =>
      ((el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || el.tagName).trim().replace(/\s+/g, " ")).slice(0, 40);
    const etiqueta = (el: Element) => `<${el.tagName.toLowerCase()}> "${nombre(el)}"`;
    // Lo que está dentro de un <details> cerrado (salvo su <summary>) no se ve, aunque el navegador le calcule una caja.
    const enDetallesCerrado = (el: Element) => {
      for (let d = el.closest("details:not([open])"); d; d = d.parentElement?.closest("details:not([open])") ?? null) {
        const sum = el.closest("summary");
        if (!sum || sum.parentElement !== d) return true;
      }
      return false;
    };
    const oculto = (el: Element) => !!el.closest("nextjs-portal, [aria-hidden=true], .sr-only, [inert], [hidden]") || enDetallesCerrado(el);
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

    // La ventana modal abierta (si hay una) y los paneles flotantes (menús, selectores): pasan por encima a propósito.
    // (con dos ventanas apiladas, la de encima: la última del documento).
    const modal = [...document.querySelectorAll<HTMLElement>('[aria-modal="true"]')].filter((m) => visible(m)).pop() ?? null;
    const SUPERPUESTO = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';
    const enSuperpuesto = (el: Element) => !!el.closest(SUPERPUESTO);
    /** ¿Entra en lo que se mide? Con un modal abierto, sólo lo de adentro. */
    const medible = (el: Element) => !modal || modal.contains(el);

    const problemas: ProblemasDeLayout = { scrollDePagina: [], textosCortados: [], solapes: [], tapados: [], fueraDePantalla: [] };

    // 1) Scroll horizontal de la página.
    const de = document.documentElement;
    const achicada = !!window.visualViewport && window.visualViewport.scale < 0.98;
    if (de.scrollWidth > ancho + 1 || achicada) {
      const culpables: string[] = [];
      document.querySelectorAll("body *").forEach((el) => {
        if (!visible(el)) return;
        const r = el.getBoundingClientRect();
        if (r.right > ancho + 1 && !scrollerH(el) && !el.closest("[data-scroll-h]")) culpables.push(etiqueta(el));
      });
      problemas.scrollDePagina.push(`la página mide ${de.scrollWidth}px en una pantalla de ${ancho}px${achicada ? " (el navegador la achicó para que entre)" : ""}. Se pasan: ${culpables.slice(0, 4).join(", ")}`);
    }

    // 2) Textos: una línea por cada caja de texto, con su caja "real" y la parte que se ve (recortada por los overflow).
    interface Linea {
      el: Element;
      rect: DOMRect;
      /** Lo que queda a la vista después de los recortes de los ancestros (null = no se ve nada). */
      vista: { left: number; right: number; top: number; bottom: number } | null;
      texto: string;
    }
    const lineas: Linea[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const rango = document.createRange();
    const recortar = (el: Element, r: DOMRect) => {
      let v: { left: number; right: number; top: number; bottom: number } | null = { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      for (let e: Element | null = el; e && e !== document.body && v; e = e.parentElement) {
        const cs = getComputedStyle(e);
        const clip = (o: string) => o !== "visible";
        if (!clip(cs.overflowX) && !clip(cs.overflowY)) continue;
        const b = e.getBoundingClientRect();
        v = {
          left: clip(cs.overflowX) ? Math.max(v.left, b.left) : v.left,
          right: clip(cs.overflowX) ? Math.min(v.right, b.right) : v.right,
          top: clip(cs.overflowY) ? Math.max(v.top, b.top) : v.top,
          bottom: clip(cs.overflowY) ? Math.min(v.bottom, b.bottom) : v.bottom,
        };
        if (v.right - v.left < 1 || v.bottom - v.top < 1) v = null;
      }
      return v;
    };
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = (n.textContent ?? "").trim();
      const p = n.parentElement;
      if (!t || !p || !visible(p)) continue;
      // El dibujo del plano (SVG) escala sus rótulos: no es texto de la interfaz.
      if (p.closest("svg")) continue;
      rango.selectNodeContents(n);
      for (const r of Array.from(rango.getClientRects())) {
        if (r.width < 1 || r.height < 1) continue;
        lineas.push({ el: p, rect: r, vista: recortar(p, r), texto: t.slice(0, 30) });
      }
    }

    const cortados = new Set<string>();
    for (const l of lineas) {
      if (!medible(l.el)) continue;
      // Se sube por los ancestros: lo que recorta un overflow oculto (sin elipsis ni line-clamp) está cortado; lo que está
      // dentro de una región con scroll no (se llega deslizando); una elipsis o un line-clamp es intencional.
      let ejeX = true;
      let ejeY = true;
      let intencional = false;
      for (let e: Element | null = l.el; e && e !== document.body && (ejeX || ejeY); e = e.parentElement) {
        const cs = getComputedStyle(e);
        const clamp = (cs as unknown as { webkitLineClamp?: string }).webkitLineClamp;
        const recortaX = cs.overflowX === "hidden" || cs.overflowX === "clip";
        const recortaY = cs.overflowY === "hidden" || cs.overflowY === "clip";
        const scrollX = cs.overflowX === "auto" || cs.overflowX === "scroll";
        const scrollY = cs.overflowY === "auto" || cs.overflowY === "scroll";
        if ((recortaX || recortaY) && (cs.textOverflow === "ellipsis" || (!!clamp && clamp !== "none"))) {
          intencional = true;
          break;
        }
        const b = e.getBoundingClientRect();
        if (ejeX && recortaX && b.width > 4 && (l.rect.right > b.right + 1 || l.rect.left < b.left - 1)) {
          cortados.add(`texto cortado por ${etiqueta(e)}: ${etiqueta(l.el)} ("${l.texto}") x=${Math.round(l.rect.left)}..${Math.round(l.rect.right)} dentro de ${Math.round(b.left)}..${Math.round(b.right)}`);
          ejeX = false;
        }
        if (ejeY && recortaY && b.height > 4 && (l.rect.bottom > b.bottom + 1 || l.rect.top < b.top - 1)) {
          cortados.add(`texto cortado por ${etiqueta(e)}: ${etiqueta(l.el)} ("${l.texto}") y=${Math.round(l.rect.top)}..${Math.round(l.rect.bottom)} dentro de ${Math.round(b.top)}..${Math.round(b.bottom)}`);
          ejeY = false;
        }
        if (scrollX) ejeX = false;
        if (scrollY) ejeY = false;
      }
      // Fuera de la pantalla (a los costados), salvo dentro de una región con scroll horizontal propio o con elipsis.
      if (!intencional && ejeX && !l.el.closest("[data-scroll-h]") && (l.rect.right > ancho + 1 || l.rect.left < -1)) {
        cortados.add(`texto fuera de la pantalla: ${etiqueta(l.el)} ("${l.texto}") x=${Math.round(l.rect.left)}..${Math.round(l.rect.right)} de ${ancho}`);
      }
    }
    // Elementos con el contenido más grande que su caja y overflow oculto, sin elipsis: se ve cortado.
    document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
      if (!visible(el) || !medible(el)) return;
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
    // Un control que queda fuera de la parte visible de su contenedor con scroll no cuenta (se llega deslizando).
    const vistaDe = (el: Element) => {
      const r = el.getBoundingClientRect();
      return recortar(el, r);
    };
    const controles = [...document.querySelectorAll<HTMLElement>(selector)].filter((el) => visible(el) && medible(el));

    // Lo que ocupan las barras fijas o pegadas, arriba y abajo: lo que se desliza por debajo de ellas está tapado a propósito
    // (se llega scrolleando). Con la página en el principio no hay nada deslizado arriba; en el final, nada abajo: ahí un
    // control tapado por una barra es de verdad inalcanzable.
    const alPrincipio = window.scrollY <= 2;
    const alFinal = window.scrollY + alto >= de.scrollHeight - 2;
    let tope = 0;
    let piso = alto;
    document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "sticky") return;
      if (!visible(el)) return;
      const r = el.getBoundingClientRect();
      if (r.width <= ancho * 0.5) return;
      // Las barras y encabezados pegados arriba (la barra de herramientas, el encabezado de la tabla, el del grupo).
      if (r.top < alto * 0.3 && r.bottom > 0 && r.bottom < alto * 0.5) tope = Math.max(tope, r.bottom);
      if (r.bottom >= alto - 1 && r.top > alto * 0.5) piso = Math.min(piso, r.top);
    });
    /** Un fondo que cubre toda la pantalla (detrás de un menú abierto, para cerrarlo al tocar afuera). */
    const esFondo = (el: Element) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.position === "fixed" && r.width >= ancho - 2 && r.height >= alto - 2;
    };

    const fuera = new Set<string>();
    const tapados = new Set<string>();
    for (const el of controles) {
      const r = el.getBoundingClientRect();
      const dentroDeScrollH = !!scrollerH(el) || !!el.closest("[data-scroll-h]");
      if (!dentroDeScrollH && (r.right > ancho + 1 || r.left < -1)) fuera.add(`${etiqueta(el)} x=${Math.round(r.left)}..${Math.round(r.right)} de ${ancho}`);

      // ¿Lo que hay encima del control es el control (o algo suyo)? Se prueban nueve puntos de su caja: si dos o más
      // están tapados por otra cosa (una flecha flotante que le muerde una esquina, una barra), está tapado.
      const vista = vistaDe(el);
      if (!vista) continue; // recortado por un contenedor con scroll
      let tapadoEn = 0;
      let culpable: Element | null = null;
      for (const fx of [0.12, 0.5, 0.88]) {
        for (const fy of [0.2, 0.5, 0.8]) {
          const px = Math.min(Math.max(vista.left + (vista.right - vista.left) * fx, 1), ancho - 1);
          const py = vista.top + (vista.bottom - vista.top) * fy;
          if (py > alto - 1 || py < 0) continue; // fuera de lo que se ve ahora
          if (!alPrincipio && py < tope + 2) continue; // deslizado por debajo de la barra de arriba
          if (!alFinal && py > piso - 2) continue; // todavía falta scrollear hasta él: la barra de abajo pasa por encima
          const arriba = document.elementFromPoint(px, py);
          if (!arriba) continue;
          if (el.contains(arriba) || arriba.contains(el)) continue;
          // Un <label> que envuelve al control (interruptores) o un control dentro de su etiqueta no cuenta.
          if (arriba.closest("label") && arriba.closest("label")!.contains(el)) continue;
          if ((arriba as HTMLElement).closest?.("nextjs-portal")) continue;
          if (esFondo(arriba)) continue;
          // Un menú o panel flotante abierto pasa por encima de lo de abajo a propósito.
          if (enSuperpuesto(arriba) && !enSuperpuesto(el)) continue;
          tapadoEn++;
          culpable = arriba;
        }
      }
      if (tapadoEn >= 2 && culpable) tapados.add(`${etiqueta(el)} lo tapa ${etiqueta(culpable)} (${tapadoEn} de 9 puntos)`);
    }
    problemas.fueraDePantalla.push(...fuera);
    problemas.tapados.push(...tapados);

    // 4) Solapes: cajas de texto y de controles que se cruzan sin que una contenga a la otra.
    interface Caja {
      el: Element;
      rect: { left: number; right: number; top: number; bottom: number };
      tipo: "texto" | "control";
    }
    const cajas: Caja[] = [];
    for (const l of lineas) if (l.vista && medible(l.el)) cajas.push({ el: l.el, rect: l.vista, tipo: "texto" });
    for (const c of controles) {
      // Los campos que sólo sirven para el lector de pantalla (sr-only) o un checkbox escondido no cuentan.
      if (c instanceof HTMLInputElement && (c.type === "checkbox" || c.type === "radio")) continue;
      const v = vistaDe(c);
      if (!v || v.right - v.left < 2 || v.bottom - v.top < 2) continue;
      cajas.push({ el: c, rect: v, tipo: "control" });
    }
    const solapes = new Set<string>();
    const relacionados = (a: Element, b: Element) => a === b || a.contains(b) || b.contains(a);
    // "Flotante": fijo, o pegado con la página scrolleada (un encabezado sticky pasa por encima de las filas que se le deslizan
    // debajo, y se queda al final de su bloque encima de la última; lejos de la franja de arriba, es contenido común). Con la página en el principio, lo pegado es contenido común.
    const flotante = (el: Element) => {
      for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) {
        const p = getComputedStyle(e).position;
        if (p === "fixed") return e;
        // Pegado sólo si está en la franja de arriba, donde viven las barras y encabezados pegados.
        if (p === "sticky" && !alPrincipio && e.getBoundingClientRect().top < alto * 0.25) return e;
      }
      return null;
    };
    const absoluto = (el: Element) => getComputedStyle(el).position === "absolute" || !!el.closest("[class*='absolute']");
    for (let i = 0; i < cajas.length; i++) {
      for (let j = i + 1; j < cajas.length; j++) {
        const a = cajas[i];
        const b = cajas[j];
        if (a.tipo === "texto" && b.tipo === "texto" && a.el === b.el) continue; // dos líneas del mismo texto
        if (relacionados(a.el, b.el)) continue; // el texto de un botón, el botón y su texto
        // Lo fijo o pegado (la barra de herramientas, la de guardar) pasa por encima del contenido que se desliza.
        const fa = flotante(a.el);
        const fb = flotante(b.el);
        if (fa !== fb && (fa === null || fb === null)) continue;
        // Dos cosas pegadas a la vez: un encabezado de grupo que se va deslizando por debajo de la barra de herramientas (o de
        // otro encabezado) es lo normal. Sólo se comparan dos elementos FIJOS entre sí (un aviso contra la flecha).
        if (fa && fb && (getComputedStyle(fa).position === "sticky" || getComputedStyle(fb).position === "sticky")) continue;
        // Un panel flotante (menú, selector) pasa por encima de lo que tiene debajo.
        if (enSuperpuesto(a.el) !== enSuperpuesto(b.el)) continue;
        // Los íconos y botones "absolutos" que viven dentro de un campo (limpiar búsqueda, lupa) se apoyan a propósito.
        if (absoluto(a.el) || absoluto(b.el)) continue;
        const x = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
        const y = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
        if (x > 3 && y > 3) {
          solapes.add(`${a.tipo} ${etiqueta(a.el)} se pisa con ${b.tipo} ${etiqueta(b.el)} (${Math.round(x)}x${Math.round(y)} px)`);
        }
      }
    }
    problemas.solapes.push(...solapes);
    return problemas;
  }, anchoDispositivo);
}
