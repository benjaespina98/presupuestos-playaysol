import { defineConfig } from "@playwright/test";

/**
 * Prueba visual y funcional contra el portal corriendo en LOCAL con la base
 * LOCAL. No se corre a mano: `node scripts/e2e-local.mjs` arma la base, levanta
 * el servidor en el puerto 3100 con las variables de la base local y después
 * ejecuta esto. Capturas en `capturas-locales/` (ignorada por git).
 */
export default defineConfig({
  testDir: "./tests/local",
  testMatch: "**/*.spec.ts",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: "capturas-locales/_resultados",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "off",
    screenshot: "only-on-failure",
    locale: "es-AR",
    // Si la versión de Chromium que espera esta versión de Playwright no está descargada, se puede usar
    // otra ya instalada: E2E_CHROMIUM_PATH=ruta\al\chrome.exe (sólo local; no descarga nada).
    launchOptions: process.env.E2E_CHROMIUM_PATH ? { executablePath: process.env.E2E_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "movil", use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: "escritorio", use: { viewport: { width: 1280, height: 800 } } },
  ],
});
