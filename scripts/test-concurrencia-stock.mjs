// Prueba de concurrencia del stock contra la base LOCAL de este proyecto.
//
//   npx supabase start
//   node scripts/test-concurrencia-stock.mjs
//
// Qué verifica (con las funciones reales, vía la API REST local):
//   1. 20 ventas simultáneas de 1 unidad sobre un ítem con stock 20 terminan en 0,
//      con 20 movimientos y sin ningún error ni venta perdida.
//   2. Repetir EXACTAMENTE las mismas 20 llamadas con las mismas claves no cambia
//      nada: todas vuelven con repetido = true.
//   3. verificar_consistencia_stock() sigue vacía.
//
// SEGURIDAD: se niega a correr si la URL no es de esta máquina (127.0.0.1 o
// localhost) y del rango de puertos de este proyecto (54321 a 54327). Las claves
// se leen en memoria de `supabase status` de la base local y no se imprimen.
// Deja datos de prueba en la base local (el libro es de sólo agregar):
// `npx supabase db reset` la deja limpia.

import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const PROJECT_ID = "playaysol-presupuestos";
const HOSTS_LOCALES = new Set(["127.0.0.1", "localhost", "[::1]"]);
const PUERTO_MIN = 54321;
const PUERTO_MAX = 54327;
const VENTAS = 20;

function fallar(mensaje) {
  console.error(`✗ ${mensaje}`);
  process.exit(1);
}

/** Valida que la URL sea de la base local de ESTE proyecto. Se exporta lógica pura para poder probarla. */
export function validarUrlLocal(texto) {
  let url;
  try {
    url = new URL(texto);
  } catch {
    return `La URL no es válida: ${texto}`;
  }
  if (!HOSTS_LOCALES.has(url.hostname)) {
    return `Me niego a correr: el host "${url.hostname}" no es local. Esta prueba sólo corre contra 127.0.0.1 o localhost.`;
  }
  const puerto = Number(url.port);
  if (!Number.isInteger(puerto) || puerto < PUERTO_MIN || puerto > PUERTO_MAX) {
    return `Me niego a correr: el puerto "${url.port}" no es de este proyecto (${PUERTO_MIN} a ${PUERTO_MAX}).`;
  }
  return null;
}

function clavesLocales() {
  const r = spawnSync("npx -y supabase@2.121.0 status -o env", { encoding: "utf8", shell: true });
  if (r.status !== 0) fallar("No pude leer `supabase status`: ¿está levantada la base local (npx supabase start)?");
  const claves = {};
  for (const linea of r.stdout.split(/\r?\n/)) {
    const m = /^([A-Z_]+)="?([^"]*)"?$/.exec(linea.trim());
    if (m) claves[m[1]] = m[2];
  }
  if (!claves.ANON_KEY || !claves.SERVICE_ROLE_KEY || !claves.API_URL) fallar("`supabase status` no devolvió las claves esperadas.");
  return claves;
}

