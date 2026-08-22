import type { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import type { LineaPresupuesto } from "@/lib/domain/precios/tipos";
import { calcularRevestimiento } from "@/lib/domain/precios/revestimientos";
import { formatARS, formatNumero } from "@/lib/format/ars";
import { redimensionarImagen, MAX_DIM_DOCX, CALIDAD_DOCX } from "../imagenes";
import type { TextosCompartidos } from "../textosCompartidos";
import { fotosSeedDeOpcional, type FotoSeed } from "../fotosSeed";

/**
 * Generador del .docx de Revestimientos. Port 1:1 de
 * `buildDocxSections`/`downloadWord` en `public/revestimientos-calc.js` —
 * misma estructura que los otros lib/documentos/*, con las líneas de TOTAL
 * "por alternativa" propias de este tipo (ver DocumentoRevestimiento.tsx).
 */

const HEADER_VARIANTS: Record<string, { color: string; img: string }> = {
  teal: { color: "#00829C", img: "/header-teal.png" },
  navy: { color: "#214D5A", img: "/header-navy.png" },
};

const DOCX_NAVY = "1B3A5C";
const DOCX_TEAL = "00829C";
const DOCX_TEXT = "1C2B33";
const DOCX_NAVY_SOFT = "EEF2F6";
const DOCX_PAGE_WIDTH_MM = 160;

export interface FotoParaDocx {
  id: string;
  blob: Blob;
  caption: string;
  width: number | null;
  height: number | null;
}

async function urlABytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

async function blobABytesConstrained(blob: Blob): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const { blob: out, width, height } = await redimensionarImagen(blob, MAX_DIM_DOCX, CALIDAD_DOCX);
  const buf = await out.arrayBuffer();
  return { bytes: new Uint8Array(buf), width, height };
}

function splitDimensionLines(text: string): string[] {
  return String(text || "")
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚÑ0-9])/))
    .map((s) => s.trim())
    .filter(Boolean);
}

function nombreCorto(desc: string): string {
  const s = String(desc || "").trim();
  const corto = s.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return corto || s;
}

function profundidadTexto(min: number, max: number, variable: boolean): string {
  if (variable) return `de ${formatNumero(min)} m a ${formatNumero(max)} m de profundidad`;
  return `profundidad ${formatNumero(min)} m`;
}

type Medidas = {
  largo?: number;
  ancho?: number;
  profMin?: number;
  profMax?: number;
  escalera?: number;
  desperdicio?: number;
  adicionalesM2?: { label: string; m2: number }[];
};

