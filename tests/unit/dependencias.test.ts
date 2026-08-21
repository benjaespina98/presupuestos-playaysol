import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Guarda de la Fase 0.
 *
 * docx y html2canvas se bajaban de un CDN de terceros y no figuraban en
 * package.json: no las fijaba el lockfile, no funcionaban sin internet y un CDN
 * caído rompía la generación del presupuesto del cliente. Ahora son dependencias
 * del proyecto y viajan en el bundle.
 *
 * Estos tests existen para que eso no se deshaga sin que nadie se entere: nada
 * falla de forma visible si alguien vuelve a meter una URL de CDN, porque la app
 * sigue andando — hasta el día que el CDN no responde.
 */

const RAIZ = path.join(__dirname, "..", "..");
const leer = (rel: string) => fs.readFileSync(path.join(RAIZ, rel), "utf8");
const pkg = JSON.parse(leer("package.json"));

/** Versiones que servía el CDN antes de la Fase 0. Cambiarlas es una decisión,
 *  no un descuido: si actualizás la librería, actualizá también este número. */
const VERSIONES_ESPERADAS = {
  docx: "8.6.0",
  html2canvas: "1.4.1",
} as const;

// Cercos, cobertores, piscinas y revestimientos ya no están acá: se
// migraron a React (Fase 5) y sus public/*-calc.js se borraron. Su
// equivalente de "no CDN, docx por import dinámico" se prueba en
// lib/documentos/{cercos,cobertores,piscinas,revestimientos}/docx.test.ts.
// Sólo losetas sigue siendo legacy (usa el puente para html2canvas, no para
// docx — nunca generó Word). Vacío hasta que losetas también migre.
const CALCULADORAS: string[] = [];

describe("dependencias del proyecto", () => {
  for (const [nombre, version] of Object.entries(VERSIONES_ESPERADAS)) {
    it(`${nombre} está en package.json fijado en ${version}`, () => {
      expect(
        pkg.dependencies[nombre],
        `${nombre} debe estar en dependencies con la versión exacta que servía el CDN`
      ).toBe(version);
    });

    it(`${nombre} instalado coincide con la versión declarada`, () => {
      const instalada = JSON.parse(
        leer(path.join("node_modules", nombre, "package.json"))
      ).version;
      expect(instalada).toBe(version);
    });
  }
});

describe("ninguna librería se carga desde un CDN", () => {
  const fuentes = [
    ...CALCULADORAS,
    "app/dashboard/losetas/script.ts",
    "components/calculadora/Calculadora.tsx",
    "components/calculadora/puente.ts",
    "app/dashboard/losetas/calculator.tsx",
  ];

  for (const rel of fuentes) {
    it(`${rel} no referencia un CDN`, () => {
      const src = leer(rel);
      for (const cdn of ["cdn.jsdelivr.net", "cdnjs.cloudflare.com", "unpkg.com"]) {
        expect(src, `${rel} volvió a cargar una librería desde ${cdn}`).not.toContain(cdn);
      }
    });
  }
});

describe("el puente entrega las librerías al código legacy", () => {
  // Los scripts de /public son <script> clásicos: no pueden hacer import() de un
  // paquete. Dependen de que el puente les deje estas dos funciones en window.
  const puente = leer("components/calculadora/puente.ts");

  it("el puente instala cargarLibDocx y cargarLibHtml2Canvas", () => {
    expect(puente).toContain("window.cargarLibDocx =");
    expect(puente).toContain("window.cargarLibHtml2Canvas =");
  });

  it("las importa dinámicamente, para que no pesen hasta el primer export", () => {
    expect(puente).toMatch(/await import\(\s*["']docx["']\s*\)/);
    expect(puente).toMatch(/await import\(\s*["']html2canvas["']\s*\)/);
  });

  for (const rel of CALCULADORAS) {
    it(`${path.basename(rel)} pide docx por el puente y no por red`, () => {
      const src = leer(rel);
      expect(src).toContain("window.cargarLibDocx");
      // Si vuelve a aparecer un <script src> para cargar la librería, es un CDN.
      expect(src).not.toMatch(/s\.src\s*=\s*DOCX_CDN/);
    });
  }

  it("losetas pide html2canvas por el puente", () => {
    const src = leer("app/dashboard/losetas/script.ts");
    expect(src).toContain("window.cargarLibHtml2Canvas");
  });
});

describe("docx es seguro de empaquetar para el navegador", () => {
  // Antes venía el build UMD del CDN, que trae su propio polyfill de Buffer. Al
  // pasar al paquete de npm, el bundler toma el build ESM. Si una versión futura
  // dejara de empaquetar ese polyfill, el export a Word rompería en el navegador
  // con "Buffer is not defined" — y sólo se vería al apretar el botón.
  const esm = leer("node_modules/docx/build/index.mjs");

  it("trae su propio Buffer y no lo toma del global de Node", () => {
    expect(esm).toMatch(/function requireBuffer\(\)/);
  });

  it("no importa módulos exclusivos de Node", () => {
    expect(esm).not.toMatch(/from\s*["']node:/);
  });

  it("expone los 17 símbolos que usa el generador de Word", async () => {
    // Se comprueban los exports REALES del módulo, no el texto del .d.ts: ese
    // archivo sólo re-exporta (`export * from "./file"`) y no nombra los símbolos.
    const usados = [
      "Document", "Packer", "Paragraph", "TextRun", "Table", "TableRow",
      "TableCell", "ImageRun", "ExternalHyperlink", "AlignmentType",
      "BorderStyle", "WidthType", "ShadingType", "PositionalTab",
      "VerticalAlign", "PageOrientation", "convertMillimetersToTwip",
    ];
    const docx = await import("docx");
    const faltantes = usados.filter((s) => !(s in docx));
    expect(faltantes, "símbolos que el código legacy usa y docx ya no exporta").toEqual([]);
  });

  it("genera un .docx válido sin depender de nada del entorno Node", async () => {
    // Reproduce en chico lo que hace downloadWord(): construir el documento y
    // pedirle a Packer los bytes. Si la librería necesitara algo que el navegador
    // no tiene, esto es lo que se rompería.
    const { Document, Packer, Paragraph, TextRun } = await import("docx");
    const doc = new Document({
      sections: [{ children: [new Paragraph({ children: [new TextRun("Playa y Sol")] })] }],
    });
    const bytes = new Uint8Array(await (await Packer.toBlob(doc)).arrayBuffer());
    expect(bytes.length).toBeGreaterThan(1000);
    // Un .docx es un ZIP: tiene que arrancar con la firma "PK".
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]);
  });
});
