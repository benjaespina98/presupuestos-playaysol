// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import React from "react";
import JSZip from "jszip";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import { crearLinea } from "@/lib/domain/precios/tipos";
import type { BloqueDocumento } from "@/lib/documentos/modelo";
import { generarDocxCercos, TEXTOS_POR_DEFECTO_CERCOS } from "@/lib/documentos/cercos/docx";
import { generarDocxPiscinas, TEXTOS_POR_DEFECTO_PISCINAS } from "@/lib/documentos/piscinas/docx";
import { armarBloquesCerco } from "@/lib/documentos/cercos/bloques";
import { armarBloquesPiscina } from "@/lib/documentos/piscinas/bloques";
import { textoDePdf } from "../helpers/pdfTexto";

/**
 * Casos extremos de los presupuestos al cliente: teléfono con detalles larguísimos, domicilio largo, nombre
 * largo y observaciones largas. Ni el PDF ni el Word pueden perder ni cambiar el texto, y los textos largos
 * hacen salto de línea (en la vista previa, en `tests/local/documentos.spec.ts`, se mide que no se pisen).
 */
const PUBLIC = path.resolve(process.cwd(), "public");

const TELEFONO = "353 4000000 (llamar después de las 18 hs, preguntar por Marcela, no usar WhatsApp en horario laboral) / 3534-123456 int. 22";
const DOMICILIO = "Av. Presidente Hipólito Yrigoyen 1234, 3º piso, departamento B, torre norte, barrio Güemes (esquina Bv. Sarmiento)";
const NOMBRE = "Familia Rodríguez de la Fuente Echeverría Martínez-Fernández de Córdoba y Alcántara (cuenta corriente 9988)";
const DETALLE = "Perímetro completo de la piscina con tramo de acceso lateral por el costado de la galería del fondo, incluyendo los cantos redondeados y el retiro de escombros." +
  " Observación: coordinar la visita con el encargado del barrio cerrado, que sólo recibe de lunes a viernes de 9 a 12 hs.";

function snapshot(tipo: PresupuestoV1["tipo"]): PresupuestoV1 {
  return {
    v: 1,
    tipo,
    fecha: "20/08/2026",
    validezDias: "7",
    cliente: { nombre: NOMBRE, domicilio: DOMICILIO, localidad: "Villa María, Córdoba", telefono: TELEFONO, email: "familia.rodriguez.de.la.fuente.echeverria@ejemplo-muy-largo.com.ar" },
    medidas: tipo === "cercos" ? { metrosLineales: 24 } : { largo: 8, ancho: 4 },
    lineas: [
      crearLinea({
        clave: "opcional_largo",
        descripcion: "Opcional con una descripción larguísima: instalación completa con materiales de primera calidad, mano de obra especializada, garantía escrita y retiro de sobrantes",
        unidad: "u",
        cantidad: 1,
        precioUnitario: 1234567,
        naturaleza: "informativa",
        incluida: true,
        origen: "catalogo",
      }),
    ],
    preciosBase: {},
    totales: [18500000],
    detalle: DETALLE,
    variacionEncabezado: "teal",
    modoPrecio: "ambos",
    fotos: [],
  } as PresupuestoV1;
}

/** Sin espacios, guiones ni saltos: un texto cortado en renglones (o con un guion de corte) sigue siendo el mismo. */
const IGNORAR = new Set(["-", String.fromCharCode(0xad), String.fromCharCode(0x95), String.fromCharCode(0x2022)]);
const plano = (t: string) => [...t].filter((c) => c.trim() !== "" &&!IGNORAR.has(c)).join("");

describe("presupuestos · casos extremos de texto", () => {
  const original = globalThis.fetch;
  beforeAll(() => {
    vi.stubGlobal("fetch", async (url: string) => {
      const rel = String(url).replace(/^https?:\/\/[^/]+/, "").replace(/^\//, "");
      const bytes = fs.readFileSync(path.join(PUBLIC, rel));
      return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
    });
  });
  afterAll(() => {
    vi.stubGlobal("fetch", original);
  });

  const generadores = {
    cercos: { docx: generarDocxCercos, textos: TEXTOS_POR_DEFECTO_CERCOS, bloques: armarBloquesCerco },
    piscinas: { docx: generarDocxPiscinas, textos: TEXTOS_POR_DEFECTO_PISCINAS, bloques: armarBloquesPiscina },
  } as const;

  for (const tipo of Object.keys(generadores) as (keyof typeof generadores)[]) {
    it(`${tipo}: el Word lleva completos el teléfono, el domicilio, el nombre y el detalle (sin cambiar el texto)`, async () => {
      const g = generadores[tipo];
      const docx = await g.docx(snapshot(tipo), [], g.textos);
      const zip = await JSZip.loadAsync(await docx.arrayBuffer());
      const xml = await zip.file("word/document.xml")!.async("string");
      const texto = xml.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
      for (const original of [TELEFONO, DOMICILIO, NOMBRE]) expect(texto).toContain(original);
      expect(plano(texto)).toContain(plano(DETALLE));
    });

    it(`${tipo}: el PDF lleva completos los mismos textos y salta de línea en vez de pisarlos`, async () => {
      const g = generadores[tipo];
      const snap = snapshot(tipo);
      const bloques = g.bloques(snap, g.textos, []);
      // La tarjeta de datos del cliente conserva los valores tal cual y los largos se marcan para ocupar el ancho.
      const meta = bloques.find((b: BloqueDocumento) => b.tipo === "meta");
      expect(meta && meta.tipo === "meta" ? meta.pares.map((p) => p.value) : []).toEqual(expect.arrayContaining([TELEFONO, DOMICILIO, NOMBRE]));

      const aData = (u: string) => {
        const archivo = path.join(PUBLIC, u.replace(/^\//, ""));
        return fs.existsSync(archivo) ? `data:image/${archivo.endsWith(".png") ? "png" : "jpeg"};base64,${fs.readFileSync(archivo).toString("base64")}` : u;
      };
      const conImagenes = bloques.map((b: BloqueDocumento) => (b.tipo === "encabezado" ? { ...b, logoUrl: aData(b.logoUrl) } : b));
      const { renderToBuffer } = await import("@react-pdf/renderer");
      const { PresupuestoPdfDocument } = await import("@/components/documentos/pdf/PresupuestoPdfDocument");
      const pdf = await renderToBuffer(React.createElement(PresupuestoPdfDocument, { bloques: conImagenes, titulo: "Prueba" }) as never);
      const texto = textoDePdf(new Uint8Array(pdf));
      for (const original of [TELEFONO, DOMICILIO, NOMBRE]) expect(plano(texto)).toContain(plano(original));
      expect(plano(texto)).toContain(plano(DETALLE));
    }, 120_000);
  }
});
