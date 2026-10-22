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
//   5. Corre Playwright (tests/local) en celular (390x844) y escritorio (1280x800); con `pantallas` corre además las
//      pruebas de pantallas en 360x740, 390x844, 430x932, 768x1024, 1280x800, 1366x768 y el iPhone 13 emulado.
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

/** Casos difíciles (todo inventado) para comparar el portal, /api/sheets/catalogo y el script de la planilla. */
const SQL_CASOS_SYNC = `
  insert into public.proveedores (nombre, rubro, contacto, telefono, forma_pago, plazo, notas, activo) values
    ($$SYNC Ñandú & Hijos S.R.L.$$, $$Corralón$$, $$Müller "el Gringo"$$, $$+54 9 3534 11-2233 / +54 9 3534 44-5566$$, $$Contado$$, $$10-15 días$$, $$Línea 1
Línea 2 con "comillas" y 'simples'$$, true),
    ($$=HYPERLINK("http://sitio-ajeno.test","click")$$, $$+cmd$$, $$-1+1$$, $$@SUM(1)$$, null, null, null, true),
    ($$SYNC Proveedor desactivado$$, null, null, null, null, null, null, false);

  insert into public.materiales (nombre, proveedor_id, unidad, precio, precio_actualizado, rubro, aplica, usd_ref, notas, cantidades, activo)
    select $$SYNC Material con decimales$$, p.id, $$m2$$, 1234.56, '2026-10-05', $$Materiales$$, $$Siempre$$, null, $$Nota con salto
de línea y "comillas"$$, '{"8x4": 12}'::jsonb, true from public.proveedores p where p.nombre like 'SYNC Ñandú%';
  insert into public.materiales (nombre, proveedor_id, unidad, precio, rubro, usd_ref, cantidades, activo)
    select $$SYNC Material a confirmar$$, p.id, $$unidad$$, null, $$Materiales$$, null, '{}'::jsonb, true from public.proveedores p where p.nombre like 'SYNC Ñandú%';
  insert into public.materiales (nombre, unidad, precio, rubro, usd_ref, cantidades, activo) values
    ($$SYNC Material en dólares$$, $$unidad$$, null, $$Hidráulica$$, 114.68, '{}'::jsonb, true),
    ($$SYNC Material con precio enorme$$, $$unidad$$, 99999999999.99, $$Materiales$$, null, '{}'::jsonb, true),
    ($$=IMPORTXML("https://sitio-ajeno.test","//a")$$, $$unidad$$, 10, $$Materiales$$, null, '{}'::jsonb, true),
    ($$SYNC Material desactivado$$, $$unidad$$, 50, $$Materiales$$, null, '{}'::jsonb, false);

  insert into public.catalogo_items (tipo, clave, descripcion, precio, categoria, unidad, activo) values
    ('cercos', 'synctest_decimal', $$SYNC Precio con decimales$$, 1234.56, 'Cercos', 'ml', true),
    ('cercos', 'synctest_acotizar', $$SYNC Ítem a cotizar$$, null, 'Cercos', 'ml', true),
    ('cercos', 'synctest_enorme', $$SYNC Precio enorme$$, 9999999999.99, 'Cercos', 'obra', true),
    ('cercos', 'synctest_tildes', $$SYNC Ñandú — "comillas" & 'simples' <b>html</b> ¿qué? ¡árbol! 100%$$, 99, 'Cercos', 'ml', true),
    ('cercos', 'synctest_salto', $$SYNC Línea 1
Línea 2 con "comillas"$$, 10, 'Cercos', 'ml', true),
    ('cercos', 'synctest_formula1', $$=IMPORTXML("https://sitio-ajeno.test","//a")$$, 10, 'Cercos', 'ml', true),
    ('cercos', 'synctest_formula2', $$+54 9 3534 cmd$$, 10, 'Cercos', 'ml', true),
    ('cercos', 'synctest_formula3', $$-1+1$$, 10, 'Cercos', 'ml', true),
    ('cercos', 'synctest_formula4', $$@SUM(1)$$, 10, 'Cercos', 'ml', true),
    ('cercos', 'synctest_desactivado', $$SYNC Ítem desactivado$$, 500, 'Cercos', 'ml', false),
    ('cercos', 'synctest_stock_null', $$SYNC Sin control de stock$$, 100, 'Cercos', 'ml', true),
    ('cercos', 'synctest_stock_cero', $$SYNC Stock en cero$$, 100, 'Cercos', 'ml', true),
    ('cercos', 'synctest_stock_neg', $$SYNC Stock negativo$$, 100, 'Cercos', 'ml', true);
  set session_replication_role = replica;
  update public.catalogo_items set stock = 0 where clave = 'synctest_stock_cero';
  update public.catalogo_items set stock = -3 where clave = 'synctest_stock_neg';
  set session_replication_role = origin;
`;

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

  // Un catálogo de materiales de prueba más realista (nombres inventados): sirve para medir cuántas filas entran por pantalla.
  const proveedoresDemo = ["Distribuidora Norte E2E", "Pileta Mayorista E2E", "Ferretería Sur E2E"];
  for (const [i, nombre] of proveedoresDemo.entries()) {
    const pr = await admin.from("proveedores").insert({ nombre }).select("id").single();
    if (pr.error) fallar(`No pude crear el proveedor de prueba: ${pr.error.message}`);
    for (let j = 1; j <= 4; j++) {
      const m = await admin.from("materiales").insert({
        nombre: `Material de prueba ${i + 1}-${j}`,
        proveedor_id: pr.data.id,
        unidad: j % 2 ? "unidad" : "m2",
        precio: 1000 * (i + 1) * j + 0.5,
        aplica: "Siempre",
        cantidades: {},
      });
      if (m.error) fallar(`No pude crear el material de prueba: ${m.error.message}`);
    }
  }

  // Un ítem que no lleva stock existe en el seed (ITEM_SIN_STOCK).
  const sinStock = await admin.from("catalogo_items").select("stock").eq("clave", ITEM_SIN_STOCK.clave).limit(1).single();
  if (sinStock.error || sinStock.data.stock !== null) fallar("El ítem sin stock de la prueba no está como se esperaba en el seed.");

  // Casos difíciles para la prueba de sincronización con la planilla (sólo con `node scripts/e2e-local.mjs sync`).
  if (process.argv[2] === "sync") psqlLocal(SQL_CASOS_SYNC);

  // Token de la sincronización con la planilla: se genera acá, vive sólo en el entorno de esta prueba.
  const tokenSync = randomBytes(24).toString("hex");

  const entorno = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: k.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: k.ANON_KEY,
    // El endpoint /api/sheets/catalogo lee con la clave de servicio de la base LOCAL.
    SUPABASE_SERVICE_ROLE_KEY: k.SERVICE_ROLE_KEY,
    SHEETS_SYNC_TOKEN: tokenSync,
    E2E_SYNC_TOKEN: tokenSync,
    E2E_LOCAL_SERVICE_KEY: k.SERVICE_ROLE_KEY,
    E2E_LOCAL_EMAIL: email,
    E2E_LOCAL_PASSWORD: password,
    E2E_LOCAL_API: k.API_URL,
  };

  console.log(`Levantando el portal en http://127.0.0.1:${PUERTO_WEB} (base local)…`);
  const servidor = spawn(`npx next dev -p ${PUERTO_WEB} -H 127.0.0.1`, { env: entorno, shell: true, stdio: "ignore" });
  let codigo = 1;
  try {
    await esperarServidor();
    const spec = process.argv[2];
    // "pantallas" (o recorrido, edicion, compartir, documentos): las pruebas de pantallas en todos los tamaños
    // (playwright.responsive.config.ts). Cualquier otra cosa: las pruebas de siempre (playwright.local.config.ts).
    const PANTALLAS = ["pantallas", "recorrido", "edicion", "compartir", "documentos"];
    const pantallas = spec && PANTALLAS.includes(spec);
    const config = pantallas ? "playwright.responsive.config.ts" : "playwright.local.config.ts";
    const especifica = pantallas ? (spec === "pantallas" ? {} : { E2E_SPEC: spec }) : spec ? { E2E_SPEC: spec } : {};
    const prueba = spawn(`npx playwright test -c ${config}`, { env: { ...entorno, ...especifica }, shell: true, stdio: "inherit" });
    codigo = await new Promise((resolve) => prueba.on("exit", (c) => resolve(c ?? 1)));
  } finally {
    matarArbol(servidor);
  }
  process.exit(codigo);
}

main().catch((e) => fallar(e instanceof Error ? e.message : String(e)));
