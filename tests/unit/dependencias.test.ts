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

// Las 5 calculadoras ya se migraron a React (Fase 5) y sus public/*-calc.js
// (+ app/dashboard/losetas/script.ts, components/calculadora/puente.ts,
// components/calculadora/Calculadora.tsx) se borraron. El chequeo de "ningún
// <script src> de CDN" para las 5 componentes React vive en
// tests/assets.spec.ts (no necesita vitest: es texto de archivo, igual que
// acá, y así queda junto con el resto de los chequeos de assets/bundle).
// Losetas nunca generó Word (su export es PNG vía html2canvas, pedido con
// `await import("html2canvas")` directo desde LosetasCalculadora.tsx — sin
// puente, ya no hace falta: ver el describe de abajo).

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

describe("las librerías pesadas se piden por import() dinámico, no por CDN", () => {
  // Las 5 calculadoras React son módulos: pueden hacer import() de un paquete
  // directo, sin necesitar un puente que se los deje en `window` (ese puente,
  // components/calculadora/puente.ts, se borró junto con el último consumidor
  // que lo necesitaba — losetas). El equivalente para docx en las otras 4 se
  // prueba en lib/documentos/{cercos,cobertores,piscinas,revestimientos}/docx.ts
  // (cada uno usa `await import("docx")`, no un import estático) y se verifica
  // funcionalmente en sus propios docx.test.ts.
  it("LosetasCalculadora pide html2canvas dinámicamente, recién al exportar", () => {
    const src = leer("components/calculadoras/losetas/LosetasCalculadora.tsx");
    expect(src).toMatch(/await import\(\s*["']html2canvas["']\s*\)/);
  });

  for (const tipo of ["cercos", "cobertores", "piscinas", "revestimientos"]) {
    it(`${tipo}: docx.ts pide docx dinámicamente, no con un import estático`, () => {
      const src = leer(`lib/documentos/${tipo}/docx.ts`);
      expect(src, `lib/documentos/${tipo}/docx.ts no usa import() dinámico para docx`).toMatch(
        /await import\(\s*["']docx["']\s*\)/
      );
      expect(src, `lib/documentos/${tipo}/docx.ts importa "docx" de forma estática`).not.toMatch(
        /^import\s+.*from\s+["']docx["']/m
      );
    });
  }
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
