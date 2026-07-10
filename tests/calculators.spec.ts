import { test, expect, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";

/**
 * Requiere credenciales reales de un usuario del portal, vía variables de entorno:
 *   E2E_EMAIL=vos@ejemplo.com E2E_PASSWORD=tu-contraseña npx playwright test
 *
 * Qué cubre (estructural, no visual — la calidad real de imágenes en el PDF y el
 * flujo de WhatsApp en el celular los tenés que revisar vos a mano):
 *   1. Login llega al dashboard.
 *   2. Cada una de las 5 calculadoras carga sin errores de consola.
 *   3. No aparece ningún botón/texto de WhatsApp (verifica que el punto 1 del pedido
 *      se aplicó bien en las 5 — solo se había llegado a implementar en piscinas).
 *   4. No aparece el tab "Guardados" en ninguna (punto 2).
 *   5. El botón "Word" (que sí es una descarga programática real, a diferencia del
 *      botón "PDF" que abre el diálogo nativo de impresión del navegador — ESE no se
 *      puede verificar por automatización, ver nota abajo) descarga un archivo cuyo
 *      nombre sigue el formato Presupuesto_<Tipo>_<Cliente>_<Fecha>.docx (punto 4).
 *
 * Nota importante sobre el botón "PDF": dispara window.print(), que abre el diálogo
 * nativo del navegador. No genera un archivo de forma programática — no hay ningún
 * evento de descarga que Playwright (ni ningún test automatizado) pueda interceptar,
 * porque el archivo final lo arma el sistema operativo/navegador fuera del control de
 * la página. Por eso este test verifica el botón "Word" para el punto 4 (naming), que
 * sí es una descarga real generada por el código.
 */

const E2E_EMAIL = process.env.E2E_EMAIL;
const E2E_PASSWORD = process.env.E2E_PASSWORD;

type Calculadora = { tipo: string; nombreEsperado: string };

const CALCULADORAS: Calculadora[] = [
  { tipo: "piscinas", nombreEsperado: "Piscina" },
  { tipo: "cercos", nombreEsperado: "Cerco" },
  { tipo: "cobertores", nombreEsperado: "Cobertor" },
  { tipo: "revestimientos", nombreEsperado: "Revestimiento" },
  { tipo: "losetas", nombreEsperado: "Loseta" },
];

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[type="email"]', E2E_EMAIL!);
  await page.fill('input[type="password"]', E2E_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
}

test.beforeEach(() => {
  test.skip(
    !E2E_EMAIL || !E2E_PASSWORD,
    "Faltan E2E_EMAIL / E2E_PASSWORD en el entorno — pasalas para correr este test (ver comentario arriba del archivo)."
  );
});

test("login llega al dashboard", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("link", { name: "Presupuestos" })).toBeVisible();
});

for (const { tipo, nombreEsperado } of CALCULADORAS) {
  test(`${tipo}: carga sin errores, sin WhatsApp, sin tab Guardados, y descarga Word con el nombre correcto`, async ({
    page,
  }) => {
    const erroresConsola: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") erroresConsola.push(msg.text());
    });
    page.on("pageerror", (err) => erroresConsola.push(String(err)));

    await login(page);
    await page.goto(`/dashboard/${tipo}`);

    if (tipo !== "losetas") {
      // Esperar a que el HTML legacy de la calculadora termine de montarse (el
      // form-panel queda oculto con visibility:hidden hasta que carga el CSS).
      await expect(page.locator(".form-panel")).toBeVisible({ timeout: 15_000 });
    } else {
      // Losetas no usa .form-panel ni el patrón de ocultar-hasta-que-cargue-CSS de
      // las otras 4 (no hay <link> externo, los estilos van inline vía <style>) —
      // su contenedor real es #capture-area (ver app/dashboard/losetas/markup.ts).
      await expect(page.locator("#capture-area")).toBeVisible({ timeout: 15_000 });
    }
    // Además del CSS/mount, hay que esperar a que el script principal termine de
    // correr — recién ahí existen los botones de acción.
    const botonListo =
      tipo !== "losetas"
        ? page.locator("#btn-download-word")
        : page.locator('button:has-text("Descargar para cliente")');
    await expect(botonListo).toBeVisible({ timeout: 15_000 });

    // --- Punto 1: sin botón de WhatsApp remanente ---
    await expect(page.locator("#btn-whatsapp")).toHaveCount(0);
    await expect(page.getByText("WhatsApp", { exact: false }).filter({ hasText: /compartir/i })).toHaveCount(0);

    // --- Punto 2: sin tab "Guardados" ---
    await expect(page.locator('[data-tab="guardados"]')).toHaveCount(0);
    await expect(page.locator("#tab-guardados")).toHaveCount(0);

    // Cargar un nombre de cliente con tilde y espacios para probar el sanitizado
    // del punto 4 (naming) en un caso real, no solo el default "Sin_nombre".
    if (tipo !== "losetas") {
      // El botón visible NO garantiza que -calc.js ya terminó su init asincrónico
      // (loadCatalog/loadFotosPorOpcional/seedFotosGeneralesDefaults contra Supabase),
      // que recién al final llama renderForm() y pisa #f-cliente con el state actual.
      // Si se llena el campo antes de eso, renderForm() sobreescribe lo tipeado y el
      // archivo sale con "Sin_nombre" — se vio pasar en cercos por timing. #f-fecha
      // arranca vacío en el markup y solo se puebla en renderForm(), así que esperar
      // a que tenga valor es la señal real de que el init terminó.
      await expect(page.locator("#f-fecha")).not.toHaveValue("", { timeout: 15_000 });

      const datosTab = page.locator('.tab-btn[data-tab="datos"]');
      if (await datosTab.count()) await datosTab.click();
      const clienteInput = page.locator("#f-cliente");
      if (await clienteInput.count()) await clienteInput.fill("Pérez, María José");
    } else {
      const nombreInput = page.locator("#nombre");
      if (await nombreInput.count()) await nombreInput.fill("Pérez, María José");
    }

    // --- Punto 4: naming del archivo descargado ---
    if (tipo !== "losetas") {
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 20_000 }),
        page.click("#btn-download-word"),
      ]);
      const nombreArchivo = download.suggestedFilename();
      expect(nombreArchivo).toMatch(
        new RegExp(`^Presupuesto_${nombreEsperado}_Perez_Maria_Jose_\\d{4}-\\d{2}-\\d{2}\\.docx$`)
      );
      const destino = path.join(test.info().outputDir, nombreArchivo);
      await download.saveAs(destino);
      expect(fs.existsSync(destino)).toBe(true);
    } else {
      // Losetas no tiene botón Word — su descarga real es el PNG "Descargar para cliente".
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 20_000 }),
        page.click('button:has-text("Descargar para cliente")'),
      ]);
      const nombreArchivo = download.suggestedFilename();
      expect(nombreArchivo).toMatch(
        new RegExp(`^Presupuesto_${nombreEsperado}_Perez_Maria_Jose_\\d{4}-\\d{2}-\\d{2}_cliente\\.png$`)
      );
      const destino = path.join(test.info().outputDir, nombreArchivo);
      await download.saveAs(destino);
      expect(fs.existsSync(destino)).toBe(true);
    }

    // --- Sin errores de consola durante toda la carga/interacción ---
    expect(erroresConsola, `Errores de consola en ${tipo}: ${erroresConsola.join("\n")}`).toEqual([]);
  });
}
