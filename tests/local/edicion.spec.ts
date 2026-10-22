import { expect, test, type Locator, type Page } from "@playwright/test";
import fs from "node:fs";
import { iniciarSesion } from "./helpers/sesion";
import path from "node:path";
import { asegurarMaterialDeEdicion, cantidadGuardada } from "./helpers/datos";

/**
 * La ventana de edición (hoja compartida) y las filas de las listas, en todos los tamaños:
 *  - cada fila tiene su lápiz de 44×44 con "Editar <nombre>", y tocar la fila entera también abre la edición,
 *    pero un link de la fila (teléfono) NO la abre;
 *  - Guardar queda siempre visible y legible, también con el teclado abierto (pantalla reducida) y sin cambios
 *    (deshabilitado pero con texto oscuro sobre gris, nunca blanco sobre blanco);
 *  - cambiar una cantidad por tamaño la resalta, se guarda, se ve en la lista y entra en un pedido nuevo;
 *  - avisa de los cambios sin guardar; "Cuándo se pide" usa una lista propia con descripciones.
 * Capturas en capturas-locales/<fase>/<proyecto>/edicion-*.png (ignorada por git).
 */
const EMAIL = process.env.E2E_LOCAL_EMAIL ?? "";
const PASSWORD = process.env.E2E_LOCAL_PASSWORD ?? "";
const FASE = process.env.E2E_FASE ?? "despues";
const MATERIAL = "Material de cantidades E2E";

async function entrar(page: Page) {
  await iniciarSesion(page, EMAIL, PASSWORD);
}

async function captura(page: Page, proyecto: string, nombre: string) {
  const dir = path.join("capturas-locales", FASE, proyecto);
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `edicion-${nombre}.png`) });
}

/** Contraste del texto de un control contra su fondo real (opacidad incluida). */
async function contrasteDe(l: Locator): Promise<number> {
  return l.evaluate((el) => {
    const lienzo = document.createElement("canvas");
    lienzo.width = lienzo.height = 1;
    const ctx2d = lienzo.getContext("2d", { willReadFrequently: true })!;
    const parse = (c: string) => {
      ctx2d.clearRect(0, 0, 1, 1);
      ctx2d.fillStyle = "#000000";
      ctx2d.fillStyle = c;
      ctx2d.fillRect(0, 0, 1, 1);
      const d = ctx2d.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255] as [number, number, number, number];
    };
    const mezclar = (a: number[], b: number[]) => [a[0] * a[3] + b[0] * (1 - a[3]), a[1] * a[3] + b[1] * (1 - a[3]), a[2] * a[3] + b[2] * (1 - a[3]), 1];
    const lum = (c: number[]) => {
      const f = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : Math.pow((v / 255 + 0.055) / 1.055, 2.4));
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    };
    let op = 1;
    const fondos: number[][] = [];
    for (let e: Element | null = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      op *= Number(cs.opacity);
      const b = parse(cs.backgroundColor);
      if (b[3] > 0) fondos.push(b);
      if (b[3] >= 1) break;
    }
    let fondo = [255, 255, 255, 1];
    for (const b of fondos.reverse()) fondo = mezclar(b, fondo);
    const c = parse(getComputedStyle(el).color);
    const texto = mezclar([c[0], c[1], c[2], c[3] * op], fondo);
    const l1 = lum(texto);
    const l2 = lum(fondo);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  });
}

const enPantalla = async (page: Page, l: Locator) => {
  const r = await l.boundingBox();
  const vp = page.viewportSize()!;
  return !!r && r.y >= 0 && r.y + r.height <= vp.height + 0.5 && r.x >= 0 && r.x + r.width <= vp.width + 0.5;
};

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await asegurarMaterialDeEdicion(MATERIAL);
});

