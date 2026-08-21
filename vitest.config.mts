import { defineConfig } from "vitest/config";

/**
 * Vitest corre los tests unitarios: lógica pura, sin navegador ni credenciales.
 * Playwright sigue siendo dueño de los end-to-end.
 *
 * El reparto es por extensión, para que nunca se pisen:
 *   *.test.ts   → Vitest
 *   *.spec.ts   → Playwright  (ver testMatch en playwright.config.ts)
 *
 * Extensión .mts a propósito: este archivo usa sintaxis ESM, y con .ts Vite lo
 * carga como CommonJS y avisa que va a dejar de funcionar.
 */
export default defineConfig({
  test: {
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules/**", ".next/**", "test-results/**"],
    environment: "node",
    // Los *.test.tsx piden jsdom por archivo con `// @vitest-environment jsdom`
    // (ver ese docblock en cualquiera de ellos). setupFiles corre en todos los
    // tests, node incluido: solo extiende `expect` con los matchers de
    // jest-dom, no depende del DOM.
    setupFiles: ["./tests/setup-jsdom.ts"],
  },
  resolve: {
    // Mismo alias que tsconfig, para que los tests importen igual que la app.
    alias: { "@": import.meta.dirname },
  },
});
