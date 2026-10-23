import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import { iniciarSesion } from "./helpers/sesion";
import path from "node:path";
import { medirPagina, type Medidas } from "./helpers/medir";
import { medirLayout, type ProblemasDeLayout } from "./helpers/layout";
import { asegurarDatosDePantallas } from "./helpers/datos";

/**
 * Recorre TODAS las pantallas del portal LOCAL (login con y sin error, Nuevo con sus 5 calculadoras, Historial,
 * Precios y las 4 secciones de Compras) con sus estados (filtros abiertos, filtros activos, lista bajada, vacíos) y
 * las ventanas que se abren desde ellas (edición de material, proveedor e ítem, selectores, menús, detalle de pedido,
 * diálogos de stock), en cada tamaño de pantalla del proyecto de Playwright, y mide con los estilos y las cajas reales:
 *
 *   - contraste de cada control visible: texto 4,5:1 (3:1 si es grande), íconos y bordes 3:1, contra el fondo real;
 *   - textos visibles menores a 13 px;
 *   - zonas táctiles menores a 44 px;
 *   - scroll horizontal de la página;
 *   - textos cortados sin elipsis intencional o fuera de la pantalla;
 *   - elementos que se solapan (cajas de texto y de controles que se cruzan);
 *   - controles tapados por un elemento fijo o flotante;
 *   - controles fuera del viewport.
 *
 * Se corre con `node scripts/e2e-local.mjs recorrido` (o `node scripts/e2e-contra-servidor.mjs recorrido` con el portal
 * local ya levantado por `node scripts/e2e-local.mjs servir`). Con E2E_FASE=antes|despues guarda el informe y las
 * capturas en capturas-locales/<fase>/<proyecto>/ (ignorada por git). Sólo mira: no guarda ni cambia datos.
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

const esMovil = (page: Page) => (page.viewportSize()?.width ?? 1000) < 768;
const tocar = (page: Page, nombre: string | RegExp) => page.getByRole("button", { name: nombre }).first().click({ timeout: 8_000 });
const cerrar = async (page: Page) => {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
};
/** Celular: el botón "Filtros" abre la hoja con todo. Escritorio: "Más filtros" abre el panel con los interruptores. */
const abrirFiltros = (page: Page) => tocar(page, esMovil(page) ? /^Filtros/ : /^Más filtros/);
/** Abre un filtro: en el celular, dentro de la hoja (un acordeón); en escritorio, su menú. */
async function abrirFiltro(page: Page, hoja: RegExp, menu: RegExp) {
  if (esMovil(page)) {
    await tocar(page, /^Filtros/);
    await tocar(page, hoja);
  } else await tocar(page, menu);
}
/** Elige una opción de un filtro ya abierto; en el celular cierra la hoja con "Ver N resultados". */
async function elegirOpcion(page: Page, opcion: RegExp) {
  await page.getByRole("radio", { name: opcion }).first().click({ timeout: 8_000 });
  if (esMovil(page)) await tocar(page, /^Ver \d+/);
}
const bajar = (page: Page, y: number) => page.evaluate((v) => window.scrollTo(0, v), y);
const buscar = async (page: Page, etiqueta: RegExp, texto: string) => {
  await page.getByRole("textbox", { name: etiqueta }).first().fill(texto);
};

