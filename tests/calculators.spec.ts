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
 *   5. El botón de descarga real de cada una descarga un archivo cuyo nombre sigue
 *      el formato Presupuesto_<Tipo>_<Cliente>_<Fecha>.docx en las 4 tradicionales
 *      (botón "Word"), o Presupuesto_<Tipo>_<Cliente>_<Fecha>_cliente.png en losetas
 *      (botón "Imagen para el cliente" — losetas no genera Word, su salida es un
 *      plano PNG) (punto 4).
 *   6. En las 4 tradicionales, el botón "PDF" descarga
 *      Presupuesto_<Tipo>_<Cliente>_<Fecha>.pdf.
 *
 * Nota sobre el botón "PDF": genera el archivo de forma programática con
 * `@react-pdf/renderer` (ver lib/documentos/pdfGenerator.tsx) y lo entrega con
 * `compartirOdescargarArchivo` — mismo mecanismo `<a download>` que "Word", así que
 * Playwright lo intercepta con `page.waitForEvent("download")` igual que a
 * cualquier otro. No dispara `window.print()`: eso quedó atrás cuando el PDF pasó a
 * generarse con react-pdf en vez del diálogo de impresión del navegador. Losetas no
 * tiene botón "PDF", así que queda fuera del punto 6.
 */

const E2E_EMAIL = process.env.E2E_EMAIL;
const E2E_PASSWORD = process.env.E2E_PASSWORD;

type Calculadora = { tipo: string; nombreEsperado: string; encabezado: string };