export async function generarDocxRevestimientos(
  snapshot: PresupuestoV1,
  fotosGenerales: FotoParaDocx[],
  textos: TextosCompartidos
): Promise<Blob> {
  const docx = await import("docx");
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    ImageRun,
    ExternalHyperlink,
    AlignmentType,
    BorderStyle,
    WidthType,
    ShadingType,
    PositionalTab,
    PositionalTabAlignment,
    PositionalTabRelativeTo,
    PositionalTabLeader,
    VerticalAlign,
    convertMillimetersToTwip,
  } = docx;

  const DOCX_CONTENT_WIDTH_TWIP = convertMillimetersToTwip(DOCX_PAGE_WIDTH_MM);

  const medidas = snapshot.medidas as Medidas;
  const adicionalesM2 = medidas.adicionalesM2 ?? [];
  const r = calcularRevestimiento({
    largo: medidas.largo ?? 0,
    ancho: medidas.ancho ?? 0,
    profMin: medidas.profMin ?? 0,
    profMax: medidas.profMax ?? 0,
    escalera: medidas.escalera ?? 0,
    desperdicio: medidas.desperdicio ?? 0,
    adicionalesM2: adicionalesM2.map((a) => a.m2),
    materiales: [],
    adicionales: [],
  });

  const materialesIncluidos = snapshot.lineas.filter((l) => l.naturaleza === "alternativa" && l.incluida);
  const materialesConTotal = materialesIncluidos.filter((m) => m.total !== null);
  const adicionales = snapshot.lineas.filter((l) => l.naturaleza === "cotiza");

  const v = HEADER_VARIANTS[snapshot.variacionEncabezado] || HEADER_VARIANTS.teal;
  const headerBytes = await urlABytes(v.img);

  const imgBytesById: Record<string, { bytes: Uint8Array; width: number; height: number }> = {};
  for (const f of fotosGenerales) {
    imgBytesById[f.id] = await blobABytesConstrained(f.blob);
  }

  // Fotos de referencia por material (mismo criterio y mismo mapeo que
  // Piscinas — ver lib/documentos/fotosSeed.ts: la clave del material es la
  // misma en las dos calculadoras).
  const seedUrls = new Set<string>();
  for (const m of materialesIncluidos) for (const f of fotosSeedDeOpcional(m.clave)) seedUrls.add(f.url);
  const seedBytesByUrl: Record<string, Uint8Array> = {};
  for (const url of seedUrls) seedBytesByUrl[url] = await urlABytes(url);

  function docxSeedPhotos(fotos: FotoSeed[], width = 220) {
    return fotos
      .filter((f) => seedBytesByUrl[f.url])
      .map(
        (f) =>
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 100 },
            keepLines: true,
            children: [
              new ImageRun({
                type: "jpg",
                data: seedBytesByUrl[f.url],
                transformation: { width, height: Math.round(width * (f.height / f.width)) },
                altText: { title: "Foto de referencia", description: "Foto de referencia", name: "Foto de referencia" },
              }),
            ],
          })
      );
  }

  function docxTitle(text: string) {
    return [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        border: { bottom: { color: DOCX_TEAL, space: 6, style: BorderStyle.SINGLE, size: 12 } },
        children: [new TextRun({ text, bold: true, size: 27, color: DOCX_NAVY, allCaps: true, characterSpacing: 20 })],
      }),
      new Paragraph({ spacing: { after: 160 }, children: [] }),
    ];
  }

  function docxMetaCard(pares: { label: string; value: string }[]) {
    const paras = pares
      .filter((p) => p.value)
      .map(
        (p) =>
          new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({ text: `${p.label} `, bold: true, size: 20, color: DOCX_NAVY }),
              new TextRun({ text: p.value, size: 20, color: DOCX_TEXT }),
            ],
          })
      );
    return new Table({
      width: { size: DOCX_CONTENT_WIDTH_TWIP, type: WidthType.DXA },
      columnWidths: [DOCX_CONTENT_WIDTH_TWIP],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: DOCX_CONTENT_WIDTH_TWIP, type: WidthType.DXA },
              shading: { fill: DOCX_NAVY_SOFT, type: ShadingType.CLEAR },
              margins: { top: 180, bottom: 140, left: 220, right: 220 },
              children: paras,
            }),
          ],
        }),
      ],
    });
  }

  function docxDimensionCard(text: string) {
    const lineas = splitDimensionLines(text);
    if (!lineas.length) return null;
    const paras = lineas.map(
      (l) =>
        new Paragraph({
          spacing: { after: 60 },
          indent: { left: 160 },
          bullet: { level: 0 },
          children: [new TextRun({ text: l, size: 21, color: DOCX_TEXT })],
        })
    );
    const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
    return new Table({
      width: { size: DOCX_CONTENT_WIDTH_TWIP, type: WidthType.DXA },
      columnWidths: [DOCX_CONTENT_WIDTH_TWIP],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: DOCX_CONTENT_WIDTH_TWIP, type: WidthType.DXA },
              borders: {
                top: NO_BORDER,
                bottom: NO_BORDER,
                right: NO_BORDER,
                left: { style: BorderStyle.SINGLE, size: 18, color: DOCX_NAVY },
              },
              margins: { top: 140, bottom: 140, left: 220, right: 160 },
              children: paras,
            }),
          ],
        }),
      ],
    });
  }

  function docxSectionTitle(text: string) {
    return new Paragraph({
      spacing: { before: 280, after: 100 },
      border: { bottom: { color: DOCX_TEAL, space: 2, style: BorderStyle.SINGLE, size: 8 } },
      children: [new TextRun({ text, bold: true, size: 20, color: DOCX_NAVY, allCaps: true, characterSpacing: 10 })],
    });
  }

  function docxBodyText(text: string, size = 22) {
    return String(text || "")
      .split("\n")
      .map(
        (line) =>
          new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: line, size, color: DOCX_TEXT })],
          })
      );
  }

  function docxPriceLine(desc: string, price: string, { bold = false, big = false, topRule = false } = {}) {
    const size = big ? 26 : 22;
    const color = big ? DOCX_NAVY : DOCX_TEXT;
    return new Paragraph({
      spacing: { after: 80 },
      border: topRule ? { top: { color: DOCX_NAVY, space: 6, style: BorderStyle.DOUBLE, size: 8 } } : undefined,
      children: [
        new TextRun({ text: desc, bold, size, color }),
        new TextRun({
          bold,
          size,
          color,
          children: [
            new PositionalTab({
              alignment: PositionalTabAlignment.RIGHT,
              relativeTo: PositionalTabRelativeTo.MARGIN,
              leader: PositionalTabLeader.DOT,
            }),
            price,
          ],
        }),
      ],
    });
  }

  function docxValidity(dias: string) {
    return new Paragraph({
      spacing: { before: 160, after: 80 },
      children: [
        new TextRun({
          text: `El presente presupuesto tiene una validez de ${dias} días.`,
          bold: true,
          size: 22,
          color: DOCX_TEXT,
        }),
      ],
    });
  }

  function docxPhotoNodes(fotos: FotoParaDocx[]) {
    const nodes = [];
    for (const f of fotos) {
      const info = imgBytesById[f.id];
      if (info) {
        const ratio = info.height && info.width ? info.height / info.width : 0.75;
        const w = 400;
        const h = Math.round(w * ratio);
        nodes.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: f.caption ? 20 : 140 },
            keepLines: true,
            children: [
              new ImageRun({
                type: "jpg",
                data: info.bytes,
                transformation: { width: w, height: h },
                altText: { title: "Foto", description: "Foto ilustrativa", name: "Foto" },
              }),
            ],
          })
        );
      }
      if (f.caption) {
        nodes.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 140 },
            children: [new TextRun({ text: f.caption, italics: true, size: 18, color: "555555" })],
          })
        );
      }
    }
    return nodes;
  }

  function docxPhotoGallery(fotos: FotoParaDocx[]) {
    if (!fotos.length) return [];
    return [docxSectionTitle("Fotos ilustrativas"), ...docxPhotoNodes(fotos)];
  }

  function docxHyperlinkLine(label: string, displayText: string, url: string) {
    return new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({ text: label, size: 19, color: DOCX_NAVY }),
        new ExternalHyperlink({
          link: url,
          children: [new TextRun({ text: displayText, size: 19, color: DOCX_NAVY, underline: {} })],
        }),
      ],
    });
  }

  function docxFooter() {
    const f = textos.footer;
    const paras = [
      new Paragraph({
        spacing: { before: 280, after: 80 },
        border: { top: { color: "E1E7EC", space: 10, style: BorderStyle.SINGLE, size: 6 } },
        children: [new TextRun({ text: f.empresa, bold: true, size: 21, color: DOCX_NAVY, characterSpacing: 6 })],
      }),
    ];
    const mapsUrl =
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent("Playa y Sol S.A.S.") +
      "&query_place_id=ChIJd1F4COdCzJURn7QoGKCkKXA";
    paras.push(docxHyperlinkLine("Dirección: ", f.direccion, mapsUrl));
    paras.push(docxHyperlinkLine("Tel: ", f.telFijo, `tel:${f.telFijo.replace(/\D/g, "")}`));
    paras.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({ text: `Contacto: ${f.contactoNombre} - Cel. ${f.contactoCel}`, size: 19, color: DOCX_NAVY }),
        ],
      })
    );
    paras.push(docxHyperlinkLine("WhatsApp: ", f.whatsapp, `https://wa.me/549${f.whatsapp.replace(/\D/g, "")}`));
    paras.push(docxHyperlinkLine("E-mail: ", f.email, `mailto:${f.email}`));
    paras.push(docxHyperlinkLine("Web: ", f.web, f.web.startsWith("http") ? f.web : `https://${f.web}`));
    paras.push(
      f.facebookUrl
        ? docxHyperlinkLine("Facebook: ", f.facebook, f.facebookUrl)
        : new Paragraph({ children: [new TextRun({ text: `Facebook: ${f.facebook}`, size: 19, color: DOCX_NAVY })] })
    );
    paras.push(docxHyperlinkLine("Instagram: ", f.instagram, f.instagramUrl));
    return paras;
  }

  const children = [];

  children.push(
    new Table({
      width: { size: DOCX_CONTENT_WIDTH_TWIP, type: WidthType.DXA },
      columnWidths: [DOCX_CONTENT_WIDTH_TWIP],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: DOCX_CONTENT_WIDTH_TWIP, type: WidthType.DXA },
              shading: { fill: v.color.replace("#", ""), type: ShadingType.CLEAR },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 300, bottom: 300 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new ImageRun({
                      type: "png",
                      data: headerBytes,
                      transformation: { width: 130, height: 130 },
                      altText: { title: "Logo", description: "Playa y Sol", name: "Logo" },
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );
  children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));

  children.push(...docxTitle("Presupuesto de revestimiento para piscina"));

  const partesM2 = [`Piso: ${formatNumero(r.m2Piso)} m²`, `Paredes: ${formatNumero(r.m2Paredes)} m²`];
  if ((medidas.escalera ?? 0) > 0) partesM2.push(`Escalera: ${formatNumero(medidas.escalera ?? 0)} m²`);
  if ((medidas.desperdicio ?? 0) > 0) partesM2.push(`Desperdicio: ${formatNumero(medidas.desperdicio ?? 0)} m²`);
  adicionalesM2.forEach((a) => {
    if (a.m2 > 0) partesM2.push(`${a.label || "Adicional"}: ${formatNumero(a.m2)} m²`);
  });

  children.push(
    docxMetaCard([
      { label: "Fecha:", value: snapshot.fecha },
      { label: "Señor/Sra:", value: snapshot.cliente.nombre },
      { label: "Domicilio:", value: snapshot.cliente.domicilio },
      { label: "Localidad:", value: snapshot.cliente.localidad },
      { label: "Tel:", value: snapshot.cliente.telefono },
      { label: "Email:", value: snapshot.cliente.email },
      {
        label: "Medidas:",
        value: `${formatNumero(medidas.largo ?? 0)} m largo × ${formatNumero(medidas.ancho ?? 0)} m ancho, ${profundidadTexto(r.profundidadMin, r.profundidadMax, r.profundidadVariable)}`,
      },
      { label: "", value: `${partesM2.join(" + ")} = total ${formatNumero(r.m2Total)} m² a revestir` },
    ])
  );
  children.push(new Paragraph({ spacing: { after: 220 }, children: [] }));

  if (snapshot.detalle && snapshot.detalle.trim()) {
    children.push(docxSectionTitle("Notas de la pileta"));
    const dimCard = docxDimensionCard(snapshot.detalle);
    if (dimCard) children.push(dimCard);
    children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  }

  if (materialesIncluidos.length) {
    children.push(docxSectionTitle("Revestimiento cotizado"));
    materialesIncluidos.forEach((m: LineaPresupuesto) => {
      const priceTxt = m.total === null ? "No incluye" : formatARS(m.total);
      children.push(docxPriceLine(m.descripcion, priceTxt));
      if (m.precioUnitario !== null && m.total !== null) {
        children.push(
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: `${formatARS(m.precioUnitario)} por m² × ${formatNumero(r.m2Total)} m²`,
                size: 17,
                color: "6B7680",
              }),
            ],
          })
        );
      }
      children.push(...docxSeedPhotos(fotosSeedDeOpcional(m.clave)));
    });
  }

  if (adicionales.length) {
    children.push(docxSectionTitle("Adicionales"));
    adicionales.forEach((a: LineaPresupuesto) =>
      children.push(docxPriceLine(a.descripcion, formatARS(a.total ?? 0)))
    );
  }

  children.push(new Paragraph({ spacing: { before: 160 }, children: [] }));
  if (materialesConTotal.length >= 2) {
    materialesConTotal.forEach((m: LineaPresupuesto, i) => {
      children.push(
        docxPriceLine(`TOTAL revestimiento con ${nombreCorto(m.descripcion)}`, formatARS(snapshot.totales[i]), {
          bold: true,
          big: true,
          topRule: i === 0,
        })
      );
    });
  } else {
    children.push(
      docxPriceLine("TOTAL REVESTIMIENTO", formatARS(snapshot.totales[0] ?? 0), {
        bold: true,
        big: true,
        topRule: true,
      })
    );
  }

  children.push(docxValidity(snapshot.validezDias));
  children.push(...docxBodyText(textos.legal, 19));
  children.push(...docxPhotoGallery(fotosGenerales));
  children.push(...docxFooter());

  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial" } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297) },
            margin: {
              top: convertMillimetersToTwip(20),
              bottom: convertMillimetersToTwip(20),
              left: convertMillimetersToTwip(25),
              right: convertMillimetersToTwip(25),
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}