const PASOS: Paso[] = [
  { nombre: "inicio-nuevo", ruta: "/dashboard" },
  { nombre: "calc-piscinas", ruta: "/dashboard/piscinas" },
  { nombre: "calc-cercos", ruta: "/dashboard/cercos" },
  { nombre: "calc-cobertores", ruta: "/dashboard/cobertores" },
  { nombre: "calc-revestimientos", ruta: "/dashboard/revestimientos" },
  { nombre: "calc-losetas", ruta: "/dashboard/losetas" },
  // A mitad de la página (con la barra de "Guardar" pegada al pie) y con un campo con el teclado abierto.
  { nombre: "calc-piscinas-medio", ruta: "/dashboard/piscinas", preparar: (p) => bajar(p, 1500) },
  { nombre: "calc-cercos-medio", ruta: "/dashboard/cercos", preparar: (p) => bajar(p, 1200) },
  { nombre: "calc-cobertores-medio", ruta: "/dashboard/cobertores", preparar: (p) => bajar(p, 1200) },
  { nombre: "calc-revestimientos-medio", ruta: "/dashboard/revestimientos", preparar: (p) => bajar(p, 1200) },
  { nombre: "calc-losetas-medio", ruta: "/dashboard/losetas", preparar: (p) => bajar(p, 900) },
  { nombre: "historial", ruta: "/dashboard/historial" },
  { nombre: "historial-filtros", ruta: "/dashboard/historial", preparar: (p) => abrirFiltros(p) },
  {
    nombre: "historial-con-filtro",
    ruta: "/dashboard/historial",
    preparar: async (p) => {
      await abrirFiltro(p, /^Tipo/, /^Filtrar por tipo/);
      await elegirOpcion(p, /^Cercos/);
    },
  },
  { nombre: "historial-vacio", ruta: "/dashboard/historial", preparar: (p) => buscar(p, /Buscar por nombre/, "zzzzzz") },
  { nombre: "historial-anular", ruta: "/dashboard/historial", preparar: (p) => tocar(p, /^Anular/) },
  { nombre: "catalogo-precios", ruta: "/dashboard/catalogo" },
  { nombre: "catalogo-filtros", ruta: "/dashboard/catalogo", preparar: (p) => abrirFiltros(p) },
  { nombre: "catalogo-menu-stock", ruta: "/dashboard/catalogo", preparar: (p) => abrirFiltro(p, /^Stock/, /^Filtrar por stock/) },
  { nombre: "catalogo-menu-categoria", ruta: "/dashboard/catalogo", preparar: (p) => abrirFiltro(p, /^Categoría/, /^Filtrar por categoría/) },
  { nombre: "catalogo-menu-orden", ruta: "/dashboard/catalogo", preparar: (p) => abrirFiltro(p, /^Orden/, /^Ordenar/) },
  {
    nombre: "catalogo-con-filtros",
    ruta: "/dashboard/catalogo",
    preparar: async (p) => {
      await abrirFiltro(p, /^Stock/, /^Filtrar por stock/);
      await elegirOpcion(p, /^Con stock/);
    },
  },
  {
    nombre: "catalogo-stock-negativo",
    ruta: "/dashboard/catalogo",
    preparar: async (p) => {
      await abrirFiltro(p, /^Stock/, /^Filtrar por stock/);
      await elegirOpcion(p, /^Stock negativo/);
    },
  },
  { nombre: "catalogo-vacio", ruta: "/dashboard/catalogo", preparar: (p) => buscar(p, /Buscar en el cat/, "zzzzzz") },
  { nombre: "catalogo-bajado", ruta: "/dashboard/catalogo", preparar: (p) => bajar(p, 1400) },
  {
    nombre: "catalogo-flecha",
    ruta: "/dashboard/catalogo",
    preparar: async (p) => {
      // La flecha de "volver arriba" aparece al SUBIR la página, pasado un buen trecho.
      await bajar(p, 1500);
      await p.waitForTimeout(200);
      await p.evaluate(() => window.scrollTo(0, 1380));
      await p.getByRole("button", { name: "Volver arriba" }).waitFor({ timeout: 4_000 });
    },
  },
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
  {
    nombre: "catalogo-ajuste",
    ruta: "/dashboard/catalogo",
    preparar: async (p) => {
      await tocar(p, /^Más acciones de/);
      await p.getByRole("menuitem", { name: "Ajustar conteo" }).click();
    },
  },
  {
    nombre: "catalogo-historial-stock",
    ruta: "/dashboard/catalogo",
    preparar: async (p) => {
      await tocar(p, /^Más acciones de/);
      await p.getByRole("menuitem", { name: "Historial" }).click();
    },
  },
  { nombre: "catalogo-materiales", ruta: "/dashboard/catalogo/materiales" },
  { nombre: "materiales-filtros", ruta: "/dashboard/catalogo/materiales", preparar: (p) => abrirFiltros(p) },
  { nombre: "materiales-menu-proveedor", ruta: "/dashboard/catalogo/materiales", preparar: (p) => abrirFiltro(p, /^Proveedor/, /^Filtrar por proveedor/) },
  {
    nombre: "materiales-con-filtros",
    ruta: "/dashboard/catalogo/materiales",
    preparar: async (p) => {
      await abrirFiltro(p, /^Rubro/, /^Filtrar por rubro/);
      await elegirOpcion(p, /^Hidráulica/);
    },
  },
  { nombre: "materiales-bajado", ruta: "/dashboard/catalogo/materiales", preparar: (p) => bajar(p, 1000) },
  { nombre: "materiales-vacio", ruta: "/dashboard/catalogo/materiales", preparar: (p) => buscar(p, /Buscar materiales/, "zzzzzz") },
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
  { nombre: "proveedores-filtros", ruta: "/dashboard/catalogo/proveedores", preparar: (p) => abrirFiltros(p) },
  {
    nombre: "proveedores-con-filtros",
    ruta: "/dashboard/catalogo/proveedores",
    preparar: async (p) => {
      await abrirFiltro(p, /^Teléfono/, /^Filtrar por teléfono/);
      await elegirOpcion(p, /^Sin teléfono/);
    },
  },
  { nombre: "proveedor-nuevo", ruta: "/dashboard/catalogo/proveedores", preparar: (p) => tocar(p, /^Agregar proveedor/) },
  { nombre: "proveedor-editar", ruta: "/dashboard/catalogo/proveedores", preparar: (p) => tocar(p, /^Editar Distribuidora Norte E2E/) },
  { nombre: "catalogo-armar-pedido", ruta: "/dashboard/catalogo/pedido" },
  { nombre: "armar-pedido-bajado", ruta: "/dashboard/catalogo/pedido", preparar: (p) => bajar(p, 1100) },
  {
    nombre: "armar-pedido-agregar",
    ruta: "/dashboard/catalogo/pedido",
    preparar: async (p) => {
      await bajar(p, 1100);
      await tocar(p, /^Agregar material/);
    },
  },
  {
    nombre: "pedido-menu-exportar",
    ruta: "/dashboard/catalogo/pedido",
    preparar: async (p) => {
      // Con un proveedor desactivado en el pedido, exportar pide confirmar antes.
      const confirmar = p.getByLabel("Pedir igual a proveedores desactivados");
      if (await confirmar.count()) await confirmar.check();
      await p.getByLabel("Exportar").first().click({ timeout: 8_000 });
    },
  },
  { nombre: "catalogo-pedidos", ruta: "/dashboard/catalogo/pedidos" },
  { nombre: "pedidos-filtros", ruta: "/dashboard/catalogo/pedidos", preparar: (p) => abrirFiltros(p) },
  {
    nombre: "pedidos-con-filtros",
    ruta: "/dashboard/catalogo/pedidos",
    preparar: async (p) => {
      await abrirFiltro(p, /^Estado/, /^Filtrar por estado/);
      await elegirOpcion(p, /^Enviado/);
    },
  },
  { nombre: "pedidos-vacio", ruta: "/dashboard/catalogo/pedidos", preparar: (p) => buscar(p, /Buscar pedidos/, "zzzzzz") },
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

type Resultado = Medidas & ProblemasDeLayout & { omitido?: string };
/** Los resultados de cada paso, para las pruebas que vienen después (corren en orden, en el mismo proceso). */
const resultados = new Map<string, Resultado>();
let conSesion = false;

async function soloLocal(page: Page, bloqueados: string[]) {
  await page.context().route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:" || HOSTS_PERMITIDOS.has(url.hostname)) return route.continue();
    bloqueados.push(url.hostname);
    return route.abort();
  });
}


