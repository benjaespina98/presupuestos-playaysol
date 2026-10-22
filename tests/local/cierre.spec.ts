import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  ITEM_SIN_STOCK,
  MATERIAL_DE_ESE_PROVEEDOR,
  POR_PROYECTO,
  PROVEEDOR_DESACTIVADO,
  STOCK_INICIAL,
} from "../../scripts/e2e-local-datos.mjs";

/**
 * Prueba de cierre antes del despliegue. Corre SOLO contra el portal local y la
 * base local (la prepara scripts/e2e-local.mjs). Las capturas van a
 * capturas-locales/<viewport>/ (ignorada por git). No imprime credenciales.
 */

const EMAIL = process.env.E2E_LOCAL_EMAIL ?? "";
const PASSWORD = process.env.E2E_LOCAL_PASSWORD ?? "";
const HOSTS_PERMITIDOS = new Set(["127.0.0.1", "localhost"]);

type Datos = (typeof POR_PROYECTO)["movil"];
const datosDe = (info: TestInfo): Datos => POR_PROYECTO[info.project.name as keyof typeof POR_PROYECTO];

let contadorCaptura = 0;
async function captura(page: Page, info: TestInfo, nombre: string) {
  const dir = path.join("capturas-locales", info.project.name);
  fs.mkdirSync(dir, { recursive: true });
  contadorCaptura += 1;
  await page.screenshot({ path: path.join(dir, `${String(contadorCaptura).padStart(2, "0")}-${nombre}.png`), fullPage: false });
}

/** Bloquea todo lo que no sea localhost: la prueba nunca habla con internet ni con producción. */
async function soloLocal(page: Page, bloqueados: string[]) {
  await page.context().route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:" || HOSTS_PERMITIDOS.has(url.hostname)) return route.continue();
    bloqueados.push(`${url.hostname}`);
    return route.abort();
  });
}

async function entrar(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("tu@email.com").fill(EMAIL);
  await page.getByPlaceholder("••••••••").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(/\/dashboard/);
}

const fila = (page: Page, texto: string | RegExp): Locator => page.locator("li").filter({ hasText: texto }).first();
const badge = (f: Locator, n: number | string) => f.getByTitle(new RegExp(`^(${n} en stock|stock negativo: ${n}|sin stock)$`)).first();

/** El número que muestra la fila (por el title del badge). */
async function stockDe(f: Locator): Promise<number> {
  const titulo = await f.locator("[title$='en stock'], [title^='stock negativo'], [title='sin stock']").first().getAttribute("title");
  if (!titulo) throw new Error("la fila no muestra stock");
  const neg = /^stock negativo: (-?\d+)$/.exec(titulo);
  if (neg) return Number(neg[1]);
  const pos = /^(\d+) en stock$/.exec(titulo);
  return pos ? Number(pos[1]) : 0;
}

/** "Activo" es un interruptor (un checkbox sr-only dentro de un label): se toca el label, como lo haría una persona. */
async function alternarActivo(page: Page, activo: boolean) {
  const interruptor = page.getByRole("switch", { name: "Activo" });
  if ((await interruptor.isChecked()) !== activo) await page.locator("label").filter({ hasText: /^Activo/ }).first().click();
  if (activo) await expect(interruptor).toBeChecked();
  else await expect(interruptor).not.toBeChecked();
}

/** Abre el menú "⋯" de la fila y elige una acción (Ingreso, Ajustar conteo o Historial). */
async function accion(page: Page, f: Locator, piscina: string, etiqueta: string) {
  await f.getByRole("button", { name: new RegExp(`^Más acciones de .*${piscina}`) }).click();
  await page.getByRole("menuitem", { name: etiqueta, exact: true }).click();
}

/** "Mostrar desactivados", "Mostrar anulados" y "Modo consulta" están dentro del panel "Filtros": se abre para tocarlos. */
async function abrirFiltros(page: Page) {
  if (!(await page.getByRole("dialog", { name: "Filtros" }).isVisible())) await page.getByRole("button", { name: /^Filtros/ }).click();
}

const abrirCatalogo = async (page: Page, nombre: string) => {
  await page.goto("/dashboard/catalogo");
  await expect(page.locator("li").filter({ hasText: nombre }).first()).toBeVisible();
};

test.describe.configure({ mode: "serial" });

let errores: string[] = [];
let bloqueados: string[] = [];

test.beforeEach(async ({ page }) => {
  errores = [];
  bloqueados = [];
  page.on("pageerror", (e) => errores.push(`pageerror: ${e.message}`));
  await soloLocal(page, bloqueados);
});

