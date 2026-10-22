import { expect, test, type CDPSession, type Page } from "@playwright/test";
import { iniciarSesion } from "./helpers/sesion";

/**
 * Gestos del celular, sobre las pantallas con lista:
 *
 *  1) Un deslizamiento VERTICAL que empieza sobre la barra de herramientas, el contador, las pestañas o una fila mueve la
 *     PÁGINA (nada de scroll vertical anidado que se lo robe). Se prueba con gestos táctiles reales (toque, arrastre y suelta)
 *     por el protocolo del navegador (`Input.dispatchTouchEvent`), que sólo existe en Chromium.
 *  2) Un deslizamiento HORIZONTAL sobre una región con scroll horizontal mueve SÓLO esa región (la página no se mueve de
 *     costado ni hacia arriba o abajo).
 *  3) Contrato de CSS (vale también en WebKit, donde el gesto no se puede simular): toda región que se desliza de costado
 *     tiene `overflow-y` oculto, `touch-action: pan-x pan-y`, `overscroll-behavior-x: contain`, no tiene altura fija ni
 *     scroll vertical propio; y en una lista no hay ningún contenedor con scroll vertical anidado.
 *
 * Sólo en pantallas de celular (con touch). No guarda ni cambia datos.
 */
const EMAIL = process.env.E2E_LOCAL_EMAIL ?? "";
const PASSWORD = process.env.E2E_LOCAL_PASSWORD ?? "";

const LISTAS = [
  { nombre: "Precios", ruta: "/dashboard/catalogo", tabs: false },
  { nombre: "Materiales", ruta: "/dashboard/catalogo/materiales", tabs: true },
  { nombre: "Proveedores", ruta: "/dashboard/catalogo/proveedores", tabs: true },
  { nombre: "Pedidos", ruta: "/dashboard/catalogo/pedidos", tabs: true },
  { nombre: "Historial", ruta: "/dashboard/historial", tabs: false },
];

/** Un dedo que baja en (x0, y0), se arrastra en 12 pasos hasta (x1, y1) y se levanta. Sólo Chromium. */
async function deslizar(cdp: CDPSession, x0: number, y0: number, x1: number, y1: number) {
  const pasos = 12;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= pasos; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + ((x1 - x0) * i) / pasos, y: y0 + ((y1 - y0) * i) / pasos }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function cargar(page: Page, ruta: string) {
  await page.goto(ruta);
  await page.waitForLoadState("networkidle");
  // Las filas de la lista (no las pestañas): visibles y ya cargadas.
  await page.waitForFunction(
    () => [...document.querySelectorAll<HTMLElement>("main ul > li, main tbody > tr")].filter((e) => !e.closest("nav") && e.offsetParent !== null).length >= 1,
    undefined,
    { timeout: 20_000 }
  );
  await page.evaluate(() => window.scrollTo(0, 0));
}