test("cada fila tiene su lápiz de 44×44; tocar la fila abre la edición y un teléfono no", async ({ page }, info) => {
  await entrar(page);

  // Materiales
  await page.goto("/dashboard/catalogo/materiales");
  const lapiz = page.getByRole("button", { name: `Editar ${MATERIAL}` });
  await expect(lapiz).toBeVisible();
  const caja = (await lapiz.boundingBox())!;
  expect(caja.width, "ancho del lápiz").toBeGreaterThanOrEqual(43.5);
  expect(caja.height, "alto del lápiz").toBeGreaterThanOrEqual(43.5);
  await lapiz.scrollIntoViewIfNeeded();
  await captura(page, info.project.name, "materiales-lista");
  // Tocar la fila (sobre el nombre) abre la edición.
  await page.getByText(MATERIAL, { exact: true }).first().click();
  await expect(page.getByRole("dialog", { name: "Editar material" })).toBeVisible();
  await expect(page.getByRole("dialog").getByText(MATERIAL).first()).toBeVisible(); // subtítulo con el nombre
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Proveedores: el link del teléfono no abre la edición; el resto de la fila sí.
  await page.goto("/dashboard/catalogo/proveedores");
  await expect(page.getByRole("button", { name: /^Editar Distribuidora Norte E2E/ })).toBeVisible();
  const tel = page.getByRole("link", { name: /\+54 9 3534/ }).first();
  await tel.evaluate((a) => a.addEventListener("click", (e) => e.preventDefault(), { once: true })); // no navegar a tel:
  await tel.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByText("Distribuidora Norte E2E", { exact: true }).first().click();
  await expect(page.getByRole("dialog", { name: "Editar proveedor" })).toBeVisible();
  await captura(page, info.project.name, "proveedor-editar");
  await page.keyboard.press("Escape");

  // Catálogo de precios: lápiz "Editar" en cada fila.
  await page.goto("/dashboard/catalogo");
  const lapizItem = page.getByRole("button", { name: "Editar", exact: true }).first();
  await expect(lapizItem).toBeVisible();
  const c2 = (await lapizItem.boundingBox())!;
  expect(Math.min(c2.width, c2.height)).toBeGreaterThanOrEqual(43.5);

  // Pedidos
  await page.goto("/dashboard/catalogo/pedidos");
  const lapizPedido = page.getByRole("button", { name: /^Abrir PED/ }).first();
  await expect(lapizPedido).toBeVisible();
  const c3 = (await lapizPedido.boundingBox())!;
  expect(Math.min(c3.width, c3.height)).toBeGreaterThanOrEqual(43.5);
});

test("Guardar siempre se ve y se lee: sin cambios (deshabilitado), con cambios y con el teclado abierto", async ({ page }, info) => {
  await entrar(page);
  await page.goto("/dashboard/catalogo/materiales");
  await page.getByRole("button", { name: `Editar ${MATERIAL}` }).click();
  const hoja = page.getByRole("dialog", { name: "Editar material" });
  const guardar = hoja.getByRole("button", { name: "Guardar cambios" });
  const cancelar = hoja.getByRole("button", { name: "Cancelar" });

  // Sin cambios: deshabilitado pero LEGIBLE (texto oscuro sobre gris medio), nunca blanco sobre blanco.
  await expect(guardar).toBeDisabled();
  expect(await contrasteDe(guardar), "Guardar sin cambios").toBeGreaterThanOrEqual(4.5);
  expect(await contrasteDe(cancelar), "Cancelar").toBeGreaterThanOrEqual(4.5);
  expect(await enPantalla(page, guardar)).toBe(true);
  // Los dos botones del pie, del mismo ancho.
  const [bg, bc] = [(await guardar.boundingBox())!, (await cancelar.boundingBox())!];
  if (info.project.use.viewport!.width < 640) expect(Math.abs(bg.width - bc.width)).toBeLessThan(2);
  expect(bg.height).toBeGreaterThanOrEqual(47.5);
  await captura(page, info.project.name, "material-sin-cambios");

  // Con cambios: primario azul petróleo con texto blanco.
  const campo = hoja.getByLabel("8x4");
  await campo.fill("9");
  await expect(guardar).toBeEnabled();
  await expect(guardar).toHaveCSS("background-color", "rgb(36, 75, 90)"); // espera a que termine la transición
  await expect(guardar).toHaveCSS("color", "rgb(255, 255, 255)");
  expect(await contrasteDe(guardar), "Guardar con cambios").toBeGreaterThanOrEqual(4.5);
  await captura(page, info.project.name, "material-con-cambios");

  // Teclado abierto: la pantalla queda en la mitad (el teclado de un celular ocupa 40-50 %). Guardar sigue a la vista.
  const vp = page.viewportSize()!;
  if (vp.width < 768) {
    await campo.focus();
    await page.setViewportSize({ width: vp.width, height: Math.round(vp.height * 0.5) });
    await page.waitForTimeout(300);
    expect(await enPantalla(page, guardar), "Guardar con el teclado abierto").toBe(true);
    expect(await enPantalla(page, hoja.getByRole("button", { name: "Cerrar ventana" })), "cerrar con el teclado abierto").toBe(true);
    await captura(page, info.project.name, "material-teclado");
    await page.setViewportSize(vp);
  }
});

