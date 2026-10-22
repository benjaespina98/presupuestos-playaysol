import { test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { iniciarSesion } from "./helpers/sesion";

/**
 * Mide, en cada pantalla con lista, lo que se pide en el informe: alto de la barra de herramientas, desde dónde
 * empieza la lista, cuántas filas COMPLETAS entran sin scroll, cuántas regiones con scroll horizontal quedan y si la
 * página tiene scroll horizontal. Con E2E_FASE=antes|despues lo guarda en capturas-locales/<fase>/_metricas-<proyecto>.json
 * (ignorada por git). Sólo mira.
 */
const EMAIL = process.env.E2E_LOCAL_EMAIL ?? "";
const PASSWORD = process.env.E2E_LOCAL_PASSWORD ?? "";
const FASE = process.env.E2E_FASE ?? "despues";

const PANTALLAS = [
  { nombre: "Precios", ruta: "/dashboard/catalogo" },
  { nombre: "Materiales", ruta: "/dashboard/catalogo/materiales" },
  { nombre: "Proveedores", ruta: "/dashboard/catalogo/proveedores" },
  { nombre: "Pedidos", ruta: "/dashboard/catalogo/pedidos" },
  { nombre: "Historial", ruta: "/dashboard/historial" },
];

test("métricas de las pantallas con lista", async ({ page }, info) => {
  test.setTimeout(300_000);
  await iniciarSesion(page, EMAIL, PASSWORD);
  const salida: Record<string, unknown> = {};
  for (const p of PANTALLAS) {
    await page.goto(p.ruta);
    await page.waitForLoadState("networkidle");
    await page.waitForSelector("main li, main tbody tr", { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(500);
    salida[p.nombre] = await page.evaluate(() => {
      const alto = window.innerHeight;
      const filas = [...document.querySelectorAll<HTMLElement>("main ul > li, main tbody > tr, main div.sm\\:hidden > div")].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 20 && getComputedStyle(e).display !== "none" && !e.closest("nav, [aria-label='Filtros activos']");
      });
      const tabs = document.querySelector<HTMLElement>("main nav");
      const base = tabs ? tabs.getBoundingClientRect().bottom : (document.querySelector("header")?.getBoundingClientRect().bottom ?? 0);
      const grupo = document.querySelector<HTMLElement>("main section[aria-label] h3, main section[aria-label]");
      const primeraLista = [filas[0]?.getBoundingClientRect().top, grupo?.getBoundingClientRect().top]
        .filter((v): v is number => typeof v === "number" && v > base - 1)
        .sort((a, b) => a - b)[0];
      const barra = document.querySelector<HTMLElement>("[data-barra-herramientas]") ?? document.querySelector<HTMLElement>("[data-barra-listado]");
      const completas = filas.filter((f) => {
        const r = f.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= alto;
      });
      const scrollers = [...document.querySelectorAll<HTMLElement>("main *")].filter((e) => {
        const o = getComputedStyle(e).overflowX;
        return (o === "auto" || o === "scroll") && e.scrollWidth > e.clientWidth + 1;
      }).length;
      const encabezado = document.querySelector<HTMLElement>("header");
      const alturas = filas.slice(0, 12).map((f) => Math.round(f.getBoundingClientRect().height));
      return {
        altoBarra: barra && barra.hasAttribute("data-barra-herramientas") ? Math.round(barra.getBoundingClientRect().height) : null,
        bloqueDeHerramientas: primeraLista !== undefined ? Math.round(primeraLista - base) : null,
        tabsTerminanEn: Math.round(base),
        altoEncabezadoPagina: encabezado ? Math.round(encabezado.getBoundingClientRect().bottom) : null,
        listaEmpiezaEn: primeraLista !== undefined ? Math.round(primeraLista) : null,
        filasCompletas: completas.length,
        altoFilaTipico: alturas.length ? Math.round(alturas.reduce((a, b) => a + b, 0) / alturas.length) : null,
        regionesConScrollHorizontal: scrollers,
        scrollHorizontalDePagina: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });
  }
  const dir = path.join("capturas-locales", FASE);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `_metricas-${info.project.name}.json`), JSON.stringify(salida, null, 2));
});
