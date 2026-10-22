import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import { iniciarSesion } from "./helpers/sesion";
import path from "node:path";
import { textoDePdf } from "../helpers/pdfTexto";
import { problemasDeSalida } from "../helpers/salidasPedido";
import { asegurarDatosDePantallas, NOTA_INTERNA } from "./helpers/datos";

/**
 * Compartir UN proveedor desde el detalle de un pedido:
 *  - escritorio: "Descargar" y "Copiar mensaje" (sin "Compartir");
 *  - celular (iPhone emulado, Chromium y WebKit): "Compartir" abre la hoja de compartir con el ARCHIVO (si el
 *    navegador puede compartir archivos con `canShare`), con sólo el TEXTO (si no puede), o descarga (si no hay
 *    hoja de compartir). Lo que se comparte, se descarga o se copia NO lleva precios, teléfonos ni notas internas,
 *    ni datos de otros proveedores.
 * La hoja de compartir real de iOS no se puede abrir desde la automatización: acá se reemplaza `navigator.share` /
 * `canShare` por unos de prueba que anotan lo que reciben (por eso lo de iOS real hay que mirarlo a mano).
 */
const EMAIL = process.env.E2E_LOCAL_EMAIL ?? "";
const PASSWORD = process.env.E2E_LOCAL_PASSWORD ?? "";
const FASE = process.env.E2E_FASE ?? "despues";
const PROVEEDOR = "Corralón Pantallas E2E";
const OTRO = "Filtros Pantallas E2E";

async function abrirDetalle(page: Page) {
  await iniciarSesion(page, EMAIL, PASSWORD);
  await page.goto("/dashboard/catalogo/pedidos");
  await page.locator("li").filter({ hasText: "Obra Pantallas E2E" }).getByRole("button", { name: /^Abrir PED/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

const acciones = (page: Page) => page.getByRole("group", { name: `Acciones del pedido a ${PROVEEDOR}` });

/** Reemplaza la hoja de compartir del navegador por una de prueba, según el modo (archivos | texto | nada). */
async function simularCompartir(page: Page, modo: "archivos" | "texto" | "nada") {
  await page.evaluate((m) => {
    const w = window as unknown as Record<string, unknown>;
    w.__compartido = null;
    if (m === "nada") {
      Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
      Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true });
      return;
    }
    Object.defineProperty(navigator, "canShare", { value: (d: ShareData) => m === "archivos" && !!d.files?.length, configurable: true });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (d: ShareData) => {
        const archivo = d.files?.[0];
        w.__compartido = {
          texto: d.text ?? null,
          nombre: archivo?.name ?? null,
          tipo: archivo?.type ?? null,
          bytes: archivo ? Array.from(new Uint8Array(await archivo.arrayBuffer())) : null,
        };
      },
    });
  }, modo);
}

const compartido = (page: Page) =>
  page.evaluate(() => (window as unknown as { __compartido: { texto: string | null; nombre: string | null; tipo: string | null; bytes: number[] | null } | null }).__compartido);

test("escritorio: Descargar y Copiar (sin Compartir); el PDF sale sin precios ni teléfonos ni notas", async ({ page, context, browserName }, info) => {
  test.skip(info.project.name.startsWith("iphone13"), "este caso es de escritorio");
  await asegurarDatosDePantallas();
  if (browserName === "chromium") await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await abrirDetalle(page);

  const grupo = acciones(page);
  await expect(grupo.getByRole("button", { name: "Descargar" })).toBeVisible();
  await expect(grupo.getByRole("button", { name: "Copiar mensaje" })).toBeVisible();
  if ((info.project.use.viewport?.width ?? 1280) >= 768) await expect(grupo.getByRole("button", { name: "Compartir" })).toHaveCount(0);
  for (const b of [grupo.getByRole("button", { name: "Descargar" }), grupo.getByRole("button", { name: "Copiar mensaje" })]) {
    const c = (await b.boundingBox())!;
    expect(c.height).toBeGreaterThanOrEqual(47.5);
  }
  fs.mkdirSync(path.join("capturas-locales", FASE, info.project.name), { recursive: true });
  await page.screenshot({ path: path.join("capturas-locales", FASE, info.project.name, "pedido-acciones-proveedor.png") });

  const [descarga] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), grupo.getByRole("button", { name: "Descargar" }).click()]);
  expect(descarga.suggestedFilename()).toMatch(/^Pedido_PED-\d{4}_Corralon_Pantallas_E2E\.pdf$/);
  const ruta = await descarga.path();
  const texto = textoDePdf(new Uint8Array(fs.readFileSync(ruta)));
  expect(problemasDeSalida(texto, NOTA_INTERNA)).toEqual([]);
  expect(texto).toContain("Hierro del 6");
  expect(texto, "un archivo individual no trae a otro proveedor").not.toContain(OTRO);
  expect(texto).not.toContain("Filtro de arena");

  await grupo.getByRole("button", { name: "Copiar mensaje" }).click();
  await expect(grupo.getByRole("button", { name: "¡Copiado!" })).toBeVisible();
  if (browserName === "chromium") {
    const copiado = await page.evaluate(() => navigator.clipboard.readText());
    expect(problemasDeSalida(copiado, NOTA_INTERNA)).toEqual([]);
    expect(copiado).toContain(PROVEEDOR);
    expect(copiado).toContain("Hierro del 6");
    expect(copiado).not.toContain("Filtro de arena");
  }
});

