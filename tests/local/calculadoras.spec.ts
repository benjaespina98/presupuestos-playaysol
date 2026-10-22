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

type Tipo = { ruta: string; nombre: string; etiquetaCliente?: string; completar: (page: Page) => Promise<void>; exporta: boolean; esPlano?: boolean };

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
    exporta: true,
    esPlano: true,
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
    const cliente = `Ñandú "Calc" <${tipo.nombre}> ${info.project.name}`;

    await page.goto(`/dashboard/${tipo.ruta}`);
    await page.getByLabel(tipo.etiquetaCliente ?? "Señor/Sra").locator("visible=true").first().fill(cliente);
    await tipo.completar(page);
    await captura(page, info, `calc-${tipo.ruta}-completo`);

    // Guardar en la nube: queda en el historial.
    await page.getByRole("button", { name: /Guardar en la nube/ }).locator("visible=true").first().click();
    await expect(page.getByText(/guardado|actualizado/i).locator("visible=true").first()).toBeVisible({ timeout: 30_000 });

    // Exportar: el navegador recibe el archivo. Presupuestos: Word y PDF. Plano: imagen y PDF.
    // Los archivos se guardan en capturas-locales/exports (ignorada por git) para mirarlos.
    if (tipo.exporta) {
      const carpeta = path.join("capturas-locales", "exports", info.project.name);
      fs.mkdirSync(carpeta, { recursive: true });
      const pedir = async (boton: RegExp, extension: RegExp) => {
        const descarga = page.waitForEvent("download", { timeout: 90_000 });
        await page.getByRole("button", { name: boton }).locator("visible=true").first().click();
        const d = await descarga;
        const nombre = d.suggestedFilename();
        expect(nombre).toMatch(extension);
        // Nombre saneado: nada que Windows no acepte y sin los caracteres raros del cliente.
        expect(nombre).not.toMatch(/[\/:*?"<>|]/);
        // Convención "<Cliente> - <Tipo> - DD-MM-AAAA".
        expect(nombre).toMatch(/ - [^-]+ - \d{2}-\d{2}-\d{4}\.[a-z]+$/);
        const destino = path.join(carpeta, `${tipo.ruta}-${nombre}`);
        await d.saveAs(destino);
        expect(fs.statSync(destino).size, `${nombre} está vacío`).toBeGreaterThan(2000);
        return destino;
      };
      if (tipo.esPlano) {
        const png = await pedir(/^Imagen/, /.png$/i);
        const cabecera = fs.readFileSync(png).subarray(0, 24);
        expect(cabecera.subarray(1, 4).toString()).toBe("PNG");
        expect(cabecera.readUInt32BE(16), "ancho de la imagen").toBeGreaterThan(300);
        expect(cabecera.readUInt32BE(20), "alto de la imagen").toBeGreaterThan(300);
        await pedir(/^PDF/, /.pdf$/i);
      } else {
        await pedir(/^Word/, /.docx$/i);
        await pedir(/^PDF/, /.pdf$/i);
      }
    }

    await page.goto("/dashboard/historial");
    await page.getByPlaceholder("Buscar cliente...").fill(cliente);
    await expect(page.getByText(cliente).locator("visible=true").first()).toBeVisible();
    await captura(page, info, `historial-${tipo.ruta}`);
    expect(errores, "errores de JavaScript en la página").toEqual([]);
  });
}

test("Plano: la calculadora interna de losetas calcula piezas y no toca el plano ni lo guarda", async ({ page }, info) => {
  await page.goto("/dashboard/losetas");
  await num(page, "Largo (m)", "7");
  await num(page, "Ancho (m)", "3");

  await page.getByText("Calculadora de losetas").first().click();
  await page.getByRole("button", { name: "Usar las medidas del plano" }).click();
  const resultado = page.getByLabel("Resultado");
  await expect(resultado).toContainText("44"); // de borde, igual que la hoja "Artículos" para 7x3
  await expect(resultado).toContainText("50"); // total con las 6 planas
  await captura(page, info, "calculadora-losetas");

  await page.getByLabel("Desperdicio (%)").fill("10");
  await expect(resultado).toContainText("49"); // 44 × 1,10 = 48,4 → 49

  // Enter dentro de la calculadora no guarda el presupuesto del plano.
  await page.getByLabel("Ancho de vereda (m)").press("Enter");
  await expect(page.getByText(/guardado/i)).toHaveCount(0);
  await expect(page).toHaveURL(/\/dashboard\/losetas$/);

  // Cambiar la calculadora no cambia las medidas del plano.
  await expect(page.getByLabel("Largo (m)", { exact: true }).locator("visible=true").first()).toHaveValue(/7/);
});
