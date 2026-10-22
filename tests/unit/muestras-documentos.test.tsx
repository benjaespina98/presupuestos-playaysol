// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import { crearLinea } from "@/lib/domain/precios/tipos";
import type { BloqueDocumento } from "@/lib/documentos/modelo";
import { generarDocxPiscinas, TEXTOS_POR_DEFECTO_PISCINAS } from "@/lib/documentos/piscinas/docx";
import { generarDocxCercos, TEXTOS_POR_DEFECTO_CERCOS } from "@/lib/documentos/cercos/docx";
import { generarDocxCobertores, TEXTOS_POR_DEFECTO_COBERTORES } from "@/lib/documentos/cobertores/docx";
import { generarDocxRevestimientos, TEXTOS_POR_DEFECTO_REVESTIMIENTOS } from "@/lib/documentos/revestimientos/docx";
import { armarBloquesPiscina } from "@/lib/documentos/piscinas/bloques";
import { armarBloquesCerco } from "@/lib/documentos/cercos/bloques";
import { armarBloquesCobertor } from "@/lib/documentos/cobertores/bloques";
import { armarBloquesRevestimiento } from "@/lib/documentos/revestimientos/bloques";
import { armarNombreArchivo } from "@/lib/documentos/nombreArchivo";

/**
 * Genera muestras REALES (Word y PDF) de los cuatro presupuestos con casos difíciles, para mirarlas
 * renderizadas. No corre en la suite normal: se activa con PYS_MUESTRAS_DIR=<carpeta> (fuera del repo).
 *   $env:PYS_MUESTRAS_DIR='C:\\tmp\\muestras'; npx vitest run tests/unit/muestras-documentos.test.tsx
 * Las imágenes salen de public/ (el mismo contenido que sirve el portal); no toca la red ni la base.
 */
const DIR = process.env.PYS_MUESTRAS_DIR;
const PUBLIC = path.resolve(process.cwd(), "public");

// En Node no hay canvas: se reemplaza el redimensionado del navegador por uno que conserva los bytes
// y calcula las medidas con la misma regla (lado mayor <= maxDim).
const dimsDe = new Map<Blob, { width: number; height: number }>();
vi.mock("@/lib/documentos/imagenes", async (original) => ({
  ...(await original<typeof import("@/lib/documentos/imagenes")>()),
  redimensionarImagen: async (origen: Blob, maxDim: number) => {
    const d = dimsDe.get(origen) ?? { width: 800, height: 600 };
    const escala = Math.max(d.width, d.height) > maxDim ? maxDim / Math.max(d.width, d.height) : 1;
    return { blob: origen, width: Math.round(d.width * escala), height: Math.round(d.height * escala) };
  },
}));

const unaFoto = (rel: string, width: number, height: number, caption = "") => {
  const blob = new Blob([fs.readFileSync(path.join(PUBLIC, rel))], { type: "image/jpeg" });
  dimsDe.set(blob, { width, height });
  return { id: rel, blob, caption, width, height };
};

function snapshot(tipo: PresupuestoV1["tipo"], cliente: string, extra: Partial<PresupuestoV1>): PresupuestoV1 {
  return {
    v: 1,
    tipo,
    fecha: "20/08/2026",
    validezDias: "7",
    cliente: { nombre: cliente, domicilio: "Av. Mitre 1234 — Barrio Güemes", localidad: "Villa María", telefono: "353 400-0000", email: "cliente@ejemplo.com" },
    medidas: {},
    lineas: [],
    preciosBase: {},
    totales: [18500000],
    detalle: "",
    variacionEncabezado: "teal",
    modoPrecio: "ambos",
    fotos: [],
    ...extra,
  } as PresupuestoV1;
}

const CLIENTES = {
  base: "Pérez, Juan",
  raro: "Ñandú Peña-Müller & O'Brien <ñ> «¿Qué?» ¡Árbol!",
  largo: "Familia Rodríguez de la Fuente Echeverría Martínez-Fernández de Córdoba y Alcántara",
};

function casos(tipo: "piscinas" | "cercos" | "cobertores" | "revestimientos") {
  const opcionales = (n: number, conPrecio: boolean) =>
    Array.from({ length: n }, (_, i) =>
      crearLinea({
        clave: i % 3 === 0 ? "revestimiento_ceramico_bali" : i % 3 === 1 ? "climatizacion_25000" : `opcional_${i}`,
        descripcion: `Opcional número ${i + 1}: instalación completa con materiales de primera calidad, mano de obra y garantía`,
        unidad: "u",
        cantidad: 1,
        precioUnitario: conPrecio ? 1234567 + i * 1000 : null,
        naturaleza: "informativa",
        incluida: i % 2 === 0,
        origen: "catalogo",
      })
    );
  const medidas: Record<string, unknown> =
    tipo === "cercos"
      ? { metrosLineales: 24 }
      : tipo === "cobertores"
        ? { largo: 8, ancho: 4, adicionalM2: 0 }
        : tipo === "revestimientos"
          ? { largo: 8, ancho: 4, profMin: 1.5, profMax: 0, escalera: 0, desperdicio: 0, adicionalesM2: [] }
          : { largo: 8, ancho: 4 };
  const base = { medidas, detalle: "Perímetro completo de la piscina.\nIncluye tramo de acceso lateral." } as Partial<PresupuestoV1>;
  return [
    { id: "base", cliente: CLIENTES.base, extra: { ...base, lineas: opcionales(3, true) } },
    { id: "caracteres", cliente: CLIENTES.raro, extra: { ...base, lineas: opcionales(2, true), detalle: "Ñ ñ á é í ó ú ü — “comillas” ‘simples’ & <b>no es html</b> 100% ¿ok?" } },
    { id: "monto-enorme", cliente: CLIENTES.base, extra: { ...base, totales: [98765432100, 123456789012], lineas: opcionales(2, true).map((l) => ({ ...l, precioUnitario: 98765432100, total: 98765432100 })) } },
    { id: "largo", cliente: CLIENTES.largo, extra: { ...base, lineas: opcionales(24, true) } },
    { id: "a-cotizar", cliente: CLIENTES.base, extra: { ...base, lineas: opcionales(6, false) } },
  ];
}

