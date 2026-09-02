import type { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import type { LineaPresupuesto } from "@/lib/domain/precios/tipos";
import { formatARS } from "@/lib/format/ars";
import { redimensionarImagen, MAX_DIM_DOCX, CALIDAD_DOCX } from "../imagenes";
import type { TextosCompartidos } from "../textosCompartidos";
import { FOTOS_REFERENCIA_CERCOS } from "../fotosSeed";

/**
 * Generador del .docx de Cercos. Port 1:1 de `buildDocxSections`/`downloadWord`
 * en `public/cercos-calc.js` — mismos textos, mismos colores, misma
 * estructura. No se reinventa el formato del documento (Lote 1 de la Fase 5
 * lo pide explícitamente): esto es una traducción, no un rediseño.
 *
 * `docx` se importa dinámicamente (no en el top del módulo) por la misma
 * razón que el bridge legacy la cargaba recién al presionar "Word": son
 * ~370 KB que ninguna otra pantalla necesita.
 */

const HEADER_VARIANTS: Record<string, { color: string; img: string }> = {
  teal: { color: "#00829C", img: "/header-teal.png" },
  navy: { color: "#244B5A", img: "/header-navy.png" },
};

// Azul Institucional del manual de marca (RGB 36,75,90 / Pantone 7477 C) — el
// mismo valor que HEADER_VARIANTS.navy, unificado con el resto de generadores.
const DOCX_NAVY = "244B5A";
const DOCX_TEAL = "00829C";
const DOCX_TEXT = "1C2B33";
const DOCX_NAVY_SOFT = "EEF2F6";
const DOCX_BORDER_SOFT = "E1E7EC";
const DOCX_PAGE_WIDTH_MM = 160;

// header-navy.png/header-teal.png son un banner ancho (2745×778) ya recortado
// para ocupar todo el ancho de la hoja, no un ícono cuadrado — ver el
// comentario en el bloque que arma el header más abajo.
const HEADER_ASPECT = 2745 / 778;
const A4_WIDTH_MM = 210;

export interface FotoParaDocx {
  id: string;
  /** El blob ya redimensionado a tamaño de subida (ver lib/documentos/imagenes.ts).
   *  Se vuelve a constreñir acá a un tamaño más chico, apto para Word. */
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

/** Divide un texto libre en renglones cortos por salto de línea y por punto
 *  seguido de mayúscula — mismo criterio que `splitDimensionLines` del
 *  legacy, reusado tanto en pantalla como en el .docx. */
function splitDimensionLines(text: string): string[] {
  return String(text || "")
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚÑ0-9])/))
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function generarDocxCercos(
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
    HorizontalPositionRelativeFrom,
    VerticalPositionRelativeFrom,
    TextWrappingType,
    convertMillimetersToTwip,
  } = docx;

  const DOCX_CONTENT_WIDTH_TWIP = convertMillimetersToTwip(DOCX_PAGE_WIDTH_MM);
  const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

  const medidas = snapshot.medidas as { metrosLineales?: number };
  const ml = Number(medidas.metrosLineales ?? 0);

  const adicionales = snapshot.lineas.filter((l) => l.naturaleza === "cotiza");
  const opcionalesIncluidos = snapshot.lineas.filter(
    (l) => l.naturaleza === "informativa" && l.incluida
  );
  const totales = snapshot.totales;
  const etiquetas =
    snapshot.modoPrecio === "sin"
      ? ["TOTAL"]
      : snapshot.modoPrecio === "con"
        ? ["TOTAL (incluye instalación)"]
        : ["TOTAL SIN INSTALACIÓN", "TOTAL CON INSTALACIÓN"];

  const v = HEADER_VARIANTS[snapshot.variacionEncabezado] || HEADER_VARIANTS.teal;
  const headerBytes = await urlABytes(v.img);

  const imgBytesById: Record<string, { bytes: Uint8Array; width: number; height: number }> = {};
  for (const f of fotosGenerales) {
    imgBytesById[f.id] = await blobABytesConstrained(f.blob);
  }

  // Fotos de referencia fijas (Cercos no modela "cerco perimetral" como
  // opcional de catálogo — es el producto principal — así que no cuelgan de
  // ninguna clave, van siempre). Ver lib/documentos/fotosSeed.ts.
  const seedBytesByUrl: Record<string, Uint8Array> = {};
  for (const f of FOTOS_REFERENCIA_CERCOS) seedBytesByUrl[f.url] = await urlABytes(f.url);

  function docxFotosReferencia(width = 260) {
    return FOTOS_REFERENCIA_CERCOS.map(
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
              outline: { type: "solidFill", solidFillType: "rgb", value: DOCX_BORDER_SOFT, width: 6350 }, // marco fino, mismo borde suave que las tarjetas
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

  function docxPriceLine(
    desc: string,
    price: string,
    { bold = false, big = false, topRule = false } = {}
  ) {
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
                outline: { type: "solidFill", solidFillType: "rgb", value: DOCX_BORDER_SOFT, width: 6350 }, // marco fino, mismo borde suave que las tarjetas
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
          new TextRun({
            text: `Contacto: ${f.contactoNombre} - Cel. ${f.contactoCel}`,
            size: 19,
            color: DOCX_NAVY,
          }),
        ],
      })
    );
    paras.push(docxHyperlinkLine("WhatsApp: ", f.whatsapp, `https://wa.me/549${f.whatsapp.replace(/\D/g, "")}`));
    paras.push(docxHyperlinkLine("E-mail: ", f.email, `mailto:${f.email}`));
    paras.push(docxHyperlinkLine("Web: ", f.web, `https://${f.web}`));
    paras.push(docxHyperlinkLine("Facebook: ", f.facebook, f.facebookUrl));
    paras.push(docxHyperlinkLine("Instagram: ", f.instagram, f.instagramUrl));
    return paras;
  }

  const children = [];

  // Banner de marca a todo el ancho de la HOJA (no de la columna de texto,
  // 25mm más angosta): se ancla "flotante" relativo a la página en (0,0) y
  // con wrap "arriba y abajo" para que el resto del contenido arranque debajo,
  // igual que el membrete real (ver Presupuesto Modelo, header a sangre).
  const headerWidthPx = Math.round((A4_WIDTH_MM / 25.4) * 96);
  const headerHeightPx = Math.round(headerWidthPx / HEADER_ASPECT);
  children.push(
    new Paragraph({
      children: [
        new ImageRun({
          type: "png",
          data: headerBytes,
          transformation: { width: headerWidthPx, height: headerHeightPx },
          floating: {
            horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 },
            verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 },
            wrap: { type: TextWrappingType.TOP_AND_BOTTOM },
          },
          altText: { title: "Logo", description: "Playa y Sol", name: "Logo" },
        }),
      ],
    })
  );
  children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));

  children.push(...docxTitle("Presupuesto de cerco perimetral"));
  children.push(
    docxMetaCard([
      { label: "Fecha:", value: snapshot.fecha },
      { label: "Señor/Sra:", value: snapshot.cliente.nombre },
      { label: "Domicilio:", value: snapshot.cliente.domicilio },
      { label: "Localidad:", value: snapshot.cliente.localidad },
      { label: "Tel:", value: snapshot.cliente.telefono },
      { label: "Email:", value: snapshot.cliente.email },
      { label: "Metros lineales a cercar:", value: `${ml.toLocaleString("es-AR")} ml` },
    ])
  );
  children.push(new Paragraph({ spacing: { after: 220 }, children: [] }));

  children.push(docxSectionTitle("Fotos de referencia"));
  children.push(...docxFotosReferencia());
  children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));

  if (snapshot.detalle && snapshot.detalle.trim()) {
    children.push(docxSectionTitle("Detalle del recorrido"));
    const dimCard = docxDimensionCard(snapshot.detalle);
    if (dimCard) children.push(dimCard);
    children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  }

  if (adicionales.length) {
    children.push(docxSectionTitle("Adicionales"));
    adicionales.forEach((a: LineaPresupuesto) =>
      children.push(docxPriceLine(a.descripcion, formatARS(a.total ?? 0)))
    );
  }

  children.push(new Paragraph({ spacing: { before: 160 }, children: [] }));
  totales.forEach((t, i) => {
    children.push(
      docxPriceLine(etiquetas[i], formatARS(t), { bold: true, big: true, topRule: i === 0 })
    );
  });

  if (opcionalesIncluidos.length) {
    children.push(docxSectionTitle("Opcionales"));
    opcionalesIncluidos.forEach((op: LineaPresupuesto) => {
      const priceTxt = op.precioUnitario === null ? "No incluye" : formatARS(op.precioUnitario);
      children.push(docxOptCard(op.descripcion, priceTxt));
      children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
    });
  }

  children.push(docxValidity(snapshot.validezDias));
  children.push(...docxBodyText(textos.legal, 19));
  children.push(...docxPhotoGallery(fotosGenerales));
  children.push(...docxFooter());

  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri" } } } }, // manual de marca: Calibri para todo el texto de comunicación/lectura
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

