import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { medirPagina, type Medidas } from "./helpers/medir";
import { asegurarDatosDePantallas } from "./helpers/datos";

/**
 * Recorre TODAS las pantallas del portal LOCAL (login, Nuevo con sus 5 calculadoras, Historial, las 5 pestañas
 * del Catálogo) y las ventanas que se abren desde ellas (edición de material, proveedor e ítem, selectores, menús,
 * detalle de pedido, diálogos de stock), en cada tamaño de pantalla del proyecto de Playwright, y mide con los
 * estilos reales:
 *
 *   - contraste de cada control visible: texto 4,5:1 (3:1 si es grande), íconos y bordes 3:1, contra el fondo real;
 *   - textos visibles menores a 13 px;
 *   - zonas táctiles menores a 44 px;
 *   - scroll horizontal de la página.
 *
 * Se corre con `node scripts/e2e-local.mjs recorrido` (o `npx playwright test -c playwright.responsive.config.ts`
 * con la base y el portal locales ya levantados). Con E2E_FASE=antes|despues guarda el informe y las capturas en
 * capturas-locales/<fase>/<proyecto>/ (ignorada por git). Sólo mira: no guarda ni cambia datos.
 */

const EMAIL = process.env.E2E_LOCAL_EMAIL ?? "";
const PASSWORD = process.env.E2E_LOCAL_PASSWORD ?? "";
const FASE = process.env.E2E_FASE ?? "despues";
const HOSTS_PERMITIDOS = new Set(["127.0.0.1", "localhost"]);

interface Paso {
  nombre: string;
  ruta: string;
  /** Lo que hay que tocar para llegar al estado (menú abierto, ventana de edición...). */
  preparar?: (page: Page) => Promise<void>;
}

const tocar = (page: Page, nombre: string | RegExp) => page.getByRole("button", { name: nombre }).first().click({ timeout: 8_000 });
const cerrar = async (page: Page) => {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
};

