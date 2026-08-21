import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

/**
 * Chequeos sobre los assets de las calculadoras. A diferencia de
 * calculators.spec.ts, estos NO necesitan credenciales ni navegador logueado:
 * corren siempre, en cualquier máquina, con `npx playwright test`.
 *
 * Cubren lo que la limpieza de peso arregló y que es fácil volver a romper sin
 * darse cuenta, porque nada falla de forma visible cuando pasa: la página sigue
 * andando, solo tarda muchísimo más.
 */

const RAIZ = path.join(__dirname, "..");
const PUBLIC = path.join(RAIZ, "public");
const TIPOS = ["cercos", "cobertores", "piscinas", "revestimientos"] as const;

// Los cuatro rondaban los 70-90 KB después de sacarles las fotos. Este techo deja
// aire para que el código crezca, pero salta enseguida si alguien vuelve a pegar
// una imagen en base64 adentro (que es como llegaron a pesar 1,3-1,8 MB cada uno).
const TECHO_KB = 200;

test.describe("peso de las calculadoras", () => {
  for (const tipo of TIPOS) {
    test(`${tipo}-calc.js pesa menos de ${TECHO_KB} KB`, () => {
      const kb = fs.statSync(path.join(PUBLIC, `${tipo}-calc.js`)).size / 1024;
      expect(
        kb,
        `${tipo}-calc.js pesa ${Math.round(kb)} KB. Si subió de golpe, lo más ` +
          `probable es que se haya vuelto a embeber una imagen en base64: las ` +
          `fotos de ejemplo van como archivos en public/seeds/.`
      ).toBeLessThan(TECHO_KB);
    });
  }

  test("ningún -calc.js embebe imágenes en base64", () => {
    for (const tipo of TIPOS) {
      const src = fs.readFileSync(path.join(PUBLIC, `${tipo}-calc.js`), "utf8");
      expect(src, `${tipo}-calc.js tiene un data URI embebido`).not.toContain("base64,");
    }
  });

  test("las fotos de ejemplo que referencian existen en public/seeds", () => {
    for (const tipo of TIPOS) {
      const src = fs.readFileSync(path.join(PUBLIC, `${tipo}-calc.js`), "utf8");
      const urls = [...src.matchAll(/"(\/seeds\/[^"]+)"/g)].map((m) => m[1]);
      expect(urls.length, `${tipo}-calc.js no referencia ninguna foto de ejemplo`).toBeGreaterThan(0);
      for (const url of urls) {
        expect(
          fs.existsSync(path.join(PUBLIC, url)),
          `${tipo}-calc.js referencia ${url}, que no existe`
        ).toBe(true);
      }
    }
  });
});

test.describe("librerías pesadas: se cargan solo cuando se usan", () => {
  // docx (~370 KB) y html2canvas (~200 KB) venían de un CDN en TODA carga de
  // calculadora, y encima el script de la calculadora esperaba a que terminaran
  // de bajar antes de arrancar. Ahora se piden en el primer export.
  test("docx no se pide al cargar: solo desde downloadWord", () => {
    for (const tipo of TIPOS) {
      const src = fs.readFileSync(path.join(PUBLIC, `${tipo}-calc.js`), "utf8");
      expect(src, `${tipo}-calc.js no tiene el cargador diferido de docx`).toContain(
        "function cargarDocx()"
      );
      // Si alguien vuelve a desestructurar docx en el nivel superior del archivo,
      // el módulo revienta al cargar porque la librería todavía no existe.
      expect(src, `${tipo}-calc.js desestructura docx al cargar`).not.toMatch(
        /^\s*const \{[^}]*\} = docx;/m
      );
    }
  });

  test("losetas no trae <Script> de CDN al montar", () => {
    // Las otras 4 ya se prueban arriba vía sus *-calc.js. Losetas es React
    // puro (Fase 5, última en migrar): no hay ningún <script src> que revisar,
    // pero sigue valiendo la pena guardar contra un CDN colado en el componente.
    const src = fs.readFileSync(
      path.join(RAIZ, "components", "calculadoras", "losetas", "LosetasCalculadora.tsx"),
      "utf8"
    );
    expect(src, "LosetasCalculadora.tsx sigue cargando una librería de CDN al montar").not.toContain(
      "cdn.jsdelivr.net"
    );
    expect(src, "LosetasCalculadora.tsx sigue cargando una librería de CDN al montar").not.toContain(
      "cdnjs.cloudflare.com"
    );
  });
});

test.describe("el DOM que el script legacy necesita sigue existiendo", () => {
  // Los -calc.js no importan nada: ubican todo por #id sobre el HTML de markup.ts.
  // Un cambio de UI que renombre o borre un id no rompe el build ni los tipos —
  // rompe la calculadora en runtime, en silencio.
  for (const tipo of TIPOS) {
    test(`${tipo}: el markup define todos los ids que busca el script`, () => {
      const js = fs.readFileSync(path.join(PUBLIC, `${tipo}-calc.js`), "utf8");
      const markup = fs.readFileSync(
        path.join(RAIZ, "app", "dashboard", tipo, "markup.ts"),
        "utf8"
      );

      const definidos = new Set([...markup.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
      // Prefijos de ids que el propio script genera al renderizar listas.
      const generados = [...js.matchAll(/id="([^"$]*)\$\{/g)].map((m) => m[1]);
      const buscados = new Set(
        [...js.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1])
      );

      const faltantes = [...buscados].filter(
        (id) => !definidos.has(id) && !generados.some((g) => g && id.startsWith(g))
      );
      expect(faltantes, `ids que el script busca y el markup no define`).toEqual([]);
    });
  }
  // Losetas ya no aplica: es React puro (Fase 5), no hay markup.ts/script.ts
  // con ids sueltos que puedan desalinearse — el compilador de TypeScript ya
  // ata cada campo del formulario a su tipo.
});
