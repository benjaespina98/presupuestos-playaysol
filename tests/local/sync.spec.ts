import { expect, test, type Page } from "@playwright/test";
import { cargarScript, crearHoja } from "../helpers/planillaFalsa";
import { formatARS } from "../../lib/format/ars";

/**
 * Sincronización con la planilla: compara, ítem por ítem, lo que MUESTRA el portal, lo que ENTREGA
 * /api/sheets/catalogo y lo que ESCRIBE el script (docs/sheets-sync/Sincronizar.gs, cargado tal cual con una
 * planilla falsa). Corre sólo contra el portal y la base LOCALES, con casos difíciles que carga
 * `node scripts/e2e-local.mjs sync`. La planilla real de Google y el disparador automático no se pueden
 * probar acá.
 */

const EMAIL = process.env.E2E_LOCAL_EMAIL ?? "";
const PASSWORD = process.env.E2E_LOCAL_PASSWORD ?? "";
const TOKEN = process.env.E2E_SYNC_TOKEN ?? "";
const API_BASE = process.env.E2E_LOCAL_API ?? "";
const SERVICE_KEY = process.env.E2E_LOCAL_SERVICE_KEY ?? "";

type Celda = string | number | null;
interface ItemBase {
  tipo: string;
  clave: string;
  descripcion: string | null;
  precio: number | null;
  stock: number | null;
  activo: boolean;
  categoria: string | null;
  unidad: string | null;
}
interface MaterialBase {
  nombre: string;
  precio: number | null;
  usd_ref: number | null;
  activo: boolean;
  proveedor_id: string | null;
  notas: string | null;
}
interface ProveedorBase {
  nombre: string;
  activo: boolean;
  notas: string | null;
  contacto: string | null;
}

