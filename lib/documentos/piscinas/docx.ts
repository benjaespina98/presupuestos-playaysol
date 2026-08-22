import type { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import type { LineaPresupuesto } from "@/lib/domain/precios/tipos";
import { precioDeOpcional } from "@/lib/domain/precios/piscinas";
import { formatARS } from "@/lib/format/ars";
import { redimensionarImagen, MAX_DIM_DOCX, CALIDAD_DOCX } from "../imagenes";
import type { TextosCompartidos } from "../textosCompartidos";
import { FOTOS_GENERALES_PISCINAS, fotosSeedDeOpcional, type FotoSeed } from "../fotosSeed";

/**
 * Generador del .docx de Piscinas. Port 1:1 de
 * `buildDocxSections`/`downloadWord` en `public/piscinas-calc.js` — misma
 * estructura de bloques que lib/documentos/cercos/docx.ts, pero con las dos
 * reglas propias de piscinas (ver DocumentoPiscina.tsx): SUBTOTAL siempre,
 * TOTAL sólo con adicionales, y opcionales TODOS con "No incluye".
 */

const HEADER_VARIANTS: Record<string, { color: string; img: string }> = {
  teal: { color: "#00829C", img: "/header-teal.png" },
  navy: { color: "#214D5A", img: "/header-navy.png" },
};

const DOCX_NAVY = "1B3A5C";
const DOCX_TEAL = "00829C";
const DOCX_TEXT = "1C2B33";
const DOCX_NAVY_SOFT = "EEF2F6";
const DOCX_BORDER_SOFT = "E1E7EC";
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

export async function generarDocxPiscinas(
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
  const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

  const adicionales = snapshot.lineas.filter((l) => l.naturaleza === "cotiza");
  const opcionales = snapshot.lineas.filter((l) => l.naturaleza === "informativa");
  const hayAdicionales = adicionales.length > 0;
  const subtotal = snapshot.totales[0] ?? 0;
  const total = snapshot.totales[1];

  const v = HEADER_VARIANTS[snapshot.variacionEncabezado] || HEADER_VARIANTS.teal;
  const headerBytes = await urlABytes(v.img);

  const imgBytesById: Record<string, { bytes: Uint8Array; width: number; height: number }> = {};
  for (const f of fotosGenerales) {
    imgBytesById[f.id] = await blobABytesConstrained(f.blob);
  }

  // Fotos de referencia por opcional (revestimientos, climatización, cerco
  // perimetral) + las "generales" del final — contenido de catálogo, no del
  // presupuesto: se piden una sola vez por URL (travertino se comparte entre
  // dos opcionales, ver fotosSeed.ts) y se insertan bytes a bytes, iguales a
  // como ya se pide el logo del encabezado un poco más arriba.
  const seedUrls = new Set<string>();
  for (const op of opcionales) for (const f of fotosSeedDeOpcional(op.clave)) seedUrls.add(f.url);
  for (const f of FOTOS_GENERALES_PISCINAS) seedUrls.add(f.url);
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

  function docxOptCard(desc: string, priceTxt: string) {
    const sinPrecio = priceTxt === "No incluye";
    return new Table({
      width: { size: DOCX_CONTENT_WIDTH_TWIP, type: WidthType.DXA },
      columnWidths: [DOCX_CONTENT_WIDTH_TWIP],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: DOCX_CONTENT_WIDTH_TWIP, type: WidthType.DXA },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: DOCX_BORDER_SOFT },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: DOCX_BORDER_SOFT },
                left: { style: BorderStyle.SINGLE, size: 4, color: DOCX_BORDER_SOFT },
                right: { style: BorderStyle.SINGLE, size: 4, color: DOCX_BORDER_SOFT },
              },
              shading: { fill: "FAFBFC", type: ShadingType.CLEAR },
              margins: { top: 160, bottom: 160, left: 200, right: 200 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: desc, bold: true, size: 21, color: DOCX_TEXT }),
                    new TextRun({
                      bold: true,
                      size: 21,
                      color: sinPrecio ? "8B98A3" : DOCX_NAVY,
                      children: [
                        new PositionalTab({
                          alignment: PositionalTabAlignment.RIGHT,
                          relativeTo: PositionalTabRelativeTo.MARGIN,
                          leader: PositionalTabLeader.NONE,
                        }),
                        priceTxt,
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });
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

  children.push(...docxTitle("Presupuesto de construcción piscina"));
  children.push(
    docxMetaCard([
      { label: "Fecha:", value: snapshot.fecha },
      { label: "Señor/Sra:", value: snapshot.cliente.nombre },
      { label: "Domicilio:", value: snapshot.cliente.domicilio },
      { label: "Localidad:", value: snapshot.cliente.localidad },
      { label: "Tel:", value: snapshot.cliente.telefono },
      { label: "Email:", value: snapshot.cliente.email },
    ])
  );
  children.push(new Paragraph({ spacing: { after: 220 }, children: [] }));

  // "Dimensión piscina" se muestra siempre, tenga o no contenido debajo —
  // igual que el legacy (ver el comentario en DocumentoPiscina.tsx).
  children.push(docxSectionTitle("Dimensión piscina"));
  const dimCard = docxDimensionCard(snapshot.detalle);
  if (dimCard) children.push(dimCard);
  children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));

  children.push(docxPriceLine("SUBTOTAL", formatARS(subtotal), { bold: true, big: true }));
  if (hayAdicionales) {
    adicionales.forEach((a: LineaPresupuesto) => children.push(docxPriceLine(a.descripcion, formatARS(a.total ?? 0))));
    children.push(docxPriceLine("TOTAL", formatARS(total ?? 0), { bold: true, big: true, topRule: true }));
  }

  if (opcionales.length) {
    children.push(docxSectionTitle("Opcionales"));
    opcionales.forEach((op: LineaPresupuesto) => {
      const precio = precioDeOpcional({ incluida: op.incluida, precioUnitario: op.precioUnitario });
      const priceTxt = precio === null ? "No incluye" : formatARS(precio);
      children.push(docxOptCard(op.descripcion, priceTxt));
      children.push(...docxSeedPhotos(fotosSeedDeOpcional(op.clave)));
      children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
    });
  }

  children.push(docxValidity(snapshot.validezDias));
  children.push(...docxBodyText(textos.legal, 19));
  children.push(...docxPhotoGallery(fotosGenerales));
  children.push(...docxFooter());

  // "Modelos de referencia": van al final, después del pie de la empresa —
  // mismo lugar que en un presupuesto real ya entregado (no es un error de
  // orden, es la posición que el negocio ya usaba).
  children.push(docxSectionTitle("Modelos de referencia"));
  children.push(...docxSeedPhotos(FOTOS_GENERALES_PISCINAS, 260));

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

