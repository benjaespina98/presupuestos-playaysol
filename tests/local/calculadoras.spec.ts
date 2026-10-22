import { expect, test, type Page, type TestInfo } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Nuevo presupuesto de cada tipo contra el portal LOCAL: completar lo mínimo, guardar en la
 * nube, exportar a Word y a PDF (se verifica que el navegador reciba el archivo) y encontrarlo
 * en el Historial. Se corre con `node scripts/e2e-local.mjs calculadoras`.
 */

const EMAIL = process.env.E2E_LOCAL_EMAIL ?? "";
const PASSWORD = process.env.E2E_LOCAL_PASSWORD ?? "";
const FASE = process.env.E2E_FASE ?? "despues";
const HOSTS_PERMITIDOS = new Set(["127.0.0.1", "localhost"]);

type Tipo = { ruta: string; nombre: string; etiquetaCliente?: string; completar: (page: Page) => Promise<void>; exporta: boolean };

const num = async (page: Page, etiqueta: string | RegExp, valor: string) => {
  const campo = page.getByLabel(etiqueta, { exact: typeof etiqueta === "string" }).locator("visible=true").first();
  await campo.fill(valor);
};

const TIPOS: Tipo[] = [
  {
    ruta: "piscinas",
    nombre: "Piscinas",
    exporta: true,
    completar: async (page) => {
      await num(page, "Largo (m)", "8");
      await num(page, "Ancho (m)", "4");
      await num(page, "Subtotal construcción piscina", "10000000");
    },
  },
  {
    ruta: "cercos",
    nombre: "Cercos",
    exporta: true,
    completar: async (page) => num(page, "Metros lineales a cercar (ml)", "24"),
  },
  {
    ruta: "cobertores",
    nombre: "Cobertores",
    exporta: true,
    completar: async (page) => {
      await num(page, "Largo pileta (m)", "8");
      await num(page, "Ancho pileta (m)", "4");
    },
  },
  {
    ruta: "revestimientos",
    nombre: "Revestimientos",
    exporta: true,
    completar: async (page) => {
      await num(page, "Largo pileta (m)", "8");
      await num(page, "Ancho pileta (m)", "4");
    },
  },
  {
    ruta: "losetas",
    nombre: "Plano",
    etiquetaCliente: "Cliente o referencia",
    exporta: false,
    completar: async (page) => {
      await num(page, "Largo (m)", "8");
      await num(page, "Ancho (m)", "4");
    },
  },
];

async function captura(page: Page, info: TestInfo, nombre: string) {
  const dir = path.join("capturas-locales", FASE, info.project.name);
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${nombre}.png`) });
}

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await page.context().route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:" || HOSTS_PERMITIDOS.has(url.hostname)) return route.continue();
    return route.abort();
  });
  await page.goto("/login");
  await page.getByPlaceholder("tu@email.com").fill(EMAIL);
  await page.getByPlaceholder("••••••••").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(/\/dashboard/);
});

for (const tipo of TIPOS) {
  test(`${tipo.nombre}: completar, guardar, exportar y ver en el historial`, async ({ page }, info) => {
    test.setTimeout(180_000);
    const errores: string[] = [];
    page.on("pageerror", (e) => errores.push(e.message));
    const cliente = `Cliente Calc ${tipo.nombre} ${info.project.name}`;

    await page.goto(`/dashboard/${tipo.ruta}`);
    await page.getByLabel(tipo.etiquetaCliente ?? "Señor/Sra").locator("visible=true").first().fill(cliente);
    await tipo.completar(page);
    await captura(page, info, `calc-${tipo.ruta}-completo`);

    // Guardar en la nube: queda en el historial.
    await page.getByRole("button", { name: /Guardar en la nube/ }).locator("visible=true").first().click();
    await expect(page.getByText(/guardado|actualizado/i).locator("visible=true").first()).toBeVisible({ timeout: 30_000 });

    // Exportar: el navegador recibe el archivo (Word y PDF).
    if (tipo.exporta) {
      const word = page.waitForEvent("download", { timeout: 90_000 });
      await page.getByRole("button", { name: /^Word/ }).locator("visible=true").first().click();
      expect((await word).suggestedFilename()).toMatch(/\.docx$/i);

      const pdf = page.waitForEvent("download", { timeout: 90_000 });
      await page.getByRole("button", { name: /^PDF/ }).locator("visible=true").first().click();
      expect((await pdf).suggestedFilename()).toMatch(/\.pdf$/i);
    }

    await page.goto("/dashboard/historial");
    await page.getByPlaceholder("Buscar por nombre de cliente...").fill(cliente);
    await expect(page.getByText(cliente).locator("visible=true").first()).toBeVisible();
    await captura(page, info, `historial-${tipo.ruta}`);
    expect(errores, "errores de JavaScript en la página").toEqual([]);
  });
}
