/**
 * ¿Puede cualquiera crearse una cuenta en el portal?
 *
 * Correr desde la raíz del proyecto:   node scripts/verificar-auth-publica.mjs
 *
 * Es LA verificación de seguridad más importante que el repo no puede hacer solo. Las reglas de la base (RLS) dejan a
 * cualquier usuario autenticado leer costos, proveedores y presupuestos, y la anon key es pública: si el alta está
 * abierta, cualquiera con la URL del portal se crea una cuenta y lee todo.
 *
 * Sólo consulta los ajustes públicos de Auth (GET /auth/v1/settings). No crea usuarios ni modifica nada.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function leerEnv() {
  const env = {};
  for (const linea of fs.readFileSync(path.join(raiz, ".env.local"), "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/.exec(linea);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: clave } = leerEnv();
if (!url || !clave) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local.");
  process.exit(2);
}

const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: clave } });
if (!r.ok) {
  console.error(`Supabase respondió ${r.status}: no se pudo saber.`);
  process.exit(2);
}
const ajustes = await r.json();

if (ajustes.disable_signup === true) {
  console.log("OK: el alta pública está CERRADA. Sólo entran los usuarios que crea un administrador.");
} else {
  console.log("EXPUESTO: el alta pública está ABIERTA. Cualquiera puede crearse una cuenta y leer costos y presupuestos.");
  console.log("Cerrala en Supabase: Authentication → Sign In / Providers → desactivar \"Allow new users to sign up\".");
  process.exit(1);
}
