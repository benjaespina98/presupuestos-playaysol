import { defineConfig, devices } from "@playwright/test";

/**
 * Las pruebas de pantallas (recorrido, edición, compartir) en todos los tamaños que usa el portal, contra el
 * portal LOCAL con la base LOCAL. No se corre a mano: `node scripts/e2e-local.mjs recorrido` arma la base,
 * levanta el servidor en el puerto 3100 y ejecuta esto. Capturas en `capturas-locales/` (ignorada por git).
 *
 * Proyectos: 360x740, 390x844, 430x932, 768x1024, 1280x800 y 1366x768 en Chromium, más el iPhone 13 emulado
 * (Chromium y, si está instalado, WebKit), también con el teléfono en modo oscuro. WebKit se instala con `npx playwright install webkit`.
 */
/** Uno o varios (separados por coma): recorrido, edicion, compartir, documentos. */
const specs = (process.env.E2E_SPEC ?? "recorrido,edicion,compartir,documentos,autoprueba,gestos,estados,metricas").split(",").map((s) => s.trim());
const solo = process.env.E2E_PROYECTOS?.split(",").map((s) => s.trim());

const chrome = process.env.E2E_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.E2E_CHROMIUM_PATH } } : {};
const movil = (width: number, height: number) => ({ viewport: { width, height }, hasTouch: true, isMobile: true, ...chrome });
const escritorio = (width: number, height: number) => ({ viewport: { width, height }, ...chrome });

const proyectos = [
  { name: "m-360x740", use: movil(360, 740) },
  { name: "m-390x844", use: movil(390, 844) },
  { name: "m-430x932", use: movil(430, 932) },
  { name: "t-768x1024", use: { viewport: { width: 768, height: 1024 }, hasTouch: true, ...chrome } },
  { name: "d-1280x800", use: escritorio(1280, 800) },
  { name: "d-1366x768", use: escritorio(1366, 768) },
  { name: "iphone13-chromium", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" as const, ...chrome } },
  { name: "iphone13-webkit", use: { ...devices["iPhone 13"] } },
  // El teléfono en modo oscuro: el portal es sólo claro, tiene que verse igual (color-scheme: light).
  { name: "iphone13-chromium-oscuro", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" as const, colorScheme: "dark" as const, ...chrome } },
  { name: "iphone13-webkit-oscuro", use: { ...devices["iPhone 13"], colorScheme: "dark" as const } },
];

export default defineConfig({
  testDir: "./tests/local",
  testMatch: specs.map((s) => `**/${s}.spec.ts`),
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: "capturas-locales/_resultados",
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100", trace: "off", screenshot: "off", locale: "es-AR" },
  projects: solo ? proyectos.filter((p) => solo.includes(p.name)) : proyectos,
});
