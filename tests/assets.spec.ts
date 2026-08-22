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

test.describe("fotos de referencia (public/seeds)", () => {
  // Piscinas, Revestimientos, Cercos y Cobertores restauraron las fotos de
  // referencia por opcional/material que tenía el legacy (climatización,
  // revestimientos, cerco perimetral, cobertor + "Modelos de referencia" de
  // Piscinas) — ver lib/documentos/fotosSeed.ts, compartido entre las 4.
  // Losetas es la única de las 5 que no la tuvo nunca en React: sólo el
  // vendedor cambia colores/medidas, no hay fotos de producto involucradas.
  // Este test no revisa los *Calculadora.tsx (el formulario no referencia
  // /seeds/ en ninguna — las fotos viven en el documento generado, no en un
  // picker) sino que Losetas siga sin ninguna referencia.
  test("losetas no referencia /seeds/", () => {
    const losetas = CALCULADORAS.find((c) => c.tipo === "losetas")!;
    const src = fs.readFileSync(losetas.archivo, "utf8");
    expect(src, "losetas referencia /seeds/ inesperadamente").not.toContain("/seeds/");
  });

  test("cada foto que fotosSeed.ts referencia existe en public/seeds", () => {
    const src = fs.readFileSync(path.join(RAIZ, "lib", "documentos", "fotosSeed.ts"), "utf8");
    const rutas = [...src.matchAll(/"(\/seeds\/[^"]+)"/g)].map((m) => m[1]);
    expect(rutas.length, "fotosSeed.ts no referencia ninguna foto").toBeGreaterThan(0);
    for (const ruta of rutas) {
      expect(fs.existsSync(path.join(RAIZ, "public", ruta)), `${ruta} no existe`).toBe(true);
    }
  });
});