/** Lo que hay en la base LOCAL (con la clave de servicio de la base local; nunca va a producción). */
async function leerTabla<T>(tabla: string, filtro: string): Promise<T[]> {
  expect(API_BASE.startsWith("http://127.0.0.1") || API_BASE.startsWith("http://localhost"), "la base tiene que ser local").toBe(true);
  const r = await fetch(`${API_BASE}/rest/v1/${tabla}?select=*&${filtro}`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
  expect(r.ok).toBe(true);
  return (await r.json()) as T[];
}

async function entrar(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("tu@email.com").fill(EMAIL);
  await page.getByPlaceholder("••••••••").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(/\/dashboard/);
}

const EMPIEZA_COMO_FORMULA = /^[=+\-@\t\r]/;

test.describe.configure({ mode: "serial" });

test("el endpoint: sin token 401, token malo 401, POST no existe, con token 200", async ({ request }) => {
  expect((await request.get("/api/sheets/catalogo")).status()).toBe(401);
  expect((await request.get("/api/sheets/catalogo", { headers: { Authorization: "Bearer incorrecto" } })).status()).toBe(401);
  expect((await request.get("/api/sheets/catalogo", { headers: { Authorization: TOKEN } })).status()).toBe(401); // sin "Bearer"
  const sinToken = await request.get("/api/sheets/catalogo");
  expect(await sinToken.text()).not.toMatch(/SYNC|synctest|catalogo_items/); // el 401 no filtra nada
  for (const metodo of ["post", "put", "patch", "delete"] as const) {
    expect((await request[metodo]("/api/sheets/catalogo", { headers: { Authorization: `Bearer ${TOKEN}` }, data: {} })).status()).toBe(405);
  }
  const ok = await request.get("/api/sheets/catalogo", { headers: { Authorization: `Bearer ${TOKEN}` } });
  expect(ok.status()).toBe(200);
  expect(ok.headers()["cache-control"]).toContain("no-store");
});

test("lo que entrega el endpoint coincide, ítem por ítem, con la base", async ({ request }) => {
  const api = await (await request.get("/api/sheets/catalogo", { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
  const items = await leerTabla<ItemBase>("catalogo_items", "clave=like.synctest_*");
  expect(items.length).toBeGreaterThanOrEqual(13);

  for (const i of items) {
    const fila = (api.catalogo as Celda[][]).find((f) => f[1] === i.clave);
    expect(fila, `el endpoint no trae ${i.clave}`).toBeTruthy();
    const [, clave, descripcion, categoria, unidad, precio, stock, estado] = fila!;
    expect(clave).toBe(i.clave);
    expect(descripcion).toBe(i.descripcion ?? ""); // tildes, comillas, saltos de línea y fórmulas, SIN tocar
    expect(categoria).toBe(i.categoria ?? "");
    expect(unidad).toBe(i.unidad ?? "");
    expect(precio).toBe(i.precio === null ? "A cotizar" : i.precio); // los decimales y los números enormes no se redondean
    expect(stock).toBe(i.stock === null ? "" : i.stock); // null → vacío, 0 → 0, negativo → negativo
    expect(estado).toBe(i.activo ? "Activo" : "Desactivado");

    // "precios" y "stock" sólo traen lo activo.
    const k = `${i.tipo}:${i.clave}`;
    if (i.activo) {
      expect(api.precios[k]).toBe(i.precio);
      if (i.stock === null) expect(api.stock[k]).toBeUndefined();
      else expect(api.stock[k]).toBe(i.stock);
    } else {
      expect(k in api.precios).toBe(false);
      expect(k in api.stock).toBe(false);
    }
  }

  const proveedores = await leerTabla<ProveedorBase>("proveedores", "nombre=like.*");
  const activos = proveedores.filter((p) => p.activo).map((p) => p.nombre);
  const enApi = (api.proveedores as Celda[][]).map((f) => f[0]);
  for (const nombre of activos) expect(enApi, `falta el proveedor ${nombre}`).toContain(nombre);
  for (const p of proveedores.filter((x) => !x.activo)) expect(enApi).not.toContain(p.nombre); // los desactivados no van a la hoja

  const materiales = await leerTabla<MaterialBase>("materiales", "nombre=like.*");
  const nombresApi = (api.articulos as { fila: Celda[]; usd: boolean }[]).map((a) => a.fila[0]);
  for (const m of materiales.filter((x) => x.activo)) {
    const a = (api.articulos as { fila: Celda[]; usd: boolean }[]).find((x) => x.fila[0] === m.nombre);
    expect(a, `falta el material ${m.nombre}`).toBeTruthy();
    const enDolares = m.usd_ref !== null && m.usd_ref > 0;
    expect(a!.usd).toBe(enDolares);
    expect(a!.fila[3]).toBe(enDolares ? null : m.precio); // en dólares, el precio en pesos lo calcula la planilla
  }
  for (const m of materiales.filter((x) => !x.activo)) expect(nombresApi).not.toContain(m.nombre);
});

test("el portal muestra lo mismo que entrega el endpoint (catálogo)", async ({ page, request }) => {
  const api = await (await request.get("/api/sheets/catalogo", { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
  await entrar(page);
  await page.goto("/dashboard/catalogo");
  const buscador = page.getByLabel("Buscar en el catálogo");
  await buscador.fill("SYNC");

  const filasApi = (api.catalogo as Celda[][]).filter((f) => String(f[1]).startsWith("synctest_") && f[7] === "Activo" && !EMPIEZA_COMO_FORMULA.test(String(f[2])));
  expect(filasApi.length).toBeGreaterThanOrEqual(8);
  for (const f of filasApi) {
    const descripcion = String(f[2]);
    // Una descripción con saltos de línea se ve en una línea: se busca por su primera línea.
    const primera = descripcion.split("\n")[0];
    const li = page.locator("li").filter({ hasText: primera }).first();
    await expect(li, `el portal no muestra ${f[1]}`).toBeVisible();
    const textoFila = (await li.innerText()).replace(/\s+/g, " ");
    if (f[5] === "A cotizar") expect(textoFila).toContain("A cotizar");
    else expect(textoFila).toContain(formatARS(f[5] as number));
    if (f[6] === "") expect(textoFila).toContain("A pedido");
    else if ((f[6] as number) < 0) await expect(li.getByTitle(`stock negativo: ${f[6]}`)).toBeVisible();
    else if (f[6] === 0) await expect(li.getByTitle("sin stock")).toBeVisible();
  }

  // Los desactivados NO se ven hasta que se pide, y entonces llevan su etiqueta (en la planilla: Estado "Desactivado").
  await expect(page.locator("li").filter({ hasText: "SYNC Ítem desactivado" })).toHaveCount(0);
  // Celular: "Filtros" (la hoja). Escritorio: "Más filtros" (el panel con los interruptores).
  const abrir = page.getByRole("button", { name: /^(Más filtros|Filtros)/ });
  if (await abrir.isVisible()) await abrir.click();
  await page.getByLabel("Mostrar desactivados").check({ force: true });
  await expect(page.locator("li").filter({ hasText: "SYNC Ítem desactivado" }).getByText("Desactivado", { exact: true })).toBeVisible();
});

test("el portal muestra lo mismo que entrega el endpoint (materiales y proveedores)", async ({ page, request }) => {
  const api = await (await request.get("/api/sheets/catalogo", { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
  await entrar(page);

  await page.goto("/dashboard/catalogo/materiales");
  await page.getByLabel("Buscar materiales").fill("SYNC Material");
  for (const a of (api.articulos as { fila: Celda[]; usd: boolean }[]).filter((x) => String(x.fila[0]).startsWith("SYNC Material"))) {
    const li = page.locator("li").filter({ hasText: String(a.fila[0]) }).first();
    await expect(li, `el portal no muestra ${a.fila[0]}`).toBeVisible();
    const texto = (await li.innerText()).replace(/\s+/g, " ");
    // En dólares el endpoint manda precio vacío (la planilla multiplica); el portal muestra el precio en pesos guardado, o "A confirmar".
    if (a.fila[3] !== null) expect(texto).toContain(formatARS(a.fila[3] as number));
    else expect(texto).toMatch(/A confirmar|\$/);
  }

  await page.goto("/dashboard/catalogo/proveedores");
  await page.getByLabel("Buscar proveedores").fill("SYNC");
  for (const fila of (api.proveedores as Celda[][]).filter((f) => String(f[0]).startsWith("SYNC"))) {
    await expect(page.locator("li").filter({ hasText: String(fila[0]) }).first(), `el portal no muestra ${fila[0]}`).toBeVisible();
  }
});

test("lo que escribe el script de la planilla: igual al endpoint, y las fórmulas ajenas quedan como texto", async ({ request }) => {
  const api = await (await request.get("/api/sheets/catalogo", { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
  const hojas = {
    Proveedores: crearHoja(),
    "Artículos": crearHoja({ "3,2": 1450 }),
    "Precios y margen": crearHoja({ "6,1": "8x4", "6,2": 1 }),
  };
  const script = cargarScript({ hojas, respuesta: { codigo: 200, cuerpo: api } });
  script.sincronizar_(true);

  // "Catálogo web": una fila por precio de venta, TODAS las columnas, tal cual las manda el endpoint.
  const catalogo = hojas as unknown as Record<string, ReturnType<typeof crearHoja>>;
  const hoja = catalogo["Catálogo web"];
  expect(hoja, "el script no creó la hoja Catálogo web").toBeTruthy();
  (api.catalogo as Celda[][]).forEach((fila, i) => {
    fila.forEach((valor, j) => {
      const f = i + 2; // la fila 1 son los encabezados
      const c = j + 1;
      expect(hoja.fx(f, c), `fila ${f} col ${c} quedó como FÓRMULA`).toBeUndefined();
      expect(hoja.v(f, c) ?? "").toBe(valor ?? "");
    });
  });

  // Ninguna celda de ninguna hoja puede ser una fórmula salvo las legítimas (USD × tipo de cambio).
  for (const nombre of ["Proveedores", "Artículos"] as const) {
    const h = hojas[nombre];
    for (const [k] of h.formulas) {
      const [, col] = k.split(",").map(Number);
      expect(nombre === "Artículos" && col === 4, `fórmula inesperada en ${nombre} (${k})`).toBe(true);
    }
  }

  // Los proveedores y artículos con "=", "+", "-" o "@" al principio se guardaron como texto, sin apóstrofe visible.
  const peligrosos = (api.proveedores as Celda[][]).map((f) => String(f[0])).filter((n) => EMPIEZA_COMO_FORMULA.test(n));
  expect(peligrosos.length).toBeGreaterThan(0);
  const valoresProveedores = [...hojas.Proveedores.valores.values()].map(String);
  for (const nombre of peligrosos) expect(valoresProveedores).toContain(nombre);
  const peligrososArticulos = (api.articulos as { fila: Celda[] }[]).map((a) => String(a.fila[0])).filter((n) => EMPIEZA_COMO_FORMULA.test(n));
  expect(peligrososArticulos.length).toBeGreaterThan(0);
  const valoresArticulos = [...hojas["Artículos"].valores.values()].map(String);
  for (const nombre of peligrososArticulos) expect(valoresArticulos).toContain(nombre);

  // Un segundo pase sin cambios no vuelve a escribir (la versión no cambió).
  const escrituras = Object.values(hojas).reduce((s, h) => s + h.escrituras(), 0) + hoja.escrituras();
  script.sincronizar_(false);
  const despues = Object.values(hojas).reduce((s, h) => s + h.escrituras(), 0) + hoja.escrituras();
  expect(despues).toBe(escrituras);
});