export const TEXTO_LEGAL_POR_DEFECTO = `OBRA CIVIL PISCINA:

Ejecutada con materiales de primera calidad y construcción de:

1. - Toda la estructura será de hormigón de cemento portland con una mezcla homogénea de cementos áridos y agua (resistencia característica de H21), sin aplicación de otro material adicionado y compuesta de:

2. - Una losa de hormigón de 15 cm de espesor con armadura de hierros del 6 mm de diámetro cada 20 cm en ambos sentidos y de un solo tipo de acero en toda la obra.

3. - Muros laterales de hormigón de las mismas características que el anterior y encofrado entre el laminado vertical y un muro de mampostería de ladrillos comunes de 13 cm de espesor.

4. - Encadenados perimetral tanto superior e inferior incorporado en los laterales para soportar cambios de dilatación de materiales.

5. - Una losa perimetral de hormigón de 0.50 cm de ancho y 10 cm de espesor, formando una vereda en continuidad con el muro lateral.

6. - Todo el conjunto será terminado con revoque grueso y fino con agregado hidrófugo y sellado con elastómero en juntas y orificios entre el hormigón e instalación hidráulica.

7. - El tamaño de la sala de filtros será del tamaño que demanden los equipos (1,20 x 1,00 aproximadamente) y será en mampostería de ladrillos comunes enrasado y con piso doble nido de abejas con junta de arena para el filtrado y normal escurrimiento del agua.

8. - Una escalera de material emplazada en la parte baja.

B) SISTEMA HIDRÁULICO:

1. - Electro bomba monofásica autocebante 1/2 HP con trampa de pelo incorporada.
2. - Filtro VC30 de Poliuretano (apto para hasta 60.000 lts.), con multiválvulas de 6 funciones, colector de 6 picos, difusor ABS y visor para retro lavado. Incluye el manto filtrante.
3. - Hidromasajes zonificados, sistema embutido con toma de aire exterior.
4. - Toma de fondo, toma de limpia fondo y Skimmer o barre superficie.
5. - Toda la cañería de la conexión hidráulica será en PVC 3,2 reforzada de 10 kg. de presión.

El formato de la piscina será el determinado por el propietario.

La obra civil tiene una garantía de 10 años y el equipo hidráulico DOS años a excepción de desperfectos eléctricos.

El presente presupuesto incluye la excavación del pozo donde se construirá la piscina. No incluye la pintura. Recomendamos no pintarla hasta después de los tres meses de construida para favorecer el proceso de curado. No incluye la conexión eléctrica de 220V hasta la sala de filtros, no incluye tapa sala de filtros y no incluye conexión a cloacas.

IMPORTANTE: Las medidas especificadas precedentemente son libres, no de construcción.

OPCIONALES: Limpia fondo Robot automático marca Dolphin. Cubre piscina de lona microperforada. Ionizador solar boya. Nado contracorriente. Revestimiento en Venecitas vítreas importadas y cerámicas símil piedra. Desborde infinito. Climatización solar, eléctrica y a gas.

El presente no incluye sobreelevación de la construcción.`;

export const FOOTER_POR_DEFECTO = {
  empresa: "PLAYA Y SOL S.A.S.",
  direccion: "Corrientes 1210, 5900 Villa María, Córdoba",
  telFijo: "0353-4531612",
  contactoNombre: "Cr. Francisco Espina",
  contactoCel: "3535668994",
  whatsapp: "3534224605",
  email: "piscinas@playaysol.com.ar",
  web: "www.playaysol.com.ar",
  facebook: "Playa y Sol Piscinas",
  facebookUrl: "",
  instagram: "@playaysol.piscinas",
  instagramUrl: "https://www.instagram.com/playaysol.piscinas/",
};

export const TEXTOS_POR_DEFECTO_PISCINAS: TextosCompartidos = {
  legal: TEXTO_LEGAL_POR_DEFECTO,
  footer: FOOTER_POR_DEFECTO,
};