test("cambiar una cantidad: se resalta, se guarda, se ve en la lista y entra en un pedido nuevo", async ({ page }, info) => {
  await entrar(page);
  await page.goto("/dashboard/catalogo/materiales");
  await page.getByRole("button", { name: `Editar ${MATERIAL}` }).click();
  const hoja = page.getByRole("dialog", { name: "Editar material" });

  // La sección dice la unidad y a quién afecta; vacío dice "No pide".
  await expect(hoja.getByText("Cantidad por tamaño de pileta")).toBeVisible();
  await expect(hoja.getByText("Se aplica a todos los pedidos nuevos.")).toBeVisible();
  await expect(hoja.getByLabel("5x3")).toHaveAttribute("placeholder", "No pide");

  const campo = hoja.getByLabel("8x4");
  await expect(campo).toHaveValue("3");
  await campo.fill("7");
  // El valor cambiado se resalta (borde de la marca + punto) antes de guardar.
  expect(await campo.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe("rgb(36, 75, 90)");
  await captura(page, info.project.name, "material-cantidad-cambiada");

  await hoja.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: `Se guardó "${MATERIAL}"` })).toBeVisible();
  expect(await cantidadGuardada(MATERIAL, "8x4")).toBe(7);
  // La fila sigue en la lista (no se perdió el lugar).
  await expect(page.getByRole("button", { name: `Editar ${MATERIAL}` })).toBeVisible();

  // Un pedido nuevo (8x4 por defecto) ya usa 7.
  await page.goto("/dashboard/catalogo/pedido");
  await expect(page.getByLabel(`Cantidad de ${MATERIAL}`)).toHaveValue("7");
});

test("botones: en reposo, con el mouse encima, apretados y con foco siguen teniendo contraste (y el cursor es la manito)", async ({ page }, info) => {
  await entrar(page);
  await page.goto("/dashboard/catalogo/materiales");
  const toque = (info.project.use.hasTouch ?? false) && (info.project.use.viewport?.width ?? 1280) < 768;

  const controles: [string, Locator][] = [
    ["Agregar material", page.getByRole("button", { name: "Agregar material" }).first()],
    ["lápiz", page.getByRole("button", { name: `Editar ${MATERIAL}` })],
    ["chip Todos", page.getByRole("group", { name: "Filtrar por rubro" }).getByRole("button", { name: /^Todos/ })],
    ["Filtros", page.getByRole("button", { name: /^Filtros/ })],
  ];
  for (const [nombre, c] of controles) {
    await c.scrollIntoViewIfNeeded();
    expect(await contrasteDe(c), `${nombre} en reposo`).toBeGreaterThanOrEqual(4.5);
    expect(await c.evaluate((el) => getComputedStyle(el).cursor), `${nombre}: cursor`).toBe("pointer");
    if (!toque) {
      await c.hover();
      expect(await contrasteDe(c), `${nombre} con el mouse encima`).toBeGreaterThanOrEqual(4.5);
      await page.mouse.down();
      expect(await contrasteDe(c), `${nombre} apretado`).toBeGreaterThanOrEqual(4.5);
      await page.mouse.up();
      await page.mouse.move(0, 0);
    }
    await c.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    expect(await contrasteDe(c), `${nombre} con foco`).toBeGreaterThanOrEqual(4.5);
    // Con foco de teclado se ve un anillo (outline) de al menos 2 px.
    if ((await c.evaluate((el) => el.matches(":focus-visible"))) === true) {
      expect(await c.evaluate((el) => parseFloat(getComputedStyle(el).outlineWidth)), `${nombre}: anillo de foco`).toBeGreaterThanOrEqual(2);
    }
  }

  // Dentro de la hoja: Cancelar, Guardar con cambios.
  await page.getByRole("button", { name: `Editar ${MATERIAL}` }).click();
  const hoja = page.getByRole("dialog", { name: "Editar material" });
  const valorInicial = await hoja.getByLabel("8x4").inputValue();
  await hoja.getByLabel("8x4").fill(valorInicial === "9" ? "8" : "9");
  const guardar = hoja.getByRole("button", { name: "Guardar cambios" });
  for (const [nombre, c] of [["Guardar", guardar], ["Cancelar", hoja.getByRole("button", { name: "Cancelar" })]] as [string, Locator][]) {
    if (!toque) {
      await c.hover();
      expect(await contrasteDe(c), `${nombre} con el mouse encima`).toBeGreaterThanOrEqual(4.5);
      expect(await c.evaluate((el) => getComputedStyle(el).cursor), `${nombre}: cursor`).toBe("pointer");
    }
  }
  await page.mouse.move(0, 0);
  await hoja.getByLabel("8x4").fill(valorInicial); // vuelve al valor guardado
  await hoja.getByRole("button", { name: "Cancelar" }).click();
});

