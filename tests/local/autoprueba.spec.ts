import { expect, test } from "@playwright/test";
import { medirLayout } from "./helpers/layout";
import { medirPagina } from "./helpers/medir";

/**
 * La prueba de las pruebas: los chequeos del recorrido (scroll horizontal, texto cortado, solapes, controles tapados,
 * fuera de pantalla, contraste, zonas táctiles, tipografía) tienen que ENCONTRAR los problemas que buscan. Acá se les da una
 * página armada a propósito con cada falla, y otra limpia que no debe dar ninguna. No necesita el portal ni la base.
 */
const ROTA = `
<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;font:16px sans-serif;background:#fff;color:#111} .ancho{width:900px;height:20px;background:#eee}
.cortado{width:60px;overflow:hidden;white-space:nowrap}
.pisa{position:relative;top:-28px}
.barra{position:fixed;left:0;right:0;top:300px;height:80px;background:#244b5a;color:#fff}
.fuera{margin-left:360px}
.chico{font-size:10px}
.pobre{background:#fff;color:#eee}
.diminuto{width:20px;height:20px}
</style>
<div class="ancho">página más ancha que la pantalla</div>
<div class="cortado">Texto largo que se corta sin ninguna elipsis</div>
<p>Primer renglón</p><p class="pisa">Segundo renglón encima del primero</p>
<button class="fuera">Botón fuera</button>
<p class="chico">Texto de diez píxeles</p>
<button class="pobre">Poco contraste</button>
<button class="diminuto">x</button>
<div style="height:260px"></div>
<button id="tapado" style="position:absolute;top:320px;left:20px;height:44px">Tapado por la barra</button>
<div class="barra">Barra fija</div>
<div style="height:900px"></div>`;

const LIMPIA = `
<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:12px;font:16px sans-serif;background:#fff;color:#111} .elip{width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
button{min-height:44px;min-width:44px;padding:0 12px;background:#244b5a;color:#fff;border:0;border-radius:8px}</style>
<p>Un párrafo normal.</p><p>Otro párrafo, separado.</p>
<div class="elip">Un texto largo que SÍ termina en elipsis a propósito</div>
<button>Aceptar</button> <button>Cancelar</button>`;

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test("los chequeos detectan cada tipo de falla en una página rota a propósito", async ({ page }) => {
  await page.setContent(ROTA);
  const l = await medirLayout(page);
  expect(l.scrollDePagina.length, "scroll horizontal de la página").toBeGreaterThan(0);
  expect(l.textosCortados.some((t) => t.includes("Texto largo")), "texto cortado").toBe(true);
  expect(l.solapes.some((t) => t.includes("Segundo renglón")), "solape").toBe(true);
  expect(l.fueraDePantalla.some((t) => t.includes("Botón fuera")), "control fuera de la pantalla").toBe(true);
  const m = await medirPagina(page);
  expect(m.textosChicos.length, "texto menor a 13 px").toBeGreaterThan(0);
  expect(m.contraste.some((t) => t.includes("Poco contraste")), "contraste").toBe(true);
  expect(m.zonasChicas.some((t) => t.includes('"x"')), "zona táctil chica").toBe(true);
  // Un control tapado por una barra fija: se mide con la página bajada al final (ahí la barra no deja pasar nada).
  await page.evaluate(() => {
    document.documentElement.style.height = "auto";
    window.scrollTo(0, document.documentElement.scrollHeight);
    const b = document.getElementById("tapado")!;
    b.style.top = `${window.scrollY + 320}px`;
  });
  const t = await medirLayout(page);
  expect(t.tapados.some((x) => x.includes("Tapado por la barra")), "control tapado").toBe(true);
});

test("una página limpia no da ninguna falla (ni la elipsis a propósito)", async ({ page }) => {
  await page.setContent(LIMPIA);
  const l = await medirLayout(page);
  expect(l).toEqual({ scrollDePagina: [], textosCortados: [], solapes: [], tapados: [], fueraDePantalla: [] });
  const m = await medirPagina(page);
  expect([m.textosChicos, m.zonasChicas, m.contraste]).toEqual([[], [], []]);
});