// `encabezado` es el <h1> real de cada app/dashboard/<tipo>/page.tsx — sirve
// como señal de "esta calculadora ya montó", una por una, sin depender de
// ninguna clase/id compartido entre las 5 (no lo hay: cada una es su propio
// componente React desde la Fase 5).
const CALCULADORAS: Calculadora[] = [
  { tipo: "piscinas", nombreEsperado: "Piscina", encabezado: "Piscinas" },
  { tipo: "cercos", nombreEsperado: "Cerco", encabezado: "Cercos perimetrales" },
  { tipo: "cobertores", nombreEsperado: "Cobertor", encabezado: "Cobertores" },
  { tipo: "revestimientos", nombreEsperado: "Revestimiento", encabezado: "Revestimientos" },
  { tipo: "losetas", nombreEsperado: "Loseta", encabezado: "Plano de Piscina" },
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
 * Las 5 calculadoras son componentes React montados por su propio
 * app/dashboard/<tipo>/page.tsx (client component) — navegar entre ellas es
 * una navegación de Next normal, no la reinyección de un <script> legacy.
 * Este test sólo confirma que ir de una a otra no deja errores sueltos en
 * consola (p.ej. un componente que no limpia un listener/efecto al
 * desmontar).
 */
test("se puede navegar entre calculadoras sin errores", async ({ page }) => {
  const errores: string[] = [];
  page.on("pageerror", (err) => errores.push(String(err)));

  await login(page);
  for (const { tipo, encabezado } of CALCULADORAS) {
    await page.getByRole("link", { name: "Nuevo" }).click();
    await page.click(`a[href="/dashboard/${tipo}"]`);
    await expect(page.getByRole("heading", { name: encabezado })).toBeVisible({ timeout: 15_000 });
  }

  expect(errores, `Errores al navegar entre calculadoras:\n${errores.join("\n")}`).toEqual([]);
});

for (const { tipo, nombreEsperado, encabezado } of CALCULADORAS) {
  test(`${tipo}: carga sin errores, sin WhatsApp, sin tab Guardados, y descarga el archivo con el nombre correcto`, async ({
    page,
  }) => {
    const erroresConsola: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") erroresConsola.push(msg.text());
    });
    page.on("pageerror", (err) => erroresConsola.push(String(err)));

    await login(page);
    await page.goto(`/dashboard/${tipo}`);

    // Encabezado propio de cada calculadora — señal de que el componente
    // React ya montó (y, para las 4 tradicionales, de que el catálogo ya se
    // cargó: app/dashboard/<tipo>/page.tsx no renderiza el formulario hasta
    // tenerlo, así que no hay una ventana donde tipear pise un defaultValue
    // que todavía no llegó).
    await expect(page.getByRole("heading", { name: encabezado })).toBeVisible({ timeout: 15_000 });

    // Botón de descarga real de cada una: "Word" en las 4 tradicionales,
    // "Imagen para el cliente" (PNG) en losetas. El botón "PDF" (sólo en las
    // 4 tradicionales) se verifica aparte, más abajo (punto 6).
    const botonDescarga =
      tipo !== "losetas"
        ? page.getByRole("button", { name: "Word", exact: true })
        : page.getByRole("button", { name: "Imagen para el cliente" });
    await expect(botonDescarga).toBeVisible({ timeout: 15_000 });

    // --- Punto 1: sin botón de WhatsApp remanente ---
    await expect(page.locator("#btn-whatsapp")).toHaveCount(0);
    await expect(page.getByText("WhatsApp", { exact: false }).filter({ hasText: /compartir/i })).toHaveCount(0);

    // --- Punto 2: sin tab "Guardados" ---
    await expect(page.locator('[data-tab="guardados"]')).toHaveCount(0);
    await expect(page.locator("#tab-guardados")).toHaveCount(0);

    // Cargar un nombre de cliente con tilde y espacios para probar el sanitizado
    // del punto 4 (naming) en un caso real, no solo el default "Sin_nombre".
    // Las 4 tradicionales usan "Señor/Sra" (RHF: `cliente.nombre`); losetas
    // usa "Cliente o referencia" (`nombre`, es la única sin ficha de cliente
    // completa — ver adaptadores.ts).
    const nombreInput = tipo !== "losetas" ? page.getByLabel("Señor/Sra") : page.getByLabel("Cliente o referencia");
    await nombreInput.fill("Pérez, María José");

    // --- Punto 4: naming del archivo descargado ---
    const [download] = await Promise.all([
      // 30s: docx/html2canvas se piden con import() dinámico recién al
      // apretar el botón, no al cargar la página (ver dependencias.test.ts).
      page.waitForEvent("download", { timeout: 30_000 }),
      botonDescarga.click(),
    ]);
    const nombreArchivo = download.suggestedFilename();
    const sufijo = tipo !== "losetas" ? "\\.docx" : "_cliente\\.png";
    expect(nombreArchivo).toMatch(
      new RegExp(`^Presupuesto_${nombreEsperado}_Perez_Maria_Jose_\\d{4}-\\d{2}-\\d{2}${sufijo}$`)
    );
    const destino = path.join(test.info().outputDir, nombreArchivo);
    await download.saveAs(destino);
    expect(fs.existsSync(destino)).toBe(true);

    // --- Punto 6: el botón "PDF" (sólo en las 4 tradicionales) también
    // descarga un archivo real, con el mismo naming que Word/PNG salvo la
    // extensión — genera el PDF con react-pdf, no con window.print(). ---
    if (tipo !== "losetas") {
      const botonPdf = page.getByRole("button", { name: "PDF", exact: true });
      const [downloadPdf] = await Promise.all([
        // 30s por el mismo motivo que el import() dinámico de docx: react-pdf
        // también se pide recién al apretar el botón.
        page.waitForEvent("download", { timeout: 30_000 }),
        botonPdf.click(),
      ]);
      const nombrePdf = downloadPdf.suggestedFilename();
      expect(nombrePdf).toMatch(
        new RegExp(`^Presupuesto_${nombreEsperado}_Perez_Maria_Jose_\\d{4}-\\d{2}-\\d{2}\\.pdf$`)
      );
      const destinoPdf = path.join(test.info().outputDir, nombrePdf);
      await downloadPdf.saveAs(destinoPdf);
      expect(fs.existsSync(destinoPdf)).toBe(true);
    }

    // --- Sin errores de consola durante toda la carga/interacción ---
    expect(erroresConsola, `Errores de consola en ${tipo}: ${erroresConsola.join("\n")}`).toEqual([]);
  });
}
