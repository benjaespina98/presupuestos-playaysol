import type { Worksheet } from "exceljs";
import { EMPRESA } from "@/lib/brand";
import type { DocumentoPedido, SeccionProveedor } from "@/lib/domain/abastecimiento/pedidoDocumento";

/**
 * El pedido en Excel (.xlsx): un libro con una hoja por proveedor y, cuando el
 * pedido es de más de uno ("todo junto"), una hoja "Resumen" con todo.
 *
 * `exceljs` se importa de forma perezosa (mismo criterio que `docx` y
 * `@react-pdf/renderer`): no infla el bundle de nadie que no toque "Excel".
 */

const NAVY = "FF244B5A";
const TEAL = "FF00829C";
const GRIS = "FFEEF2F6";
const FORMATO_PESOS = '"$" #,##0.00';
const FORMATO_CANTIDAD = "#,##0.##";

const COLUMNAS = [
  { header: "Artículo", width: 46 },
  { header: "Cantidad", width: 12 },
  { header: "Unidad", width: 12 },
  { header: "Precio unit.", width: 16 },
  { header: "Subtotal", width: 18 },
] as const;

/** Un nombre de hoja válido: Excel no admite `[]:*?/\` y corta en 31 caracteres. */
export function nombreDeHoja(nombre: string, usados: ReadonlySet<string>): string {
  const base = (nombre.replace(/[\[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim() || "Hoja").slice(0, 31);
  if (!usados.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) {
    const sufijo = ` (${i})`;
    const candidato = base.slice(0, 31 - sufijo.length) + sufijo;
    if (!usados.has(candidato.toLowerCase())) return candidato;
  }
}

interface Contexto {
  doc: DocumentoPedido;
  libro: import("exceljs").Workbook;
  logoId: number | null;
}

/** El encabezado de cada hoja: logo, datos de la empresa, título y datos del pedido. Devuelve la fila siguiente. */
function encabezado(hoja: Worksheet, ctx: Contexto, titulo: string): number {
  const { doc } = ctx;
  hoja.views = [{ showGridLines: false }];

  if (ctx.logoId !== null) {
    // 931×121 → mismo aspecto: 260×34 px.
    hoja.addImage(ctx.logoId, { tl: { col: 0, row: 0 }, ext: { width: 260, height: 34 } });
  } else {
    hoja.getCell("A1").value = EMPRESA.nombre;
    hoja.getCell("A1").font = { bold: true, size: 16, color: { argb: NAVY } };
  }
  hoja.getRow(1).height = 30;

  const datos = [
    EMPRESA.nombre,
    `${EMPRESA.direccion} · Tel. ${EMPRESA.telefono}`,
    `${EMPRESA.email} · ${EMPRESA.web}`,
  ];
  datos.forEach((texto, i) => {
    const c = hoja.getCell(2 + i, 1);
    c.value = texto;
    c.font = { size: i === 0 ? 10 : 9, bold: i === 0, color: { argb: "FF555555" } };
  });

  hoja.mergeCells(6, 1, 6, 5);
  const t = hoja.getCell(6, 1);
  t.value = titulo;
  t.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  t.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  hoja.getRow(6).height = 24;

  const filas: [string, string][] = [
    ["Pedido N°", doc.numero],
    ["Fecha", doc.fecha],
    ["Obra / cliente", doc.obra || "—"],
    ["Pide", doc.solicitante || "—"],
    ["Condiciones", doc.condiciones.join(" · ")],
  ];
  let fila = 8;
  for (const [etiqueta, valor] of filas) {
    const a = hoja.getCell(fila, 1);
    a.value = etiqueta;
    a.font = { bold: true, color: { argb: NAVY } };
    hoja.mergeCells(fila, 2, fila, 5);
    const b = hoja.getCell(fila, 2);
    b.value = valor;
    b.alignment = { horizontal: "left" };
    fila++;
  }
  return fila + 1;
}

function encabezadoTabla(hoja: Worksheet, fila: number) {
  COLUMNAS.forEach((col, i) => {
    const c = hoja.getCell(fila, i + 1);
    c.value = col.header;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    c.alignment = { horizontal: i === 0 ? "left" : i === 2 ? "center" : "right", vertical: "middle" };
  });
  hoja.getRow(fila).height = 20;
}

/** Las líneas de un proveedor. Devuelve la fila siguiente a su subtotal. */
function bloqueProveedor(hoja: Worksheet, s: SeccionProveedor, fila: number, conTitulo: boolean): number {
  if (conTitulo) {
    hoja.mergeCells(fila, 1, fila, 5);
    const c = hoja.getCell(fila, 1);
    c.value = [s.nombre, s.contacto, s.telefono].filter(Boolean).join("  ·  ");
    c.font = { bold: true, color: { argb: NAVY } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS } };
    fila++;
  }

  for (const l of s.lineas) {
    hoja.getCell(fila, 1).value = l.descripcion;
    const cant = hoja.getCell(fila, 2);
    cant.value = l.cantidad;
    cant.numFmt = FORMATO_CANTIDAD;
    hoja.getCell(fila, 3).value = l.unidad;
    hoja.getCell(fila, 3).alignment = { horizontal: "center" };
    const precio = hoja.getCell(fila, 4);
    const sub = hoja.getCell(fila, 5);
    if (l.precio === null) {
      precio.value = "A confirmar";
      precio.alignment = { horizontal: "right" };
      precio.font = { italic: true, color: { argb: "FFB45309" } };
      sub.value = "—";
      sub.alignment = { horizontal: "right" };
    } else {
      precio.value = l.precio;
      precio.numFmt = FORMATO_PESOS;
      sub.value = l.subtotal;
      sub.numFmt = FORMATO_PESOS;
    }
    for (let c = 1; c <= 5; c++) hoja.getCell(fila, c).border = { bottom: { style: "hair", color: { argb: "FFBBBBBB" } } };
    fila++;
  }

  hoja.mergeCells(fila, 1, fila, 4);
  const et = hoja.getCell(fila, 1);
  et.value = conTitulo ? `Subtotal ${s.nombre}` : "Subtotal";
  et.font = { bold: true };
  et.alignment = { horizontal: "right" };
  const st = hoja.getCell(fila, 5);
  st.value = s.subtotal;
  st.numFmt = FORMATO_PESOS;
  st.font = { bold: true };
  return fila + 2;
}

function pie(hoja: Worksheet, doc: DocumentoPedido, fila: number) {
  hoja.mergeCells(fila, 1, fila, 4);
  const et = hoja.getCell(fila, 1);
  et.value = "TOTAL ESTIMADO";
  et.font = { bold: true, size: 12, color: { argb: NAVY } };
  et.alignment = { horizontal: "right" };
  const tot = hoja.getCell(fila, 5);
  tot.value = doc.total;
  tot.numFmt = FORMATO_PESOS;
  tot.font = { bold: true, size: 12, color: { argb: NAVY } };
  tot.border = { top: { style: "medium", color: { argb: NAVY } } };
  fila++;

  if (doc.sinPrecio > 0) {
    hoja.mergeCells(fila, 1, fila, 5);
    const n = hoja.getCell(fila, 1);
    n.value = `El total no incluye ${doc.sinPrecio} ${doc.sinPrecio === 1 ? "artículo" : "artículos"} con precio a confirmar con el proveedor.`;
    n.font = { italic: true, size: 9, color: { argb: "FFB45309" } };
    fila++;
  }

  if (doc.observaciones) {
    fila++;
    hoja.mergeCells(fila, 1, fila, 5);
    const o = hoja.getCell(fila, 1);
    o.value = `Observaciones: ${doc.observaciones}`;
    o.alignment = { wrapText: true, vertical: "top" };
    hoja.getRow(fila).height = 32;
  }
}

function configurarHoja(hoja: Worksheet) {
  hoja.columns = COLUMNAS.map((c) => ({ width: c.width }));
  hoja.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } };
  hoja.headerFooter = { oddFooter: `&L${EMPRESA.nombre}&CPágina &P de &N&R&D` };
}