test.afterEach(async ({}, info) => {
  const dir = path.join("capturas-locales", info.project.name);
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, "_errores.txt"), `${info.title}: ${errores.length ? errores.join(" | ") : "sin errores de página"}; bloqueados: ${[...new Set(bloqueados)].join(",") || "ninguno"}\n`);
  expect(errores, "errores de JavaScript en la página").toEqual([]);
});

test("login y navegación", async ({ page }, info) => {
  expect(EMAIL && PASSWORD, "faltan las credenciales de la prueba (las pone scripts/e2e-local.mjs)").toBeTruthy();

  // Sin sesión, /dashboard manda al login y recuerda a dónde ir.
  await page.goto("/dashboard/historial");
  await expect(page).toHaveURL(/\/login\?redirectTo=%2Fdashboard%2Fhistorial/);
  await captura(page, info, "login");

  // Un redirectTo externo no se respeta (H-12).
  await page.goto("/login?redirectTo=https://sitio-malo.example");
  await page.getByPlaceholder("tu@email.com").fill(EMAIL);
  await page.getByPlaceholder("••••••••").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(/\/dashboard/);
  expect(new URL(page.url()).hostname).toBe("127.0.0.1");

  for (const [nombre, url] of [
    ["Historial", /\/dashboard\/historial/],
    ["Precios", /\/dashboard\/catalogo$/],
    ["Compras", /\/dashboard\/catalogo\/materiales/],
    ["Nuevo", /\/dashboard$/],
  ] as const) {
    await page.getByRole("link", { name: nombre, exact: true }).click();
    await expect(page).toHaveURL(url);
  }
  await captura(page, info, "inicio");
  expect(bloqueados, "pedidos a hosts que no son locales").toEqual([]);
});

test("stock: ingreso, venta con negativo, ajustes, anulación e historial", async ({ page }, info) => {
  const d = datosDe(info);
  await entrar(page);
  await abrirCatalogo(page, d.piscina);
  const f = fila(page, d.piscina);
  await expect(badge(f, STOCK_INICIAL)).toBeVisible();
  await captura(page, info, "catalogo-stock");

  // Ingreso: el número y el historial.
  await accion(page, f, d.piscina, "Ingreso");
  await page.getByLabel("Cantidad").fill("3");
  await page.getByLabel(/Referencia/).fill("Remito E2E");
  await captura(page, info, "dialogo-ingreso");
  await page.getByRole("button", { name: "Registrar ingreso" }).click();
  await expect(badge(f, STOCK_INICIAL + 3)).toBeVisible();
  await accion(page, f, d.piscina, "Historial");
  const historial = page.getByRole("dialog", { name: "Historial de stock" });
  await expect(historial.getByText("Remito E2E")).toBeVisible();
  await expect(historial.getByText("+3").first()).toBeVisible();
  await expect(historial.getByText("Stock inicial", { exact: true })).toBeVisible();
  await captura(page, info, "historial-ingreso");
  await historial.getByRole("button", { name: "Cerrar", exact: true }).click();

  // Venta mayor al stock: pide confirmación, queda negativo, marca y banner.
  const antes = STOCK_INICIAL + 3;
  await f.getByRole("button", { name: new RegExp(`^Venta de .*${d.piscina}`) }).click();
  await page.getByLabel("Cantidad").fill(String(antes + 2));
  await page.getByRole("button", { name: "Registrar venta" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "stock en negativo" })).toBeVisible();
  await captura(page, info, "venta-confirmar-negativo");
  await page.getByRole("button", { name: "Vender igual" }).click();
  await expect(page.getByText(/quedó en stock negativo \(−2\)/)).toBeVisible();
  await expect(f.getByText("Stock negativo")).toBeAttached(); // el texto va dentro de la marca (lectores de pantalla)
  await expect(f.getByTitle("stock negativo: -2")).toBeVisible();
  await captura(page, info, "venta-negativo-banner");

  // Ajuste: a 6, a 4 (conteo menor) y otra vez a 4 (igual: avisa que no hubo cambios).
  const ajustar = async (conteo: number, motivo: string) => {
    await accion(page, f, d.piscina, "Ajustar conteo");
    await page.getByLabel("Unidades que contaste").fill(String(conteo));
    await page.getByLabel("Motivo").fill(motivo);
    await page.getByRole("button", { name: "Guardar conteo" }).click();
  };
  await ajustar(6, "Conteo E2E uno");
  await expect(badge(f, 6)).toBeVisible();
  await ajustar(4, "Conteo E2E dos");
  await expect(badge(f, 4)).toBeVisible();
  await ajustar(4, "Conteo E2E tres");
  await expect(page.getByText(/coincidía con el stock cargado: no hubo cambios/)).toBeVisible();
  await expect(badge(f, 4)).toBeVisible();
  await captura(page, info, "ajuste-igual-sin-cambios");

  // Anular el último movimiento (el ajuste a 4): contra-asiento, el stock vuelve a 6.
  await accion(page, f, d.piscina, "Historial");
  const h = page.getByRole("dialog", { name: "Historial de stock" });
  await h.getByRole("button", { name: "Anular", exact: true }).first().click();
  const confirmar = page.getByRole("alertdialog");
  await confirmar.getByLabel("Motivo de la anulación").fill("Prueba de anulación E2E");
  await confirmar.getByRole("button", { name: "Anular", exact: true }).click();
  await expect(h.getByText("Contra-asiento")).toBeVisible();
  await expect(h.getByText("Anulado", { exact: true }).first()).toBeVisible();
  await captura(page, info, "historial-contra-asiento");
  await h.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(badge(f, 6)).toBeVisible();

  // Lo que no se puede anular: una anulación y un stock inicial (no tienen botón, dicen por qué).
  await accion(page, f, d.piscina, "Historial");
  const h2 = page.getByRole("dialog", { name: "Historial de stock" });
  await expect(h2.getByText("Es una anulación")).toBeVisible();
  await expect(h2.getByText("Se corrige con un ajuste")).toBeVisible();
  const filaAnulacion = h2.locator("li").filter({ hasText: "Contra-asiento" });
  await expect(filaAnulacion.getByRole("button", { name: "Anular" })).toHaveCount(0);
  const filaApertura = h2.locator("li").filter({ hasText: "Stock inicial" });
  await expect(filaApertura.getByRole("button", { name: "Anular" })).toHaveCount(0);
  await captura(page, info, "historial-no-anulable");
  await h2.getByRole("button", { name: "Cerrar", exact: true }).click();
  expect(bloqueados).toEqual([]);
});

