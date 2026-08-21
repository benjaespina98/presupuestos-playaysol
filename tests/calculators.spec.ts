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
  await expect(
    page.getByRole("heading", { name: "Nuevo presupuesto" })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Historial" })).toBeVisible();
});

/**
 * Navegar entre calculadoras sin recargar (SPA) reinyecta un <script> que
 * declara las mismas variables de nivel superior que el anterior. Están
 * envueltos en IIFE justamente para que eso no tire "Identifier already
 * declared" y mate la calculadora entera — pero es una protección que no se ve
 * hasta que alguien saca el wrapper.
 */
test("se puede navegar entre calculadoras sin errores", async ({ page }) => {
  const errores: string[] = [];
  page.on("pageerror", (err) => errores.push(String(err)));

  await login(page);
  for (const tipo of ["piscinas", "cercos", "revestimientos", "cobertores"]) {
    await page.getByRole("link", { name: "Nuevo" }).click();
    await page.click(`a[href="/dashboard/${tipo}"]`);
    await expect(page.locator(".form-panel")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#btn-download-word")).toBeVisible({ timeout: 15_000 });
  }

  expect(errores, `Errores al navegar entre calculadoras:\n${errores.join("\n")}`).toEqual([]);
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
      // Esperar a que el HTML legacy de la calculadora termine de montarse.
      await expect(page.locator(".form-panel")).toBeVisible({ timeout: 15_000 });
    } else {
      // Losetas es React puro (Fase 5, última en migrar): no tiene
      // .form-panel: se espera el encabezado propio de la pantalla.
      await expect(page.getByRole("heading", { name: "Plano de Piscina" })).toBeVisible({ timeout: 15_000 });
    }
    // Además del CSS/mount, hay que esperar a que el script principal termine de
    // correr — recién ahí existen los botones de acción.
    const botonListo =
      tipo !== "losetas"
        ? page.locator("#btn-download-word")
        : page.locator('button:has-text("Imagen para el cliente")');
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

      // La sección "Datos" del acordeón arranca abierta por defecto (acc-item open),
      // así que #f-cliente ya está visible — no hace falta clickear ningún encabezado
      // (clickear el .acc-head lo plegaría y ocultaría el input).
      const clienteInput = page.locator("#f-cliente");
      if (await clienteInput.count()) await clienteInput.fill("Pérez, María José");
    } else {
      const nombreInput = page.locator("#nombre");
      if (await nombreInput.count()) await nombreInput.fill("Pérez, María José");
    }

    // --- Punto 4: naming del archivo descargado ---
    if (tipo !== "losetas") {
      const [download] = await Promise.all([
        // 30s (antes 20): docx y html2canvas ahora se bajan del CDN recien al
        // apretar el boton, no al cargar la pagina.
        page.waitForEvent("download", { timeout: 30_000 }),
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
      // Losetas no tiene botón Word — su descarga real es el PNG "Imagen para cliente".
      const [download] = await Promise.all([
        // 30s (antes 20): docx y html2canvas ahora se bajan del CDN recien al
        // apretar el boton, no al cargar la pagina.
        page.waitForEvent("download", { timeout: 30_000 }),
        page.click('button:has-text("Imagen para el cliente")'),
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
