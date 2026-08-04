/**
 * ¿Puede un desconocido enumerar las fotos de los presupuestos?
 *
 * Correr desde la raíz del proyecto:   node scripts/verificar-storage-publico.mjs
 *
 * El bucket 'presupuestos' es público a propósito: las fotos tienen que abrirse
 * desde el Word/PDF que recibe el cliente, que no tiene usuario del portal.
 * Lo que este script comprueba es otra cosa — si además se puede pedir el LISTADO
 * del bucket sin estar logueado, que es lo que convertiría "hay que tener el link
 * exacto de una foto" en "se pueden sacar todas". Ver la nota (b) de
 * supabase/migration_limpieza.sql.
 *
 * Todo lo que hace es de solo lectura: no sube, no borra, no modifica nada.
 */
import fs from "node:fs";
import path from "node:path";
import dns from "node:dns/promises";
import { fileURLToPath } from "node:url";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CARPETAS = ["piscinas", "cercos", "revestimientos", "cobertores", "losetas"];
const LINEA = "─".repeat(64);

// Solo estos códigos permiten sacar una conclusión: 200 = el servidor listó
// (aunque venga vacío), 400/401/403 = denegó explícitamente. Cualquier otro
// (típicamente 5xx de un proyecto arrancando) no dice nada sobre los permisos.
const CODIGOS_CONCLUYENTES = [200, 400, 401, 403];

function leerEnv() {
  const envPath = path.join(raiz, ".env.local");
  if (!fs.existsSync(envPath)) return null;
  return Object.fromEntries(
    fs
      .readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
  );
}