async function main() {
  const { ANON_KEY, SERVICE_ROLE_KEY, API_URL } = clavesLocales();
  const url = process.env.SUPABASE_LOCAL_URL ?? API_URL;
  const problema = validarUrlLocal(url);
  if (problema) fallar(problema);
  console.log(`Base local verificada (${new URL(url).host}, proyecto ${PROJECT_ID}).`);

  const opciones = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(url, SERVICE_ROLE_KEY, opciones);
  const corrida = randomUUID().slice(0, 8);

  // Un usuario de prueba con sesión real (las funciones validan auth.uid()).
  const email = `concurrencia-${corrida}@test.local`;
  const password = `Prueba-${randomUUID()}`;
  const creado = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (creado.error) fallar(`No pude crear el usuario de prueba: ${creado.error.message}`);
  const usuario = createClient(url, ANON_KEY, opciones);
  const sesion = await usuario.auth.signInWithPassword({ email, password });
  if (sesion.error) fallar(`No pude iniciar sesión con el usuario de prueba: ${sesion.error.message}`);

  // Un ítem que lleva stock, arrancado en 0 y cargado a 20 con un ingreso.
  const item = await admin
    .from("catalogo_items")
    .insert({ tipo: "piscinas", clave: `indusplast_concurrencia_${corrida}`, descripcion: "Prueba de concurrencia", precio: 1, stock: 0 })
    .select("id")
    .single();
  if (item.error) fallar(`No pude crear el ítem de prueba: ${item.error.message}`);
  const itemId = item.data.id;

  const ingreso = await usuario.rpc("registrar_movimiento_stock", {
    p_item: itemId, p_tipo: "ingreso", p_cantidad: VENTAS, p_idempotency_key: `conc-ingreso-${corrida}`,
  });
  if (ingreso.error) fallar(`El ingreso inicial falló: ${ingreso.error.message}`);

  const claves = Array.from({ length: VENTAS }, (_, i) => `conc-venta-${corrida}-${String(i).padStart(2, "0")}`);
  const vender = (clave) =>
    usuario.rpc("registrar_movimiento_stock", { p_item: itemId, p_tipo: "venta", p_cantidad: 1, p_idempotency_key: clave });

  const leerStock = async () => (await admin.from("catalogo_items").select("stock").eq("id", itemId).single()).data?.stock;
  const contarVentas = async () =>
    (await admin.from("movimientos_stock").select("id", { count: "exact", head: true }).eq("item_id", itemId).eq("tipo", "venta")).count;

  let fallos = 0;
  const verificar = (condicion, mensaje) => {
    console.log(`${condicion ? "✓" : "✗"} ${mensaje}`);
    if (!condicion) fallos++;
  };

  // 1) 20 ventas simultáneas.
  const primera = await Promise.all(claves.map(vender));
  verificar(primera.every((r) => !r.error), `las ${VENTAS} ventas simultáneas terminaron sin error`);
  verificar(primera.every((r) => r.data?.repetido === false), "ninguna figura como repetida");
  const saldos = primera.map((r) => r.data?.stock_resultante).sort((a, b) => a - b);
  verificar(
    JSON.stringify(saldos) === JSON.stringify(Array.from({ length: VENTAS }, (_, i) => i)),
    `cada venta vio un saldo distinto (0 a ${VENTAS - 1}): ninguna se pisó con otra`
  );
  verificar((await leerStock()) === 0, "el stock terminó en 0");
  verificar((await contarVentas()) === VENTAS, `hay exactamente ${VENTAS} movimientos de venta`);

  // 2) Las mismas llamadas con las mismas claves: no cambia nada.
  const segunda = await Promise.all(claves.map(vender));
  verificar(segunda.every((r) => !r.error && r.data?.repetido === true), "repetir las mismas llamadas devuelve repetido = true en todas");
  verificar(
    segunda.every((r, i) => r.data?.movimiento_id === primera[i].data?.movimiento_id),
    "y devuelve el movimiento original de cada una"
  );
  verificar((await leerStock()) === 0, "el stock sigue en 0");
  verificar((await contarVentas()) === VENTAS, `sigue habiendo ${VENTAS} movimientos de venta`);

  // 3) Consistencia.
  const consistencia = await usuario.rpc("verificar_consistencia_stock");
  verificar(!consistencia.error && consistencia.data.length === 0, "verificar_consistencia_stock() está vacía");

  console.log(fallos === 0 ? "\nPRUEBA DE CONCURRENCIA: OK" : `\nPRUEBA DE CONCURRENCIA: FALLÓ (${fallos})`);
  process.exit(fallos === 0 ? 0 : 1);
}

// Sólo corre si se ejecuta directo (así se puede importar validarUrlLocal desde un test).
if (import.meta.url === new URL(process.argv[1], "file://").href || process.argv[1]?.endsWith("test-concurrencia-stock.mjs")) {
  main().catch((e) => fallar(e instanceof Error ? e.message : String(e)));
}