test("avisa de los cambios sin guardar y deja seguir editando o descartar", async ({ page }) => {
  await entrar(page);
  await page.goto("/dashboard/catalogo/materiales");
  await page.getByRole("button", { name: `Editar ${MATERIAL}` }).click();
  const hoja = page.getByRole("dialog", { name: "Editar material" });
  await hoja.getByLabel("Nombre").fill(`${MATERIAL} cambiado`);
  await hoja.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByText("Hay cambios sin guardar")).toBeVisible();
  await page.getByRole("button", { name: "Seguir editando" }).click();
  await expect(hoja.getByLabel("Nombre")).toHaveValue(`${MATERIAL} cambiado`);
  await hoja.getByRole("button", { name: "Cerrar ventana" }).click();
  await page.getByRole("button", { name: "Descartar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("'Cuándo se pide' es una lista propia con descripciones claras (los valores internos no cambian)", async ({ page }, info) => {
  await entrar(page);
  await page.goto("/dashboard/catalogo/materiales");
  await page.getByRole("button", { name: `Editar ${MATERIAL}` }).click();
  const hoja = page.getByRole("dialog", { name: "Editar material" });
  await hoja.getByRole("button", { name: /^Cuándo se pide:/ }).click();
  const lista = page.getByRole("dialog", { name: "Cuándo se pide" });
  for (const t of ["Siempre", "Losetas", "Deck", "Por luz", "Una vez si hay luces", "Luz de cama de agua", "Baño químico"]) {
    await expect(lista.getByRole("option", { name: new RegExp("^" + t) })).toBeVisible();
  }
  await expect(lista.getByText("Se multiplica por la cantidad de luces")).toBeVisible();
  await expect(lista.getByText("Va en todas las obras").first()).toBeVisible();
  // Opciones de 48 px, la actual con tilde.
  const op = (await lista.getByRole("option", { name: /^Siempre/ }).getByRole("button").boundingBox())!;
  expect(op.height).toBeGreaterThanOrEqual(47.5);
  await captura(page, info.project.name, "material-cuando-se-pide");
  // Elegir cierra la lista y cambia el valor (el <select> de abajo guarda el valor interno "Luz").
  await lista.getByRole("option", { name: /Por luz/ }).click();
  await expect(page.getByRole("dialog", { name: "Cuándo se pide" })).toHaveCount(0);
  await expect(hoja.getByLabel("Cuándo se pide")).toHaveValue("Luz");
  await expect(hoja.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
  await page.keyboard.press("Escape"); // pide confirmar el descarte
  await page.getByRole("button", { name: "Descartar" }).click();
});

test("el nombre largo del proveedor no se corta en el selector", async ({ page }) => {
  await entrar(page);
  await page.goto("/dashboard/catalogo/materiales");
  await page.getByRole("button", { name: `Editar ${MATERIAL}` }).click();
  const hoja = page.getByRole("dialog", { name: "Editar material" });
  const boton = hoja.getByRole("button", { name: /^Proveedor:/ });
  // El texto hace salto de línea en vez de cortarse con "…": no hay scroll interno en el botón.
  expect(await boton.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
});