async function listar(url, key, prefix) {
  try {
    const r = await fetch(`${url}/storage/v1/object/list/presupuestos`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit: 100 }),
    });
    const texto = await r.text();
    let json = null;
    try {
      json = JSON.parse(texto);
    } catch {}
    return { status: r.status, items: Array.isArray(json) ? json : null, texto };
  } catch (err) {
    // fetch() envuelve el error real en .cause; sin desenvolverlo, todo problema
    // de red se ve como un "fetch failed" que no dice nada.
    return { error: err, causa: err.cause?.code ?? err.cause?.message ?? null };
  }
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const env = leerEnv();
  if (!env) {
    console.error("No encontré .env.local. Corré esto desde la raíz del proyecto.");
    return 1;
  }

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  // Esta clave NO es un secreto: viaja en el JavaScript del sitio (por eso el
  // prefijo NEXT_PUBLIC_). Cualquiera que abra el portal puede leerla del código
  // fuente — que es justamente el supuesto del que parte esta comprobación.
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");
    return 1;
  }

  const host = new URL(url).hostname;
  console.log("Probando contra:", url);
  console.log("Sin iniciar sesión, usando solo la clave pública del sitio.\n");

  // ¿El host del proyecto resuelve? Supabase da de baja el DNS de un proyecto
  // PAUSADO, así que uno pausado por inactividad (plan gratuito) se ve idéntico a
  // uno borrado, y los dos se ven igual que "no hay internet" si no se distingue.
  let dnsOk = true;
  try {
    const dir = await dns.lookup(host);
    console.log(`DNS: ${host} resuelve a ${dir.address}`);
  } catch (err) {
    dnsOk = false;
    console.log(`DNS: ${host} NO resuelve (${err.code})`);
  }

  // Contraste: si esto anda y lo de arriba no, tu internet está bien.
  let internetOk = true;
  try {
    await dns.lookup("supabase.com");
    console.log("DNS: supabase.com resuelve — la conexión a internet funciona");
  } catch {
    internetOk = false;
    console.log("DNS: supabase.com tampoco resuelve — parece un problema de red local");
  }
  console.log("");

  if (!dnsOk) {
    console.log(LINEA);
    if (internetOk) {
      console.log("NO SE PUDO COMPROBAR: el host del proyecto no resuelve.");
      console.log("");
      console.log("Tu internet anda (supabase.com resuelve), así que el problema es");
      console.log("del proyecto. Causas posibles, de más a menos probable:");
      console.log("");
      console.log("  1. EL PROYECTO ESTÁ PAUSADO. Supabase pausa los proyectos del");
      console.log("     plan gratuito por inactividad y les da de baja el DNS, así");
      console.log("     que se ve idéntico a uno borrado. Los datos siguen intactos.");
      console.log("     Entrá a https://supabase.com/dashboard y apretá");
      console.log("     'Resume project'; tarda un par de minutos en volver.");
      console.log("     OJO: mientras esté pausado, la app EN PRODUCCIÓN tampoco");
      console.log("     puede loguearse ni guardar presupuestos.");
      console.log("");
      console.log("  2. El .env.local de esta máquina apunta a otro proyecto.");
      console.log("     Compará la URL de arriba con la del panel.");
      console.log("");
      console.log("  3. El proyecto se borró.");
    } else {
      console.log("NO SE PUDO COMPROBAR: no hay salida a internet desde esta máquina.");
      console.log("Puede ser el wifi, un proxy o un firewall. Probá de nuevo con red.");
    }
    console.log(LINEA);
    return 1;
  }

  // Un proyecto recién reanudado devuelve 5xx un par de minutos antes de aceptar
  // consultas. En vez de hacerte correr el script cada 30 segundos, reintenta solo.
  const INTENTOS = 6;
  let r;
  for (let i = 1; i <= INTENTOS; i++) {
    r = await listar(url, key, "");
    if (!r.error && CODIGOS_CONCLUYENTES.includes(r.status)) break;
    if (i < INTENTOS) {
      const motivo = r.error ? r.causa || r.error.message : `HTTP ${r.status}`;
      console.log(`El proyecto todavía no responde (${motivo}). Reintento ${i}/${INTENTOS - 1} en 20s...`);
      await dormir(20_000);
    }
  }

  if (r.error) {
    console.log(LINEA);
    console.log("NO SE PUDO COMPROBAR: el host resuelve pero la petición no llegó.");
    console.log("Causa:", r.causa || r.error.message);
    console.log(LINEA);
    return 1;
  }

  if (!CODIGOS_CONCLUYENTES.includes(r.status)) {
    console.log(LINEA);
    console.log(`NO SE PUDO COMPROBAR: el servidor sigue respondiendo HTTP ${r.status}.`);
    console.log("");
    console.log("Si acabás de reanudar el proyecto, esperá unos minutos más.");
    console.log("Reanudar puede tardar bastante más que 'un par de minutos' cuando");
    console.log("el proyecto estuvo pausado mucho tiempo.");
    console.log(LINEA);
    return 1;
  }

  let total = 0;
  const detalle = [];
  for (const carpeta of CARPETAS) {
    const rc = await listar(url, key, `${carpeta}/`);
    const n = rc.items ? rc.items.length : 0;
    total += n;
    if (n) detalle.push(`   ${carpeta}: ${n} foto(s)`);
  }

  console.log(LINEA);
  if (total > 0 || (r.items && r.items.length > 0)) {
    console.log("EXPUESTO: se puede pedir el listado del bucket sin estar logueado.");
    console.log(`Fotos enumerables por un desconocido: ${total}`);
    if (detalle.length) console.log(detalle.join("\n"));
    console.log("");
    console.log("Para cerrarlo, en el SQL Editor de Supabase:");
    console.log("");
    console.log('   drop policy if exists "Anyone can view presupuesto images"');
    console.log("     on storage.objects;");
    console.log("");
    console.log("Después volvé a correr este script: tiene que decir NO EXPUESTO.");
    console.log("Verificá además que un Word ya exportado siga mostrando sus fotos");
    console.log("(el bucket sigue siendo público: eso no cambia).");
  } else if (r.status === 200) {
    console.log("NO EXPUESTO: el listado responde, pero vacío para un anónimo.");
    console.log("");
    console.log("Ojo: si todavía no se guardó ningún presupuesto CON FOTOS en la");
    console.log("nube, este resultado no prueba nada — no hay nada que listar.");
    console.log("Guardá un presupuesto con al menos una foto y volvé a correrlo.");
  } else {
    console.log("NO EXPUESTO: el servidor denegó el listado a un anónimo.");
    console.log(`(HTTP ${r.status} — denegación explícita, que es lo correcto)`);
    console.log("");
    console.log("Las fotos se siguen viendo por su URL directa desde el Word/PDF");
    console.log("del cliente, que es lo que tiene que pasar.");
  }
  console.log(LINEA);
  return 0;
}

process.exitCode = await main();
