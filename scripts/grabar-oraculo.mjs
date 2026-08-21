/**
 * Regenera las fixtures del oráculo (tests/oracle/fixtures/*.json).
 *
 *     npm run oraculo:grabar
 *
 * Existe como script y no como variable de entorno en package.json porque
 * `VAR=1 comando` no funciona en PowerShell, que es donde se trabaja acá.
 *
 * Cuándo corresponde correrlo:
 *   - agregaste o cambiaste un caso en tests/oracle/casos.ts
 *   - cambiaste una fórmula del legacy A PROPÓSITO y ya lo documentaste
 *
 * Cuándo NO:
 *   - el test del oráculo falló y no sabés por qué. Eso es un hallazgo, no un
 *     archivo desactualizado. Regrabar lo tapa.
 */
import { spawnSync } from "node:child_process";

console.log("Grabando fixtures del oráculo contra las calculadoras legacy...\n");

// Se pasa el comando completo como string (y no comando + args con shell:true),
// que es lo que Node marca como inseguro porque no escapa los argumentos.
const r = spawnSync(
  "npx vitest run tests/unit/oraculo.test.ts --reporter=verbose",
  {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ORACULO_GRABAR: "1" },
  }
);

if (r.status !== 0) {
  console.error("\nLa grabación falló. Las fixtures no se tocaron.");
  process.exit(r.status ?? 1);
}

console.log("\nListo. Revisá el diff de tests/oracle/fixtures/ antes de commitear:");
console.log("  git diff tests/oracle/fixtures/");