test("stock: ítem sin stock, doble toque y dos pestañas", async ({ page, context }, info) => {
  const d = datosDe(info);
  await entrar(page);
  await abrirCatalogo(page, d.piscina);

  // Un ítem que no lleva stock: sin botones ni historial.
  const sin = fila(page, ITEM_SIN_STOCK.texto);
  await expect(sin.getByText("A pedido")).toBeVisible();
  await expect(sin.getByRole("button", { name: /Más acciones de|Venta de/ })).toHaveCount(0);
  await captura(page, info, "item-sin-stock");

  // Doble toque en Registrar: un solo movimiento.
  const f = fila(page, d.piscina);
  const antes = await stockDe(f);
  await accion(page, f, d.piscina, "Ingreso");
  await page.getByLabel("Cantidad").fill("1");
  await page.getByLabel(/Referencia/).fill("Doble toque E2E");
  await page.getByRole("button", { name: "Registrar ingreso" }).dblclick();
  await expect(badge(f, antes + 1)).toBeVisible();
  await accion(page, f, d.piscina, "Historial");
  const h = page.getByRole("dialog", { name: "Historial de stock" });
  await expect(h.getByText("Referencia: Doble toque E2E")).toHaveCount(1);
  await h.getByRole("button", { name: "Cerrar", exact: true }).click();

  // El mismo ítem en dos pestañas, vendiendo en ambas a la vez: se suman las dos ventas.
  const base = await stockDe(f);
  const otra = await context.newPage();
  const bloqueadosOtra: string[] = [];
  await soloLocal(otra, bloqueadosOtra);
  await abrirCatalogo(otra, d.piscina);
  const fOtra = fila(otra, d.piscina);

  const vender = async (p: Page, ff: Locator, ref: string) => {
    await ff.getByRole("button", { name: new RegExp(`^Venta de .*${d.piscina}`) }).click();
    await p.getByLabel("Cantidad").fill("1");
    await p.getByLabel(/Referencia/).fill(ref);
    await p.getByRole("button", { name: "Registrar venta" }).click();
  };
  const ambas = Promise.all([vender(page, f, "Pestaña A"), vender(otra, fOtra, "Pestaña B")]);
  await ambas;
  await expect(f.getByTitle(/en stock|stock negativo|sin stock/).first()).toBeVisible();
  await expect.poll(async () => stockDe(f), { timeout: 15_000 }).toBeLessThan(base);

  await page.reload();
  const fRecargada = fila(page, d.piscina);
  await expect.poll(async () => stockDe(fRecargada)).toBe(base - 2);
  await captura(page, info, "dos-pestanas");
  await accion(page, fRecargada, d.piscina, "Historial");
  const h2 = page.getByRole("dialog", { name: "Historial de stock" });
  await expect(h2.getByText("Venta").first()).toBeVisible();
  await captura(page, info, "dos-pestanas-historial");
  await otra.close();
  expect([...bloqueados, ...bloqueadosOtra]).toEqual([]);
});