/**
 * Los mismos valores hardcodeados que `defaultLegal`/`defaultFooterFields` en
 * `public/cercos-calc.js` — el "seed" que ve un presupuesto nuevo antes de
 * que nadie lo reemplace. `leerTextosCompartidos` (lib/documentos/
 * textosCompartidos.ts) los usa como fallback y los pisa con lo que haya en
 * `catalogo_items` bajo `__legal`/`__footer_*`, si alguien del equipo ya usó
 * "Guardar como predeterminado para todos" — igual que hace
 * `aplicarCatalogoCompartido()` en el legacy. Por eso el documento nuevo dice
 * lo mismo que el legacy, no un default congelado.
 */
export const TEXTO_LEGAL_POR_DEFECTO = `CERCO PERIMETRAL PARA PISCINA:

El cerco perimetral se realiza a medida, de acuerdo a los metros lineales que se necesiten cercar según el contorno de la piscina y el espacio a delimitar.

Características:

1. - Estructura desmontable de caños de aluminio, con parantes anclados al piso.

2. - Cerramiento de lona microperforada, que permite la circulación de aire y visibilidad, reduciendo el riesgo de acceso accidental de niños y mascotas a la piscina.

3. - Sistema desmontable: se puede retirar y volver a colocar según la temporada, sin necesidad de obra civil.

El valor por metro lineal varía según si el cliente realiza la instalación por su cuenta o si la instalación la realiza Playa & Sol.

IMPORTANTE: Las medidas especificadas son libres, no de fabricación. El presupuesto puede variar levemente una vez tomadas las medidas exactas en el lugar.

Los precios están sujetos a modificación según variación en el costo de los materiales.`;

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

export const TEXTOS_POR_DEFECTO_CERCOS: TextosCompartidos = {
  legal: TEXTO_LEGAL_POR_DEFECTO,
  footer: FOOTER_POR_DEFECTO,
};
