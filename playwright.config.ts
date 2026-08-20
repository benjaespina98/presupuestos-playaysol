import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // Solo *.spec.ts. Los *.test.ts son de Vitest (ver vitest.config.ts): sin esto,
  // Playwright levantaría un navegador para correr tests unitarios.
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    // El primer arranque en frío de Next puede pasar largo de 60s en Windows
    // sobre un disco lento (el propio dev server lo avisa).
    timeout: 180_000,
  },
});
