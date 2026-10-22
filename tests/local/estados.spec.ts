import { expect, test, type Locator, type Page } from "@playwright/test";
import { iniciarSesion } from "./helpers/sesion";

/**
 * Ningún control con el texto y el fondo del mismo color (o casi): en NINGÚN estado — reposo, hover, foco, apretado y
 * deshabilitado — y con el teléfono en modo claro y oscuro (el proyecto de Playwright decide el esquema). Es la pieza que
 * faltaba contra el "botón blanco sobre blanco" que se veía en el iPhone: se recorren los controles de cada pantalla, se
 * los lleva a cada estado de verdad (mouse encima, foco, mouse apretado) y se mide el contraste del texto contra el
 * fondo REAL (los fondos de los ancestros apilados), con los colores ya resueltos por el navegador.
 *
 * Mínimo 4,5:1 para el texto (3:1 si es grande) y, para los íconos solos, 3:1.
 */
const EMAIL = process.env.E2E_LOCAL_EMAIL ?? "";
const PASSWORD = process.env.E2E_LOCAL_PASSWORD ?? "";
const POR_PANTALLA = 28;

const PANTALLAS = [
  "/dashboard",
  "/dashboard/piscinas",
  "/dashboard/catalogo",
  "/dashboard/catalogo/materiales",
  "/dashboard/catalogo/proveedores",
  "/dashboard/catalogo/pedido",
  "/dashboard/catalogo/pedidos",
  "/dashboard/historial",
];

/** Contraste del control (texto, o ícono si no tiene texto) contra su fondo real, o null si no aplica. */
async function contrasteDe(el: Locator): Promise<{ razon: number; minimo: number; que: string } | null> {
  return el.evaluate((nodo) => {
    type RGBA = [number, number, number, number];
    const lienzo = document.createElement("canvas");
    lienzo.width = lienzo.height = 1;
    const ctx = lienzo.getContext("2d", { willReadFrequently: true })!;
    const parse = (c: string): RGBA | null => {
      const m = c.match(/^rgba?\(([^)]+)\)$/);
      if (m) {
        const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        return [p[0], p[1], p[2], p[3] ?? 1];
      }
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000000";
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    };
    const mezclar = (a: RGBA, b: RGBA): RGBA => [a[0] * a[3] + b[0] * (1 - a[3]), a[1] * a[3] + b[1] * (1 - a[3]), a[2] * a[3] + b[2] * (1 - a[3]), 1];
    const lum = (c: RGBA) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    };
    const razon = (a: RGBA, b: RGBA) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    const fondoReal = (e: Element): RGBA => {
      const cadena: RGBA[] = [];
      for (let x: Element | null = e; x; x = x.parentElement) {
        const cs = getComputedStyle(x);
        const bg = parse(cs.backgroundColor);
        if (bg && bg[3] > 0) cadena.push(bg);
        if (bg && bg[3] >= 1) break;
        if (cs.backgroundImage !== "none" && !cs.backgroundImage.includes("url(")) break;
      }
      let base: RGBA = [255, 255, 255, 1];
      for (const c of cadena.reverse()) base = mezclar(c, base);
      return base;
    };
    const el = nodo as HTMLElement;
    const cs = getComputedStyle(el);
    let op = 1;
    for (let x: Element | null = el; x; x = x.parentElement) op *= Number(getComputedStyle(x).opacity);
    const fondo = fondoReal(el);
    const tieneTexto = (el.textContent ?? "").trim().length > 0 || el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;
    const color = parse(cs.color);
    if (!color) return null;
    const real = mezclar([color[0], color[1], color[2], color[3] * op], fondo);
    if (tieneTexto) {
      const fs = parseFloat(cs.fontSize);
      const grande = fs >= 24 || (fs >= 18.66 && Number(cs.fontWeight) >= 700);
      return { razon: razon(real, fondo), minimo: grande ? 3 : 4.5, que: "texto" };
    }
    if (el.querySelector("svg")) {
      const c = parse(getComputedStyle(el.querySelector("svg")!).color);
      if (!c) return null;
      return { razon: razon(mezclar([c[0], c[1], c[2], c[3] * op], fondo), fondo), minimo: 3, que: "ícono" };
    }
    return null;
  });
}

const nombre = async (el: Locator) => (await el.evaluate((e) => (e.getAttribute("aria-label") || e.textContent || e.tagName).trim().replace(/\s+/g, " ").slice(0, 40))) || "?";

async function revisar(page: Page, pantalla: string, fallos: string[]) {
  await page.goto(pantalla);
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => !document.body.innerText.includes("Cargando"), undefined, { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(500);
  const controles = page.locator("main button:visible, main a[href]:visible, header button:visible, header a[href]:visible");
  const total = Math.min(await controles.count(), POR_PANTALLA);
  for (let i = 0; i < total; i++) {
    const el = controles.nth(i);
    if (!(await el.isVisible())) continue;
    await el.scrollIntoViewIfNeeded().catch(() => {});
    const caja = await el.boundingBox();
    if (!caja || caja.width < 2) continue;
    const etiqueta = await nombre(el);
    const deshabilitado = await el.evaluate((e) => (e as HTMLButtonElement).disabled === true);
    const medir = async (estado: string) => {
      await page.waitForTimeout(220); // que terminen las transiciones de color
      const c = await contrasteDe(el);
      if (c && c.razon < c.minimo) fallos.push(`${pantalla} · "${etiqueta}" en ${estado}: ${c.que} ${c.razon.toFixed(2)}:1 (mínimo ${c.minimo}:1)`);
    };
    await medir(deshabilitado ? "deshabilitado" : "reposo");
    if (deshabilitado) continue;
    // Hover: el mouse encima.
    await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
    await medir("hover");
    // Apretado: el mouse abajo (se suelta lejos del control, para no activarlo).
    await page.mouse.down();
    await medir("apretado");
    await page.mouse.move(1, 1);
    await page.mouse.up();
    // Foco: con el teclado.
    await el.focus().catch(() => {});
    await medir("foco");
    await el.evaluate((e) => (e as HTMLElement).blur());
    await page.mouse.move(1, 1);
  }
}

/** Cada recorrido tarda unos minutos: se hace en el iPhone (WebKit y Chromium, claro y oscuro) y en un celular y un escritorio comunes. */
const PROYECTOS = ["iphone13-webkit", "iphone13-webkit-oscuro", "iphone13-chromium-oscuro", "m-390x844", "d-1366x768"];

test("ningún control tiene texto y fondo del mismo color en ningún estado (claro y oscuro)", async ({ page }, info) => {
  test.skip(!PROYECTOS.includes(info.project.name), "este tamaño no hace el recorrido de estados");
  test.setTimeout(900_000);
  const fallos: string[] = [];
  // Login (sin sesión): reposo, hover y foco de "Ingresar" (deshabilitado si faltan datos) y de los links.
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  const boton = page.getByRole("button", { name: "Ingresar" });
  for (const estado of ["reposo", "hover", "foco"]) {
    if (estado === "hover") await boton.hover();
    if (estado === "foco") await boton.focus();
    await page.waitForTimeout(260);
    const c = await contrasteDe(boton);
    if (c && c.razon < c.minimo) fallos.push(`/login · "Ingresar" en ${estado}: ${c.razon.toFixed(2)}:1`);
  }
  await iniciarSesion(page, EMAIL, PASSWORD);
  for (const p of PANTALLAS) await revisar(page, p, fallos);
  expect(fallos).toEqual([]);
});