const FOTOS_GRANDES = () => [
  unaFoto("seeds/general-1-454abd16.jpg", 1200, 900, "Foto grande horizontal"),
  unaFoto("seeds/travertino-1-ac1fe49e.jpg", 413, 392, "Foto chica casi cuadrada"),
  unaFoto("seeds/general-2-16872cab.jpg", 300, 1400, "Foto vertical muy alta"),
];

describe.skipIf(!DIR)("muestras de documentos", () => {
  const original = globalThis.fetch;
  beforeAll(() => {
    fs.mkdirSync(DIR!, { recursive: true });
    // `fetch("/header-teal.png")` o `fetch("/seeds/x.jpg")` leen el archivo de public/.
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
    piscinas: { docx: generarDocxPiscinas, textos: TEXTOS_POR_DEFECTO_PISCINAS, bloques: armarBloquesPiscina },
    cercos: { docx: generarDocxCercos, textos: TEXTOS_POR_DEFECTO_CERCOS, bloques: armarBloquesCerco },
    cobertores: { docx: generarDocxCobertores, textos: TEXTOS_POR_DEFECTO_COBERTORES, bloques: armarBloquesCobertor },
    revestimientos: { docx: generarDocxRevestimientos, textos: TEXTOS_POR_DEFECTO_REVESTIMIENTOS, bloques: armarBloquesRevestimiento },
  } as const;

  for (const tipo of Object.keys(generadores) as (keyof typeof generadores)[]) {
    for (const caso of casos(tipo)) {
      it(`${tipo} · ${caso.id}`, async () => {
        const g = generadores[tipo];
        const snap = snapshot(tipo, caso.cliente, caso.extra);
        const conFotos = caso.id === "base" || caso.id === "largo";
        const nombre = armarNombreArchivo(tipo, snap.cliente.nombre, snap.fecha);
        expect(nombre).not.toMatch(/[\\/:*?"<>|]/);

        const docx = await g.docx(snap, conFotos ? FOTOS_GRANDES() : [], g.textos);
        fs.writeFileSync(path.join(DIR!, `${tipo}__${caso.id}.docx`), Buffer.from(await docx.arrayBuffer()));

        // PDF: mismos bloques que la pantalla; las imágenes de public/ se pasan como rutas de archivo.
        const fotosUsuario = conFotos
          ? FOTOS_GRANDES().map((f) => ({ id: f.id, url: path.join(PUBLIC, f.id), caption: f.caption, width: f.width, height: f.height }))
          : [];
        const bloques = g.bloques(snap, g.textos, fotosUsuario as never);
        // react-pdf recibe las imágenes como data URI (así no depende de rutas ni de red).
        const aRuta = (u: string) => {
          const archivo = u.startsWith("/") ? path.join(PUBLIC, u) : u;
          if (!fs.existsSync(archivo)) return u;
          const tipo = archivo.endsWith(".png") ? "image/png" : "image/jpeg";
          return `data:${tipo};base64,${fs.readFileSync(archivo).toString("base64")}`;
        };
        const conRutas = bloques.map((b: BloqueDocumento) => {
          if (b.tipo === "encabezado") return { ...b, logoUrl: aRuta(b.logoUrl) };
          if (b.tipo === "galeriaSeeds" || b.tipo === "galeriaFotos" || b.tipo === "tarjetaOpcional")
            return { ...b, fotos: b.fotos.map((f) => ({ ...f, url: aRuta(f.url) })) };
          return b;
        });
        const { renderToBuffer } = await import("@react-pdf/renderer");
        const { PresupuestoPdfDocument } = await import("@/components/documentos/pdf/PresupuestoPdfDocument");
        const pdf = await renderToBuffer(React.createElement(PresupuestoPdfDocument, { bloques: conRutas, titulo: nombre }) as never);
        fs.writeFileSync(path.join(DIR!, `${tipo}__${caso.id}.pdf`), pdf);
        expect(pdf.length).toBeGreaterThan(5000);
      }, 120_000);
    }
  }
});
