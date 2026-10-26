import { expect, test } from "@playwright/test";
import { cargarScript, crearHoja } from "../helpers/planillaFalsa";
import { iniciarSesion } from "./helpers/sesion";

/**
 * "Actualizar precios": se cargan precios nuevos en la pantalla (costos de materiales y precios de venta), se guardan, y se
 * comprueba que llegan a lo que lee la planilla (/api/sheets/catalogo) y a lo que escribe el script real de la planilla
 * (cargado con una planilla falsa). Sólo contra el portal y la base LOCALES (`node scripts/e2e-local.mjs precios`).
 */

const EMAIL = process.env.E2E_LOCAL_EMAIL ?? "";
const PASSWORD = process.env.E2E_LOCAL_PASSWORD ?? "";
const TOKEN = process.env.E2E_SYNC_TOKEN ?? "";

type Celda = string | number | null;

test("los precios cargados en bloque se guardan y llegan a la planilla", async ({ page, request }, info) => {
  // Cada perfil (celular / escritorio) carga un valor distinto, para que siempre haya un cambio.
  const extra = info.project.name === "movil" ? 0 : 1000;
  const costoNuevo = 31_000 + extra;
  const ventaNueva = 9_800_000 + extra;
  const MATERIAL = "Arena gruesa zarandeada (total obra)";

  await iniciarSesion(page, EMAIL, PASSWORD);

  // 1) Costos de materiales.
  await page.goto("/dashboard/catalogo/actualizar-precios?que=materiales");
  await page.getByLabel(`Precio nuevo de ${MATERIAL}`).fill(String(costoNuevo));
  await page.getByLabel("Precio nuevo de Piedra partida 6-20 (total obra)").fill("no es un precio");
  await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeDisabled(); // un precio ilegible bloquea todo
  await page.getByLabel("Precio nuevo de Piedra partida 6-20 (total obra)").fill("");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await page.getByRole("button", { name: /^Confirmar 1 cambio/ }).click();
  await expect(page.getByText(/Se actualizó 1 precio/)).toBeVisible();

  // 2) Precios de venta.
  await page.getByRole("button", { name: "Precios de venta" }).click();
  await page.getByLabel("Precio nuevo de Hormigón 5x3").fill(String(ventaNueva));
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await page.getByRole("button", { name: /^Confirmar 1 cambio/ }).click();
  await expect(page.getByText(/Se actualizó 1 precio/)).toBeVisible();

  // 3) Lo que se ve en las listas.
  await page.goto("/dashboard/catalogo/materiales");
  await page.getByLabel("Buscar materiales").fill("Arena gruesa");
  await expect(page.locator("li").filter({ hasText: MATERIAL })).toContainText(new Intl.NumberFormat("es-AR").format(costoNuevo));

  // 4) Lo que lee la planilla.
  const api = await (await request.get("/api/sheets/catalogo", { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
  const articulo = (api.articulos as { fila: Celda[] }[]).find((a) => a.fila[0] === MATERIAL);
  expect(articulo?.fila[3]).toBe(costoNuevo);
  expect(String(articulo?.fila[4])).toMatch(/^\d{2}\/\d{2}\/\d{4}$/); // la fecha del precio se refrescó
  const venta = (api.catalogo as Celda[][]).find((f) => f[1] === "lista_hormigon_5x3");
  expect(venta?.[5]).toBe(ventaNueva);

  // 5) Lo que escribe el script real en la planilla.
  const hojas = { Proveedores: crearHoja(), "Artículos": crearHoja({ "3,2": 1450 }), "Precios y margen": crearHoja({ "6,1": "8x4", "6,2": 1 }) };
  cargarScript({ hojas, respuesta: { codigo: 200, cuerpo: api } }).sincronizar_(true);
  const hojaArticulos = hojas["Artículos"];
  const fila = [...hojaArticulos.valores.entries()].find(([k, v]) => k.endsWith(",1") && v === MATERIAL);
  expect(fila, "el material no está en la hoja Artículos").toBeTruthy();
  const nFila = Number(fila![0].split(",")[0]);
  expect(hojaArticulos.v(nFila, 4)).toBe(costoNuevo);
  const web = (hojas as unknown as Record<string, ReturnType<typeof crearHoja>>)["Catálogo web"];
  const hayVenta = [...web.valores.values()].includes(ventaNueva);
  expect(hayVenta, "el precio de venta nuevo no llegó a la hoja Catálogo web").toBe(true);
});