test.describe("iPhone emulado", () => {
  test.beforeEach(({}, info) => {
    test.skip(!info.project.name.startsWith("iphone13"), "sólo en el iPhone emulado (la hoja de compartir es de celular)");
  });

  test("Compartir con archivo: la hoja de compartir recibe el PDF y el texto, sin precios ni teléfonos", async ({ page }, info) => {
    await asegurarDatosDePantallas();
    await abrirDetalle(page);
    await simularCompartir(page, "archivos");
    const compartir = acciones(page).getByRole("button", { name: /^Compartir|Preparando/ });
    await expect(acciones(page).getByRole("button", { name: "Compartir" })).toBeEnabled({ timeout: 60_000 }); // el PDF se prepara antes (iOS pide el gesto)
    fs.mkdirSync(path.join("capturas-locales", FASE, info.project.name), { recursive: true });
    await page.screenshot({ path: path.join("capturas-locales", FASE, info.project.name, "pedido-acciones-proveedor.png") });
    await compartir.click();
    await expect.poll(() => compartido(page)).not.toBeNull();
    const r = (await compartido(page))!;
    expect(r.nombre).toMatch(/^Pedido_PED-\d{4}_Corralon_Pantallas_E2E\.pdf$/);
    expect(r.tipo).toBe("application/pdf");
    const texto = textoDePdf(new Uint8Array(r.bytes!));
    expect(problemasDeSalida(texto, NOTA_INTERNA)).toEqual([]);
    expect(texto).toContain("Hierro del 6");
    expect(texto).not.toContain("Filtro de arena");
    expect(problemasDeSalida(r.texto ?? "", NOTA_INTERNA)).toEqual([]);
    await expect(page.getByRole("status").filter({ hasText: `Pedido a ${PROVEEDOR} compartido` })).toBeVisible();
  });

  test("si el navegador no comparte archivos, comparte sólo el texto", async ({ page }) => {
    await asegurarDatosDePantallas();
    await abrirDetalle(page);
    await simularCompartir(page, "texto");
    await expect(acciones(page).getByRole("button", { name: "Compartir" })).toBeEnabled({ timeout: 60_000 });
    await acciones(page).getByRole("button", { name: "Compartir" }).click();
    await expect.poll(() => compartido(page)).not.toBeNull();
    const r = (await compartido(page))!;
    expect(r.nombre).toBeNull();
    expect(problemasDeSalida(r.texto ?? "", NOTA_INTERNA)).toEqual([]);
    expect(r.texto).toContain("Hierro del 6");
    await expect(page.getByRole("status").filter({ hasText: "compartió el texto" })).toBeVisible();
  });

  test("si no hay hoja de compartir, descarga el archivo", async ({ page }) => {
    await asegurarDatosDePantallas();
    await abrirDetalle(page);
    await simularCompartir(page, "nada");
    await expect(acciones(page).getByRole("button", { name: "Compartir" })).toBeEnabled({ timeout: 60_000 });
    const [descarga] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), acciones(page).getByRole("button", { name: "Compartir" }).click()]);
    expect(descarga.suggestedFilename()).toMatch(/^Pedido_PED-\d{4}_Corralon_Pantallas_E2E\.pdf$/);
  });

  test("Descargar y Copiar mensaje también están en el celular, con botones de 48 px", async ({ page }) => {
    await asegurarDatosDePantallas();
    await abrirDetalle(page);
    for (const nombre of ["Compartir", "Descargar", "Copiar mensaje"]) {
      const b = acciones(page).getByRole("button", { name: nombre });
      await expect(b).toBeVisible();
      expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(47.5);
    }
  });
});

test("imprimir: la hoja que sale por la impresora no muestra precios, costos, teléfonos ni notas internas", async ({ page }, info) => {
  await asegurarDatosDePantallas();
  await iniciarSesion(page, EMAIL, PASSWORD);
  await page.goto("/dashboard/catalogo/pedido");
  await expect(page.getByRole("region", { name: "Resumen del pedido" })).toBeVisible();
  await page.getByLabel("Cliente / obra").fill("Familia Gómez 3534 55 66 77");
  await page.getByLabel("Pide (quién hace el pedido)").fill("Benja");
  await page.getByLabel(/Notas internas/).fill(NOTA_INTERNA);

  // En pantalla, la app muestra los precios (son internos).
  expect(await page.evaluate(() => document.body.innerText)).toMatch(/\$/);

  // Al imprimir, no.
  await page.emulateMedia({ media: "print" });
  const impreso = await page.evaluate(() => document.body.innerText);
  expect(problemasDeSalida(impreso, NOTA_INTERNA)).toEqual([]);
  expect(impreso).toContain("PEDIDO DE MATERIALES");
  expect(impreso).toContain("Familia Gómez"); // la obra sale, sin el teléfono
  expect(impreso).not.toContain("3534 55 66 77");
  fs.mkdirSync(path.join("capturas-locales", FASE, info.project.name), { recursive: true });
  await page.screenshot({ path: path.join("capturas-locales", FASE, info.project.name, "pedido-impresion.png"), fullPage: true });
  await page.emulateMedia({ media: "screen" });
});