const PASOS: Paso[] = [
  { nombre: "inicio-nuevo", ruta: "/dashboard" },
  { nombre: "calc-piscinas", ruta: "/dashboard/piscinas" },
  { nombre: "calc-cercos", ruta: "/dashboard/cercos" },
  { nombre: "calc-cobertores", ruta: "/dashboard/cobertores" },
  { nombre: "calc-revestimientos", ruta: "/dashboard/revestimientos" },
  { nombre: "calc-losetas", ruta: "/dashboard/losetas" },
  { nombre: "historial", ruta: "/dashboard/historial" },
  { nombre: "historial-filtros", ruta: "/dashboard/historial", preparar: (p) => tocar(p, /^Filtros/) },
  { nombre: "historial-anular", ruta: "/dashboard/historial", preparar: (p) => tocar(p, /^Anular/) },
  { nombre: "catalogo-precios", ruta: "/dashboard/catalogo" },
  { nombre: "catalogo-filtros", ruta: "/dashboard/catalogo", preparar: (p) => tocar(p, /^Filtros/) },
  { nombre: "catalogo-menu-stock", ruta: "/dashboard/catalogo", preparar: (p) => tocar(p, /^Filtrar por stock/) },
  { nombre: "catalogo-menu-orden", ruta: "/dashboard/catalogo", preparar: (p) => tocar(p, /^Ordenar/) },
  { nombre: "catalogo-agregar-item", ruta: "/dashboard/catalogo", preparar: (p) => tocar(p, /^Agregar/) },
  { nombre: "catalogo-editar-item", ruta: "/dashboard/catalogo", preparar: (p) => tocar(p, /^Editar$/) },
  { nombre: "catalogo-menu-fila", ruta: "/dashboard/catalogo", preparar: (p) => tocar(p, /^Más acciones de/) },
  { nombre: "catalogo-venta", ruta: "/dashboard/catalogo", preparar: (p) => tocar(p, /^Venta de/) },
  {
    nombre: "catalogo-ingreso",
    ruta: "/dashboard/catalogo",
    preparar: async (p) => {
      await tocar(p, /^Más acciones de/);
      await p.getByRole("menuitem", { name: "Ingreso" }).click();
    },
  },
  { nombre: "catalogo-materiales", ruta: "/dashboard/catalogo/materiales" },
  { nombre: "materiales-filtros", ruta: "/dashboard/catalogo/materiales", preparar: (p) => tocar(p, /^Filtros/) },
  { nombre: "materiales-menu-proveedor", ruta: "/dashboard/catalogo/materiales", preparar: (p) => tocar(p, /^Filtrar por proveedor/) },
  { nombre: "material-nuevo", ruta: "/dashboard/catalogo/materiales", preparar: (p) => tocar(p, /^Agregar material/) },
  { nombre: "material-editar", ruta: "/dashboard/catalogo/materiales", preparar: (p) => tocar(p, /^Editar Material de prueba 1-1/) },
  {
    nombre: "material-selector-proveedor",
    ruta: "/dashboard/catalogo/materiales",
    preparar: async (p) => {
      await tocar(p, /^Editar Material de prueba 1-1/);
      await tocar(p, /^Proveedor:/);
    },
  },
  {
    nombre: "material-selector-aplica",
    ruta: "/dashboard/catalogo/materiales",
    preparar: async (p) => {
      await tocar(p, /^Editar Material de prueba 1-1/);
      await tocar(p, /^Cuándo se pide:/);
    },
  },
  { nombre: "catalogo-proveedores", ruta: "/dashboard/catalogo/proveedores" },
  { nombre: "proveedor-nuevo", ruta: "/dashboard/catalogo/proveedores", preparar: (p) => tocar(p, /^Agregar proveedor/) },
  { nombre: "proveedor-editar", ruta: "/dashboard/catalogo/proveedores", preparar: (p) => tocar(p, /^Editar Distribuidora Norte E2E/) },
  { nombre: "catalogo-armar-pedido", ruta: "/dashboard/catalogo/pedido" },
  { nombre: "pedido-menu-exportar", ruta: "/dashboard/catalogo/pedido", preparar: (p) => p.getByLabel("Exportar").first().click({ timeout: 8_000 }) },
  { nombre: "catalogo-pedidos", ruta: "/dashboard/catalogo/pedidos" },
  { nombre: "pedido-detalle", ruta: "/dashboard/catalogo/pedidos", preparar: (p) => tocar(p, /^Abrir PED/) },
  {
    nombre: "pedido-anular",
    ruta: "/dashboard/catalogo/pedidos",
    preparar: async (p) => {
      await tocar(p, /^Abrir PED/);
      await tocar(p, /^Anular pedido/);
    },
  },
];

/** Los resultados de cada paso, para las pruebas que vienen después (corren en orden, en el mismo proceso). */
const resultados = new Map<string, Medidas & { omitido?: string }>();
let conSesion = false;

async function soloLocal(page: Page, bloqueados: string[]) {
  await page.context().route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:" || HOSTS_PERMITIDOS.has(url.hostname)) return route.continue();
    bloqueados.push(url.hostname);
    return route.abort();
  });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  // Un pedido guardado y presupuestos en el historial, para llegar a sus ventanas.
  await asegurarDatosDePantallas();
});