test("presupuesto anulado: etiqueta, toggle y campos deshabilitados", async ({ page }, info) => {
  const d = datosDe(info);
  await entrar(page);
  await page.goto("/dashboard/historial");
  await page.getByPlaceholder("Buscar cliente...").fill(d.cliente);
  await expect(page.getByText(d.cliente).locator("visible=true").first()).toBeVisible();
  await captura(page, info, "historial-antes-de-anular");

  await page.getByRole("button", { name: "Anular", exact: true }).first().click();
  const dialogo = page.getByRole("alertdialog");
  // Sin motivo no deja.
  await dialogo.getByRole("button", { name: "Anular", exact: true }).click();
  await expect(dialogo.getByRole("alert")).toContainText(/motivo/i);
  await dialogo.getByLabel("Motivo de la anulación").fill("Prueba E2E de anulación");
  await captura(page, info, "dialogo-anular-presupuesto");
  await dialogo.getByRole("button", { name: "Anular", exact: true }).click();

  // Sale de la lista; el toggle lo trae de vuelta, con su etiqueta.
  await expect(page.getByText("Ningún presupuesto coincide con el filtro.")).toBeVisible();
  await abrirFiltros(page);
  await page.getByText(/Mostrar anulados/).click();
  await expect(page.getByText("Anulado", { exact: true }).locator("visible=true").first()).toBeVisible();
  await expect(page.getByText("Motivo: Prueba E2E de anulación").locator("visible=true").first()).toBeVisible();
  await captura(page, info, "historial-anulados");

  // Un anulado se ve y se exporta, pero NO se duplica.
  await expect(page.getByRole("link", { name: "Ver", exact: true }).locator("visible=true").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Duplicar/ }).locator("visible=true")).toHaveCount(0);

  // Se puede ver, pero no editar: campos deshabilitados, sin Guardar.
  await page.getByRole("link", { name: "Ver", exact: true }).first().click();
  await expect(page.getByText(/está anulado/)).toBeVisible();
  await expect(page.locator("fieldset[disabled]").first()).toBeAttached();
  await expect(page.getByRole("button", { name: /Guardar en la nube/ })).toHaveCount(0);
  const campos = page.locator("fieldset[disabled] input:visible");
  expect(await campos.count()).toBeGreaterThan(0);
  for (let i = 0; i < Math.min(await campos.count(), 5); i++) await expect(campos.nth(i)).toBeDisabled();
  await captura(page, info, "presupuesto-anulado-solo-lectura");
  expect(bloqueados).toEqual([]);
});

test("catálogo: desactivar y reactivar un ítem", async ({ page }, info) => {
  await entrar(page);
  await page.goto("/dashboard/catalogo");
  const f = fila(page, ITEM_SIN_STOCK.texto);
  await expect(f).toBeVisible();

  await f.getByRole("button", { name: "Editar" }).click();
  await alternarActivo(page, false);
  await captura(page, info, "editar-item-desactivar");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.locator("li").filter({ hasText: ITEM_SIN_STOCK.texto })).toHaveCount(0);

  await abrirFiltros(page);
  await page.getByText("Mostrar desactivados").click();
  const desactivada = fila(page, ITEM_SIN_STOCK.texto);
  await expect(desactivada.getByText("Desactivado")).toBeVisible();
  await captura(page, info, "catalogo-desactivados");

  await desactivada.getByRole("button", { name: "Editar" }).click();
  await alternarActivo(page, true);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(fila(page, ITEM_SIN_STOCK.texto).getByText("Desactivado")).toHaveCount(0);
  await captura(page, info, "catalogo-reactivado");
  expect(bloqueados).toEqual([]);
});

test("pedido con un proveedor desactivado: avisa y pide confirmar", async ({ page }, info) => {
  await entrar(page);
  await page.goto("/dashboard/catalogo/pedido");
  await expect(page.getByRole("region", { name: "Resumen del pedido" })).toBeVisible();
  await expect(page.getByText(MATERIAL_DE_ESE_PROVEEDOR).first()).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: PROVEEDOR_DESACTIVADO })).toBeVisible();
  await expect(page.getByRole("button", { name: "Guardar pedido" })).toBeDisabled();
  await captura(page, info, "pedido-proveedor-desactivado");

  await page.getByLabel("Pedir igual a proveedores desactivados").check();
  await expect(page.getByRole("button", { name: "Guardar pedido" })).toBeEnabled();
  await captura(page, info, "pedido-confirmado");
  expect(bloqueados).toEqual([]);
});
