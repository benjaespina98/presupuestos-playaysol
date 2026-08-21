import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// Sin esto, cada render() de un test queda pegado al document y el siguiente
// test lo hereda — React Testing Library hace este afterEach solo si vitest
// corre con `globals: true`, y este proyecto no lo activa (vitest.config.mts
// no declara test.globals, así que `describe/it/expect` se importan a mano en
// cada archivo). Registrarlo acá, una vez, es más simple que pedirle a cada
// *.test.tsx que se acuerde de hacerlo.
afterEach(() => {
  cleanup();
});

/**
 * Matchers de jest-dom (toBeInTheDocument, toHaveValue, etc.) para los tests
 * de componentes. Se carga siempre, incluso en tests que no tocan el DOM: solo
 * extiende `expect`, no toca el environment ni hace falta nada más.
 *
 * El environment jsdom en sí se pide por archivo con el docblock
 * `// @vitest-environment jsdom` en cada *.test.tsx — los tests de lógica pura
 * (*.test.ts) siguen corriendo en "node", más rápido.
 */
