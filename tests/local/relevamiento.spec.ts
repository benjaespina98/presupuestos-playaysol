import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Recorre todas las pantallas del portal LOCAL y saca una captura de cada una.
 * Se corre con `node scripts/e2e-local.mjs relevamiento` y la variable E2E_FASE
 * ("antes" o "despues") decide la carpeta: capturas-locales/<fase>/<viewport>/.
 * Sólo mira: no guarda ni cambia datos. Bloquea todo lo que no sea localhost.
 */

const EMAIL = process.env.E2E_LOCAL_EMAIL ?? "";
const PASSWORD = process.env.E2E_LOCAL_PASSWORD ?? "";
const FASE = process.env.E2E_FASE ?? "antes";
const HOSTS_PERMITIDOS = new Set(["127.0.0.1", "localhost"]);

const PANTALLAS: Array<[string, string]> = [
  ["inicio-nuevo", "/dashboard"],
  ["calc-piscinas", "/dashboard/piscinas"],
  ["calc-cercos", "/dashboard/cercos"],
  ["calc-cobertores", "/dashboard/cobertores"],
  ["calc-revestimientos", "/dashboard/revestimientos"],
  ["calc-losetas", "/dashboard/losetas"],
  ["historial", "/dashboard/historial"],
  ["catalogo-precios", "/dashboard/catalogo"],
  ["catalogo-materiales", "/dashboard/catalogo/materiales"],
  ["catalogo-proveedores", "/dashboard/catalogo/proveedores"],
  ["catalogo-armar-pedido", "/dashboard/catalogo/pedido"],
  ["catalogo-pedidos", "/dashboard/catalogo/pedidos"],
];

async function captura(page: Page, nombre: string, project: string, completa = false) {
  const dir = path.join("capturas-locales", FASE, project);
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${nombre}.png`), fullPage: completa });
}

test("relevamiento de pantallas", async ({ page }, info) => {
  test.setTimeout(300_000);
  expect(EMAIL && PASSWORD, "faltan las credenciales de la prueba").toBeTruthy();
  const errores: string[] = [];
  const bloqueados: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  await page.context().route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:" || HOSTS_PERMITIDOS.has(url.hostname)) return route.continue();
    bloqueados.push(url.hostname);
    return route.abort();
  });

  await page.goto("/login");
  await captura(page, "login", info.project.name);
  await page.getByPlaceholder("tu@email.com").fill(EMAIL);
  await page.getByPlaceholder("••••••••").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(/\/dashboard/);

  const hallazgos: string[] = [];
  for (const [nombre, ruta] of PANTALLAS) {
    await page.goto(ruta);
    await page.waitForLoadState("networkidle");
    await captura(page, nombre, info.project.name, true);

    // Controles medibles: scroll horizontal de la página y zonas táctiles chicas (en celular, menos de 44 px).
    const medidas = await page.evaluate(() => {
      const chicos: string[] = [];
      document
        .querySelectorAll<HTMLElement>("a[href], button, input:not([type=hidden]):not(.sr-only), select, textarea, [role=button], [role=switch]")
        .forEach((el) => {
          const r = el.getBoundingClientRect();
          const visible = r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
          if (!visible || el.closest("[aria-hidden=true]")) return;
          if (r.height < 43.5 || r.width < 43.5) {
            const nombre = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || el.tagName).trim().slice(0, 40);
            chicos.push(`${el.tagName.toLowerCase()} "${nombre}" ${Math.round(r.width)}x${Math.round(r.height)}`);
          }
        });
      const filasVisibles = [...document.querySelectorAll<HTMLElement>("main li")].filter((li) => !li.closest("nav")).filter((li) => {
        const r = li.getBoundingClientRect();
        return r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight;
      }).length;
      return { scrollHorizontal: document.documentElement.scrollWidth > window.innerWidth + 1, chicos: [...new Set(chicos)].slice(0, 12), filasVisibles };
    });
    hallazgos.push(`METRICA ${nombre}: filas visibles sin scroll=${medidas.filasVisibles}`);
    if (medidas.scrollHorizontal) hallazgos.push(`${nombre}: SCROLL HORIZONTAL`);
    for (const c of medidas.chicos) hallazgos.push(`${nombre}: zona chica ${c}`);
  }
  fs.writeFileSync(path.join("capturas-locales", FASE, info.project.name, "_medidas.txt"), hallazgos.join("\n") || "sin hallazgos");

  // Un diálogo de stock y el historial, que es donde más se nota el cambio.
  await page.goto("/dashboard/catalogo");
  await page.waitForLoadState("networkidle");
  const fila = page.locator("li").filter({ hasText: /Caribe 550|Caribe 650/ }).first();
  if (await fila.count()) {
    await fila.scrollIntoViewIfNeeded();
    await captura(page, "catalogo-fila-stock", info.project.name);
    await fila.getByRole("button", { name: /^Más acciones de/ }).click().catch(() => undefined);
    await page.getByRole("menuitem", { name: "Ingreso", exact: true }).click().catch(() => undefined);
    await captura(page, "dialogo-ingreso", info.project.name);
    await page.keyboard.press("Escape");
  }

  fs.writeFileSync(
    path.join("capturas-locales", FASE, info.project.name, "_errores.txt"),
    `errores de página: ${errores.join(" | ") || "ninguno"}\nbloqueados: ${[...new Set(bloqueados)].join(",") || "ninguno"}\n`,
  );
  expect(bloqueados).toEqual([]);
});
