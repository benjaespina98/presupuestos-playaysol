import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import { iniciarSesion } from "./helpers/sesion";
import path from "node:path";

/**
 * Vista previa de los presupuestos al cliente con casos extremos: teléfono con detalles larguísimos, domicilio y
 * nombre largos, email larguísimo, observaciones largas. Los textos tienen que hacer salto de línea (no pisarse,
 * no salirse del documento) y no cambiar. El PDF y el Word se prueban en tests/unit/documentos-casos-extremos.test.tsx.
 * Capturas en capturas-locales/<fase>/<proyecto>/documento-<tipo>.png.
 */
const EMAIL = process.env.E2E_LOCAL_EMAIL ?? "";
const PASSWORD = process.env.E2E_LOCAL_PASSWORD ?? "";
const FASE = process.env.E2E_FASE ?? "despues";

const TELEFONO = "353 4000000 (llamar después de las 18 hs, preguntar por Marcela, no usar WhatsApp en horario laboral) / 3534-123456 int. 22";
const DOMICILIO = "Av. Presidente Hipólito Yrigoyen 1234, 3º piso, departamento B, torre norte, barrio Güemes (esquina Bv. Sarmiento)";
const NOMBRE = "Familia Rodríguez de la Fuente Echeverría Martínez-Fernández de Córdoba y Alcántara (cuenta corriente 9988)";
const EMAIL_LARGO = "familia.rodriguez.de.la.fuente.echeverria@ejemplo-muy-largo-de-prueba.com.ar";

const CALCULADORAS = ["piscinas", "cercos", "cobertores", "revestimientos"];

async function entrar(page: Page) {
  await iniciarSesion(page, EMAIL, PASSWORD);
}

for (const ruta of CALCULADORAS) {
  test(`${ruta}: la vista previa no pisa ni corta los textos largos del cliente`, async ({ page }, info) => {
    await entrar(page);
    await page.goto(`/dashboard/${ruta}`);
    await page.getByLabel("Señor/Sra").first().fill(NOMBRE);
    await page.getByLabel("Domicilio").first().fill(DOMICILIO);
    await page.getByLabel("Teléfono").first().fill(TELEFONO);
    await page.getByLabel("Email").first().fill(EMAIL_LARGO);

    // En el celular el documento está en la pestaña "Vista previa".
    if ((info.project.use.viewport?.width ?? 1280) < 1024) await page.getByRole("button", { name: "Vista previa", exact: true }).click();
    const doc = page.locator('[id^="documento-"]').first();
    await expect(doc).toBeVisible();

    const medidas = await doc.evaluate((raiz) => {
      const datos = [...raiz.querySelectorAll("dl > div")].map((d) => {
        const r = d.getBoundingClientRect();
        return { texto: d.textContent ?? "", x: r.x, y: r.y, w: r.width, h: r.height };
      });
      const solapes: string[] = [];
      for (let i = 0; i < datos.length; i++) {
        for (let j = i + 1; j < datos.length; j++) {
          const a = datos[i];
          const b = datos[j];
          const seCruzan = a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;
          if (seCruzan) solapes.push(`"${a.texto.slice(0, 25)}" con "${b.texto.slice(0, 25)}"`);
        }
      }
      // Nada se sale del documento por los costados.
      const r = raiz.getBoundingClientRect();
      const afuera = [...raiz.querySelectorAll("*")].filter((e) => {
        const c = e.getBoundingClientRect();
        return c.width > 0 && (c.right > r.right + 1 || c.left < r.left - 1) && !e.closest("img");
      }).length;
      return { solapes, afuera, scrollW: raiz.scrollWidth, clientW: raiz.clientWidth, texto: raiz.textContent ?? "", cantidad: datos.length };
    });

    expect(medidas.cantidad).toBeGreaterThanOrEqual(4);
    expect(medidas.solapes, "datos del cliente que se pisan").toEqual([]);
    expect(medidas.afuera, "elementos que se salen del documento").toBe(0);
    expect(medidas.scrollW, "el documento no hace scroll horizontal").toBeLessThanOrEqual(medidas.clientW + 1);
    // El texto no cambió ni se cortó (el salto de línea no agrega ni saca caracteres).
    for (const original of [NOMBRE, DOMICILIO, TELEFONO, EMAIL_LARGO]) expect(medidas.texto).toContain(original);

    const dir = path.join("capturas-locales", FASE, info.project.name);
    fs.mkdirSync(dir, { recursive: true });
    await doc.screenshot({ path: path.join(dir, `documento-${ruta}.png`) });
  });
}