test.beforeAll(async () => {
  // Un pedido guardado y presupuestos en el historial, para llegar a sus ventanas.
  await asegurarDatosDePantallas();
});

test("recorrido: mide todas las pantallas y ventanas", async ({ page }, info) => {
  test.setTimeout(1_200_000);
  expect(EMAIL && PASSWORD, "faltan las credenciales de la prueba").toBeTruthy();
  const bloqueados: string[] = [];
  const errores: string[] = [];
  // WebKit avisa como error una consulta que se cortó porque se cambió de pantalla en el medio: no es del portal.
  page.on("pageerror", (e) => !/due to access control checks/.test(e.message) && errores.push(e.message));
  await soloLocal(page, bloqueados);
  const proyecto = info.project.name;
  const dir = path.join("capturas-locales", FASE, proyecto);
  fs.mkdirSync(dir, { recursive: true });

  // La flecha de "volver arriba" se va sola a los 2,5 s: en ese paso se la vuelve a mostrar (un toque de scroll hacia arriba)
  // justo antes de medir y de sacar la captura, para que esté a la vista.
  const reavivar = (nombre: string) => (nombre === "catalogo-flecha" ? page.evaluate(() => window.scrollBy(0, -3)).then(() => page.waitForTimeout(120)) : Promise.resolve());
  const medir = async (nombre: string, extra?: string) => {
    await page.waitForTimeout(450); // que terminen las transiciones de color antes de medir
    await reavivar(nombre);
    const m = await medirPagina(page);
    await reavivar(nombre);
    const l = await medirLayout(page);
    resultados.set(`${proyecto}|${nombre}`, { ...m, ...l, omitido: extra });
    // El indicador de desarrollo de Next no es del portal: no sale en la captura.
    await page.evaluate(() => {
      const e = document.createElement("style");
      e.textContent = "nextjs-portal{display:none!important}";
      document.head.appendChild(e);
    });
    await reavivar(nombre);
    await page.screenshot({ path: path.join(dir, `${nombre}.png`), fullPage: false });
  };

  // Login (sin sesión), con y sin error.
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await medir("login");
  await page.getByPlaceholder("tu@email.com").fill("nadie@example.com");
  await page.getByPlaceholder("••••••••").fill("clave-incorrecta");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.getByRole("alert").first().waitFor({ timeout: 15_000 }).catch(() => {});
  await medir("login-error");
  await iniciarSesion(page, EMAIL, PASSWORD);
  conSesion = true;

  for (const paso of PASOS) {
    await page.goto(paso.ruta);
    await page.waitForLoadState("networkidle");
    // Que la lista termine de cargar antes de tocar nada (las pantallas con lista cargan de la base).
    await page.waitForFunction(() => !document.body.innerText.includes("Cargando"), undefined, { timeout: 15_000 }).catch(() => {});
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
    // Las pantallas base se miden también con la página bajada hasta el final: ahí nada puede quedar bajo una barra fija.
    if (!paso.preparar && !paso.nombre.endsWith("-bajado")) {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await medir(`${paso.nombre}@final`);
    }
    if (paso.preparar) {
      await cerrar(page);
      await cerrar(page);
    }
    // Las listas guardan la búsqueda y los filtros en la sesión: cada paso parte de cero.
    await page.evaluate(() => sessionStorage.clear());
  }

  const lineas: string[] = [];
  for (const [clave, m] of resultados) {
    if (!clave.startsWith(`${proyecto}|`)) continue;
    const n = clave.split("|")[1];
    lineas.push(
      `${n}: controles=${m.controles} contraste=${m.contraste.length} textos<13px=${m.textosChicos.length} plano=${m.textosDePlano} zonas<44px=${m.zonasChicas.length} cursor=${m.cursores.length} scrollH=${m.scrollHorizontal || m.scrollDePagina.length > 0} cortados=${m.textosCortados.length} solapes=${m.solapes.length} tapados=${m.tapados.length} fuera=${m.fueraDePantalla.length}${m.omitido ? ` OMITIDO(${m.omitido})` : ""}`
    );
    for (const c of m.contraste) lineas.push(`   contraste: ${c}`);
    for (const c of m.textosChicos) lineas.push(`   texto chico: ${c}`);
    for (const c of m.zonasChicas) lineas.push(`   zona chica: ${c}`);
    for (const c of m.cursores) lineas.push(`   cursor: ${c}`);
    for (const c of m.textosCortados) lineas.push(`   cortado: ${c}`);
    for (const c of m.solapes) lineas.push(`   solape: ${c}`);
    for (const c of m.tapados) lineas.push(`   tapado: ${c}`);
    for (const c of m.fueraDePantalla) lineas.push(`   fuera: ${c}`);
    for (const c of m.scrollDePagina) lineas.push(`   scroll horizontal: ${c}`);
  }
  lineas.push(`errores de página: ${errores.join(" | ") || "ninguno"}`, `pedidos bloqueados (no locales): ${[...new Set(bloqueados)].join(",") || "ninguno"}`);
  fs.writeFileSync(path.join(dir, "_medidas.txt"), lineas.join("\n"));
  expect(errores, "errores de JavaScript en la página").toEqual([]);
  expect(bloqueados, "la prueba no debe hablar con nada que no sea local").toEqual([]);
});

type Campo = "contraste" | "textosChicos" | "zonasChicas" | "cursores" | "textosCortados" | "solapes" | "tapados" | "fueraDePantalla" | "scrollDePagina";
function falloPorPaso(proyecto: string, campo: Campo) {
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
  expect(falloPorPaso(info.project.name, "scrollDePagina")).toEqual([]);
});

test("textos: ninguno cortado sin elipsis intencional ni fuera de la pantalla", ({}, info) => {
  expect(falloPorPaso(info.project.name, "textosCortados")).toEqual([]);
});

test("solapes: ningún texto ni control se pisa con otro", ({}, info) => {
  expect(falloPorPaso(info.project.name, "solapes")).toEqual([]);
});

test("controles tapados: ningún control queda debajo de un elemento fijo o flotante", ({}, info) => {
  expect(falloPorPaso(info.project.name, "tapados")).toEqual([]);
});

test("controles dentro del viewport: ninguno se sale de la pantalla", ({}, info) => {
  expect(falloPorPaso(info.project.name, "fueraDePantalla")).toEqual([]);
});
