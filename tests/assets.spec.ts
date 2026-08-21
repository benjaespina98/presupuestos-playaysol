import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

/**
 * Chequeos sobre los assets de las calculadoras. A diferencia de
 * calculators.spec.ts, estos NO necesitan credenciales ni navegador logueado:
 * corren siempre, en cualquier máquina, con `npx playwright test`.
 *
 * Hasta la Fase 5, este archivo comparaba las 4 calculadoras que ya estaban
 * en React contra `public/<tipo>-calc.js` — el peso del bundle legacy, sus
 * `data:` embebidos, los ids que buscaba por `getElementById`. Esos archivos
 * ya no existen (las 5 calculadoras son React desde que losetas migró), así
 * que esos chequeos dejaron de tener sentido: no protegían nada, tiraban
 * ENOENT si alguien los llegaba a correr. Lo que queda acá es lo que sigue
 * siendo relevante con las 5 en React.
 */

const RAIZ = path.join(__dirname, "..");

const CALCULADORAS = [
  { tipo: "cercos", archivo: path.join(RAIZ, "components", "calculadoras", "cercos", "CercosCalculadora.tsx") },
  { tipo: "cobertores", archivo: path.join(RAIZ, "components", "calculadoras", "cobertores", "CobertorCalculadora.tsx") },
  { tipo: "piscinas", archivo: path.join(RAIZ, "components", "calculadoras", "piscinas", "PiscinaCalculadora.tsx") },
  { tipo: "revestimientos", archivo: path.join(RAIZ, "components", "calculadoras", "revestimientos", "RevestimientoCalculadora.tsx") },
  { tipo: "losetas", archivo: path.join(RAIZ, "components", "calculadoras", "losetas", "LosetasCalculadora.tsx") },
] as const;

test.describe("librerías pesadas: ninguna calculadora las carga desde un CDN", () => {
  // docx (~370 KB) y html2canvas (~200 KB) venían de un CDN de terceros en
  // TODA carga de calculadora, en el flujo legacy. Ahora son dependencias del
  // proyecto (ver tests/unit/dependencias.test.ts para las versiones fijadas
  // y el import() dinámico) — esto sólo guarda contra que alguien vuelva a
  // colar un <script src> de CDN en el componente de alguna de las 5.
  for (const { tipo, archivo } of CALCULADORAS) {
    test(`${tipo}: su componente no referencia un CDN`, () => {
      const src = fs.readFileSync(archivo, "utf8");
      for (const cdn of ["cdn.jsdelivr.net", "cdnjs.cloudflare.com", "unpkg.com"]) {
        expect(src, `${tipo} sigue cargando una librería desde ${cdn}`).not.toContain(cdn);
      }
    });
  }
});

test.describe("fotos de ejemplo (public/seeds)", () => {
  // Las 5 calculadoras React sólo suben fotos que carga la persona usuaria
  // (ver el input type=file de cada Calculadora.tsx) — ninguna ofrece ya un
  // picker de fotos de ejemplo precargadas, a diferencia del legacy. Este
  // test no reafirma una funcionalidad (no la hay), sólo dejar registrado
  // que si `public/seeds` todavía existe, es un directorio sin consumidores
  // en el código — no se borra acá porque borrar archivos reales de assets
  // no forma parte de este chequeo automatizado, pero vale la pena que quede
  // visible en vez de asumido en silencio.
  test("ninguna calculadora React referencia /seeds/ (la galería de ejemplos era sólo del legacy)", () => {
    for (const { tipo, archivo } of CALCULADORAS) {
      const src = fs.readFileSync(archivo, "utf8");
      expect(src, `${tipo} referencia /seeds/ — actualizar este test si se reintrodujo la galería`).not.toContain(
        "/seeds/"
      );
    }
  });
});
