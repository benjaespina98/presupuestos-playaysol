// Corre una prueba de pantallas contra el portal local que dejó levantado `node scripts/e2e-local.mjs servir`.
// Uso: node scripts/e2e-contra-servidor.mjs <spec> [argumentos de playwright...]
//   p. ej. E2E_FASE=despues E2E_PROYECTOS=m-390x844 node scripts/e2e-contra-servidor.mjs recorrido
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const entorno = JSON.parse(fs.readFileSync("capturas-locales/_entorno.json", "utf8"));
if (!/^http:[/][/](127[.]0[.]0[.]1|localhost):5432[0-9]$/.test(entorno.E2E_LOCAL_API)) {
  console.error("✗ La API del entorno guardado no es la base local.");
  process.exit(1);
}
const [spec, ...resto] = process.argv.slice(2);
const r = spawnSync(`npx playwright test -c playwright.responsive.config.ts ${resto.join(" ")}`, {
  env: { ...process.env, ...entorno, ...(spec ? { E2E_SPEC: spec } : {}) },
  shell: true,
  stdio: "inherit",
});
process.exit(r.status ?? 1);