test.describe("gestos del celular", () => {
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(!isMobile, "sólo en pantallas de celular");
    await iniciarSesion(page, EMAIL, PASSWORD);
  });

  test("contrato de CSS: regiones con scroll horizontal y ningún scroll vertical anidado en las listas", async ({ page }) => {
    const problemas: string[] = [];
    for (const l of LISTAS) {
      await cargar(page, l.ruta);
      const r = await page.evaluate(() => {
        const mal: string[] = [];
        const nombre = (e: Element) => `<${e.tagName.toLowerCase()} class="${String(e.className).slice(0, 50)}">`;
        for (const e of document.querySelectorAll<HTMLElement>("main *, header *")) {
          const cs = getComputedStyle(e);
          const scrollH = cs.overflowX === "auto" || cs.overflowX === "scroll";
          if (scrollH && e.scrollWidth > e.clientWidth + 1) {
            // Una región que se desliza de costado.
            if (cs.overflowY !== "hidden" && cs.overflowY !== "clip") mal.push(`${nombre(e)} desliza de costado pero su overflow-y es ${cs.overflowY}`);
            if (!/pan-x/.test(cs.touchAction) || !/pan-y/.test(cs.touchAction)) mal.push(`${nombre(e)} touch-action = ${cs.touchAction} (debe incluir pan-x y pan-y)`);
            if (cs.overscrollBehaviorX !== "contain") mal.push(`${nombre(e)} overscroll-behavior-x = ${cs.overscrollBehaviorX} (debe ser contain)`);
            if (!/^(auto|0px)$/.test(cs.height) && e.style.height) mal.push(`${nombre(e)} tiene altura fija (${e.style.height})`);
          }
          // Scroll vertical propio dentro de la lista (el contenido es más alto que la caja y la caja se desliza).
          if ((cs.overflowY === "auto" || cs.overflowY === "scroll") && e.scrollHeight > e.clientHeight + 1 && !e.closest("[aria-modal], [role=menu], [role=dialog], [role=listbox]")) {
            mal.push(`${nombre(e)} es un scroll vertical anidado (${e.scrollHeight} > ${e.clientHeight})`);
          }
        }
        return mal;
      });
      problemas.push(...r.map((x) => `${l.nombre}: ${x}`));
    }
    expect(problemas).toEqual([]);
  });

  test("un deslizamiento vertical sobre la barra, el contador, las pestañas y las filas mueve la página", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "el gesto táctil real sólo se puede simular en Chromium; en WebKit vale el contrato de CSS");
    const cdp = await page.context().newCDPSession(page);
    const fallos: string[] = [];
    for (const l of LISTAS) {
      await cargar(page, l.ruta);
      // Una lista corta (pocos pedidos) no llega a hacer scroll: se alarga la página para poder probar el gesto.
      await page.evaluate(() => {
        const relleno = document.createElement("div");
        relleno.style.height = "1600px";
        document.querySelector("main")!.appendChild(relleno);
      });
      const objetivos: { nombre: string; selector: string }[] = [
        { nombre: "la barra de herramientas", selector: "[data-barra-herramientas] input" },
        { nombre: "el botón Filtros", selector: "[data-barra-herramientas] button[aria-haspopup='dialog']" },
        { nombre: "el contador", selector: "p[aria-live='polite']" },
        ...(l.tabs ? [{ nombre: "las pestañas", selector: "nav[aria-label='Secciones de compras'] li >> nth=0" }] : []),
        { nombre: "una fila", selector: "main ul:not(nav ul) > li:visible >> nth=0" },
      ];
      for (const o of objetivos) {
        await page.evaluate(() => window.scrollTo(0, 0));
        const caja = await page.locator(o.selector).first().boundingBox();
        if (!caja) {
          fallos.push(`${l.nombre}: no encuentro ${o.nombre}`);
          continue;
        }
        const x = caja.x + Math.min(caja.width / 2, 40);
        const y = caja.y + caja.height / 2;
        const antes = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
        await deslizar(cdp, x, y + 10, x, y - 340);
        await page.waitForTimeout(350);
        const despues = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
        if (despues.y - antes.y < 80) fallos.push(`${l.nombre}: un deslizamiento sobre ${o.nombre} no movió la página (scrollY ${antes.y} → ${despues.y})`);
        if (Math.abs(despues.x - antes.x) > 1) fallos.push(`${l.nombre}: un deslizamiento vertical sobre ${o.nombre} movió la página de costado (scrollX ${antes.x} → ${despues.x})`);
      }
    }
    expect(fallos).toEqual([]);
  });

  test("un deslizamiento horizontal sobre una región con scroll horizontal mueve sólo esa región", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "el gesto táctil real sólo se puede simular en Chromium; en WebKit vale el contrato de CSS");
    // En una región armada a propósito con las clases del portal (`scroll-h`): la que usan las tablas anchas.
    await page.goto("/dashboard/catalogo/materiales");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => {
      const caja = document.createElement("div");
      caja.id = "region-prueba";
      caja.className = "scroll-h";
      caja.style.cssText = "position:relative;margin:8px 16px;background:#eee";
      caja.innerHTML = `<div style="width:900px;height:60px;white-space:nowrap">Una región ancha que se desliza de costado, como una tabla</div>`;
      document.querySelector("main")!.prepend(caja);
    });
    const cdp = await page.context().newCDPSession(page);
    const caja = (await page.locator("#region-prueba").boundingBox())!;
    const antes = await page.evaluate(() => ({ px: window.scrollX, py: window.scrollY, rl: document.getElementById("region-prueba")!.scrollLeft }));
    await deslizar(cdp, caja.x + caja.width / 2 + 80, caja.y + caja.height / 2, caja.x + caja.width / 2 - 80, caja.y + caja.height / 2);
    await page.waitForTimeout(350);
    const despues = await page.evaluate(() => ({ px: window.scrollX, py: window.scrollY, rl: document.getElementById("region-prueba")!.scrollLeft }));
    expect(despues.rl, "la región se movió de costado").toBeGreaterThan(antes.rl + 40);
    expect(despues.px, "la página no se movió de costado").toBe(antes.px);
    expect(despues.py, "la página no subió ni bajó").toBe(antes.py);
  });
});
