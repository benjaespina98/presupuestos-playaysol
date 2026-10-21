// Prueba visual y funcional del portal, TODO en local:
//
//   npx supabase start        (la base local de este proyecto)
//   node scripts/e2e-local.mjs
//
// Qué hace, en orden:
//   1. Se niega a seguir si la API de Supabase no es de esta máquina (127.0.0.1 o
//      localhost, puertos 54321 a 54327). Las claves se leen en memoria de
//      `supabase status` y NUNCA se imprimen.
//   2. Recrea la base local (`supabase db reset --local`) para partir de cero.
//   3. Crea un usuario de prueba y los datos que la prueba necesita (stock inicial,
//      presupuestos, un proveedor desactivado con un material).
//   4. Levanta `next dev` en el puerto 3100 con las variables de la base LOCAL (las
//      variables del entorno pisan a .env.local, que no se lee).
//   5. Corre Playwright (tests/local) en celular (390x844) y escritorio (1280x800).
//      La prueba aborta cualquier pedido del navegador que no sea a localhost.
//   6. Apaga el servidor que levantó.
//
// Las capturas quedan en capturas-locales/ (ignorada por git).

import { spawn, spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { validarUrlLocal } from "./test-concurrencia-stock.mjs";
import {
  ITEM_SIN_STOCK,
  MATERIAL_DE_ESE_PROVEEDOR,
  POR_PROYECTO,
  PROVEEDOR_DESACTIVADO,
  STOCK_INICIAL,
} from "./e2e-local-datos.mjs";

const PROJECT_ID = "playaysol-presupuestos";
const CONTENEDOR_DB = `supabase_db_${PROJECT_ID}`;
const PUERTO_WEB = 3100;
const CLI = "npx -y supabase@2.121.0";

function fallar(mensaje) {
  console.error(`✗ ${mensaje}`);
  process.exit(1);
}

function claves() {
  const r = spawnSync(`${CLI} status -o env`, { encoding: "utf8", shell: true });
  if (r.status !== 0) fallar("No pude leer `supabase status`: ¿está levantada la base local (npx supabase start)?");
  const k = {};
  for (const linea of r.stdout.split(/\r?\n/)) {
    const m = /^([A-Z_]+)="?([^"]*)"?$/.exec(linea.trim());
    if (m) k[m[1]] = m[2];
  }
  if (!k.ANON_KEY || !k.SERVICE_ROLE_KEY || !k.API_URL) fallar("`supabase status` no devolvió lo esperado.");
  return k;
}

function psqlLocal(sql) {
  const existe = spawnSync("docker", ["ps", "--filter", `name=^${CONTENEDOR_DB}$`, "--format", "{{.Names}}"], { encoding: "utf8" });
  if (existe.stdout.trim() !== CONTENEDOR_DB) fallar(`No encuentro el contenedor ${CONTENEDOR_DB}.`);
  const r = spawnSync("docker", ["exec", "-i", CONTENEDOR_DB, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], {
    input: sql,
    encoding: "utf8",
  });
  if (r.status !== 0) fallar(`El SQL de preparación falló: ${r.stderr.split("\n")[0]}`);
}

async function esperarServidor() {
  const limite = Date.now() + 240_000;
  while (Date.now() < limite) {
    try {
      const r = await fetch(`http://127.0.0.1:${PUERTO_WEB}/login`);
      if (r.ok) return;
    } catch {
      /* todavía no */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  fallar("El servidor de desarrollo no arrancó a tiempo.");
}

function matarArbol(proc) {
  if (!proc?.pid) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(proc.pid), "/t", "/f"]);
  else proc.kill("SIGTERM");
}

async function main() {
  const k = claves();
  const problema = validarUrlLocal(k.API_URL);
  if (problema) fallar(problema);
  console.log(`Base local verificada (${new URL(k.API_URL).host}, proyecto ${PROJECT_ID}).`);

  console.log("Recreando la base local…");
  const reset = spawnSync(`${CLI} db reset --local`, { encoding: "utf8", shell: true });
  if (reset.status !== 0) fallar("`supabase db reset --local` falló.");

  const opciones = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(k.API_URL, k.SERVICE_ROLE_KEY, opciones);

  // Usuario de prueba (credenciales sólo en memoria y en el entorno del proceso hijo).
  const email = `e2e-${randomUUID().slice(0, 8)}@test.local`;
  const password = `E2e-${randomBytes(12).toString("hex")}`;
  const creado = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (creado.error) fallar(`No pude crear el usuario de prueba: ${creado.error.message}`);
  const userId = creado.data.user.id;

  // Stock inicial: dos piscinas con unidades, como "aperturas" del libro (igual que la migración).
  const claveItems = Object.values(POR_PROYECTO).map((p) => `'${p.claveItem}'`).join(", ");
  psqlLocal(`
    set session_replication_role = replica;
    update public.catalogo_items set stock = ${STOCK_INICIAL} where clave in (${claveItems});
    set session_replication_role = origin;
    select public.crear_aperturas_stock();
  `);

  // Un presupuesto por viewport, del usuario de prueba (así puede anularlo).
  for (const p of Object.values(POR_PROYECTO)) {
    const r = await admin.from("presupuestos").insert({
      tipo: "cercos",
      cliente_nombre: p.cliente,
      created_by: userId,
      datos: { v: 1, tipo: "cercos", fecha: "01/10/2026", cliente: { nombre: p.cliente }, medidas: { metrosLineales: 10 }, lineas: [], preciosBase: {}, totales: [] },
    });
    if (r.error) fallar(`No pude crear el presupuesto de prueba: ${r.error.message}`);
  }

  // Un proveedor desactivado con un material activo que entra en el pedido por defecto (8x4).
  const prov = await admin.from("proveedores").insert({ nombre: PROVEEDOR_DESACTIVADO, activo: false }).select("id").single();
  if (prov.error) fallar(`No pude crear el proveedor de prueba: ${prov.error.message}`);
  const mat = await admin.from("materiales").insert({
    nombre: MATERIAL_DE_ESE_PROVEEDOR,
    proveedor_id: prov.data.id,
    unidad: "unidad",
    precio: 100,
    aplica: "Siempre",
    cantidades: { "8x4": 10 },
  });
  if (mat.error) fallar(`No pude crear el material de prueba: ${mat.error.message}`);

  // Un ítem que no lleva stock existe en el seed (ITEM_SIN_STOCK).
  const sinStock = await admin.from("catalogo_items").select("stock").eq("clave", ITEM_SIN_STOCK.clave).limit(1).single();
  if (sinStock.error || sinStock.data.stock !== null) fallar("El ítem sin stock de la prueba no está como se esperaba en el seed.");

  const entorno = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: k.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: k.ANON_KEY,
    E2E_LOCAL_EMAIL: email,
    E2E_LOCAL_PASSWORD: password,
    E2E_LOCAL_API: k.API_URL,
  };

  console.log(`Levantando el portal en http://127.0.0.1:${PUERTO_WEB} (base local)…`);
  const servidor = spawn(`npx next dev -p ${PUERTO_WEB} -H 127.0.0.1`, { env: entorno, shell: true, stdio: "ignore" });
  let codigo = 1;
  try {
    await esperarServidor();
    const prueba = spawn("npx playwright test -c playwright.local.config.ts", { env: entorno, shell: true, stdio: "inherit" });
    codigo = await new Promise((resolve) => prueba.on("exit", (c) => resolve(c ?? 1)));
  } finally {
    matarArbol(servidor);
  }
  process.exit(codigo);
}

main().catch((e) => fallar(e instanceof Error ? e.message : String(e)));