export const TEXTO_LEGAL_POR_DEFECTO = `REVESTIMIENTOS PARA PISCINA:

El revestimiento se cotiza por m² instalado/terminado, según el material elegido. La superficie a revestir se calcula sobre el piso y las paredes de la pileta (ver detalle de cálculo en este presupuesto).

Opciones disponibles: cerámico importado, venecitas premium, piedra natural, mármol travertino, y terminaciones de solar seco (losetas atérmicas o deck).

Si la pileta ya cuenta con un revestimiento anterior en mal estado, es necesario un disqueado previo (remoción), que se cotiza por obra y no por m².

IMPORTANTE: Las medidas especificadas son libres, no de fabricación. La superficie real puede variar levemente una vez tomadas las medidas exactas en el lugar.

El presente presupuesto tiene una validez de 7 días hábiles, sujeto a modificación de costos de materiales.`;

export const FOOTER_POR_DEFECTO = {
  empresa: "PLAYA Y SOL S.A.S.",
  direccion: "Corrientes 1210, 5900 Villa María, Córdoba",
  telFijo: "0353-4531612",
  contactoNombre: "Cr. Francisco Espina",
  contactoCel: "3535668994",
  whatsapp: "3534224605",
  email: "piscinas@playaysol.com.ar",
  web: "playaysol.com.ar",
  facebook: "Playa y Sol Piscinas",
  facebookUrl: "https://www.facebook.com/playaysol.piscinas",
  instagram: "@playaysol.piscinas",
  instagramUrl: "https://www.instagram.com/playaysol.piscinas/",
};

export const TEXTOS_POR_DEFECTO_REVESTIMIENTOS: TextosCompartidos = {
  legal: TEXTO_LEGAL_POR_DEFECTO,
  footer: FOOTER_POR_DEFECTO,
};