test("recorrido: mide todas las pantallas y ventanas", async ({ page }, info) => {
  test.setTimeout(900_000);
  expect(EMAIL && PASSWORD, "faltan las credenciales de la prueba").toBeTruthy();
  const bloqueados: string[] = [];
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  await soloLocal(page, bloqueados);
  const proyecto = info.project.name;
  const dir = path.join("capturas-locales", FASE, proyecto);
  fs.mkdirSync(dir, { recursive: true });

  const medir = async (nombre: string, extra?: string) => {
    const m = await medirPagina(page);
    resultados.set(`${proyecto}|${nombre}`, { ...m, omitido: extra });
    await page.screenshot({ path: path.join(dir, `${nombre}.png`), fullPage: false });
  };

  // Login (sin sesión).
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await medir("login");
  await page.getByPlaceholder("tu@email.com").fill(EMAIL);
  await page.getByPlaceholder("••••••••").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(/\/dashboard/);
  conSesion = true;

  for (const paso of PASOS) {
    await page.goto(paso.ruta);
    await page.waitForLoadState("networkidle");
    let omitido: string | undefined;
    if (paso.preparar) {
      try {
        await paso.preparar(page);
        await page.waitForTimeout(350);
      } catch (e) {
        omitido = `no se pudo llegar a este estado: ${(e instanceof Error ? e.message : String(e)).split("\n")[0]}`;
      }
    }
    await medir(paso.nombre, omitido);
    if (paso.preparar) {
      await cerrar(page);
      await cerrar(page);
    }
  }

  const lineas: string[] = [];
  for (const [clave, m] of resultados) {
    if (!clave.startsWith(`${proyecto}|`)) continue;
    const n = clave.split("|")[1];
    lineas.push(
      `${n}: controles=${m.controles} contraste=${m.contraste.length} textos<13px=${m.textosChicos.length} plano=${m.textosDePlano} zonas<44px=${m.zonasChicas.length} cursor=${m.cursores.length} scrollH=${m.scrollHorizontal}${m.omitido ? ` OMITIDO(${m.omitido})` : ""}`
    );
    for (const c of m.contraste) lineas.push(`   contraste: ${c}`);
    for (const c of m.textosChicos) lineas.push(`   texto chico: ${c}`);
    for (const c of m.zonasChicas) lineas.push(`   zona chica: ${c}`);
    for (const c of m.cursores) lineas.push(`   cursor: ${c}`);
  }
  lineas.push(`errores de página: ${errores.join(" | ") || "ninguno"}`, `pedidos bloqueados (no locales): ${[...new Set(bloqueados)].join(",") || "ninguno"}`);
  fs.writeFileSync(path.join(dir, "_medidas.txt"), lineas.join("\n"));
  expect(errores, "errores de JavaScript en la página").toEqual([]);
  expect(bloqueados, "la prueba no debe hablar con nada que no sea local").toEqual([]);
});

function falloPorPaso(proyecto: string, campo: "contraste" | "textosChicos" | "zonasChicas" | "cursores") {
  const filas: string[] = [];
  for (const [clave, m] of resultados) {
    if (!clave.startsWith(`${proyecto}|`)) continue;
    for (const x of m[campo]) filas.push(`${clave.split("|")[1]}: ${x}`);
  }
  return filas;
}

test("todos los pasos del recorrido se pudieron hacer", ({}, info) => {
  expect(conSesion, "el recorrido no llegó a iniciar sesión").toBe(true);
  const omitidos = [...resultados].filter(([k, m]) => k.startsWith(`${info.project.name}|`) && m.omitido).map(([k, m]) => `${k}: ${m.omitido}`);
  expect(omitidos).toEqual([]);
});

test("contraste: ningún control visible tiene menos de 4,5:1 en texto ni 3:1 en íconos y bordes", ({}, info) => {
  expect(falloPorPaso(info.project.name, "contraste")).toEqual([]);
});

test("tipografía: ningún texto visible es menor a 13 px", ({}, info) => {
  expect(falloPorPaso(info.project.name, "textosChicos")).toEqual([]);
});

test("zonas táctiles: ningún control visible mide menos de 44 px", ({}, info) => {
  expect(falloPorPaso(info.project.name, "zonasChicas")).toEqual([]);
});

test("cursor: todo lo que se toca muestra la manito (y lo deshabilitado, el de no permitido)", ({}, info) => {
  expect(falloPorPaso(info.project.name, "cursores")).toEqual([]);
});

test("sin scroll horizontal de la página en ninguna pantalla", ({}, info) => {
  const mal = [...resultados].filter(([k, m]) => k.startsWith(`${info.project.name}|`) && m.scrollHorizontal).map(([k]) => k.split("|")[1]);
  expect(mal).toEqual([]);
});