/**
 * Genera el libro. Con un solo proveedor es una hoja; con varios, una hoja
 * "Resumen" (todo junto) y una por proveedor.
 *
 * `logo` son los bytes del PNG del logo (se baja en el navegador y se pasa acá:
 * este módulo no hace red). Sin logo, el encabezado lleva el nombre de la empresa.
 */
export async function generarExcelPedido(doc: DocumentoPedido, opciones: { logo?: ArrayBuffer } = {}): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const libro = new ExcelJS.Workbook();
  libro.creator = EMPRESA.nombre;
  libro.created = new Date();

  const logoId = opciones.logo ? libro.addImage({ buffer: opciones.logo, extension: "png" }) : null;
  const ctx: Contexto = { doc, libro, logoId };
  const usados = new Set<string>();
  const titulo = (s: string) => `ORDEN DE PEDIDO DE MATERIALES${s ? ` — ${s}` : ""}`;

  if (doc.proveedores.length > 1) {
    const resumen = libro.addWorksheet(nombreDeHoja("Resumen", usados));
    usados.add("resumen");
    configurarHoja(resumen);
    let fila = encabezado(resumen, ctx, titulo("RESUMEN"));
    encabezadoTabla(resumen, fila);
    resumen.views = [{ showGridLines: false, state: "frozen", ySplit: fila }];
    fila++;
    for (const s of doc.proveedores) fila = bloqueProveedor(resumen, s, fila, true);
    pie(resumen, doc, fila);
  }

  for (const s of doc.proveedores) {
    const nombre = nombreDeHoja(s.nombre, usados);
    usados.add(nombre.toLowerCase());
    const hoja = libro.addWorksheet(nombre);
    configurarHoja(hoja);
    let fila = encabezado(hoja, ctx, titulo(s.nombre));
    encabezadoTabla(hoja, fila);
    hoja.views = [{ showGridLines: false, state: "frozen", ySplit: fila }];
    fila++;
    fila = bloqueProveedor(hoja, s, fila, false);
    // Una hoja de un solo proveedor lleva su total; en el libro "todo junto" el total general va en el Resumen.
    pie(hoja, { ...doc, total: s.subtotal, sinPrecio: s.sinPrecio }, fila);
  }

  const buffer = await libro.xlsx.writeBuffer();
  return new Blob([buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
