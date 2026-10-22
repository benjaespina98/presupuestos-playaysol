import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { PARAMETROS_POR_DEFECTO, armarPedido, csvPedido, mensajeDeGrupo, mensajeWhatsApp } from "@/lib/domain/abastecimiento/pedido";
import { armarDocumento, mensajeProveedor, separarPorProveedor, type LineaGuardada } from "@/lib/domain/abastecimiento/pedidoDocumento";
import { textoDePdf } from "../helpers/pdfTexto";
import { exportarPedido } from "@/lib/documentos/pedidos/exportar";

/**
 * Lo que SALE de la app en un pedido (zip, archivo por proveedor, PDF, Excel, CSV, mensaje, copiar) nunca puede
 * llevar precios, totales, teléfonos ni notas internas. Los presupuestos al cliente NO entran en esta regla.
 * Datos inventados (el repo es público).
 */
const NOTA_INTERNA = "NOTA-INTERNA-no-mostrar-margen-30";
const TEL_PROVEEDOR = "+54 9 353 411-2233";
const TEL_CLIENTE = "3534 55 66 77";

const linea = (o: Partial<LineaGuardada>): LineaGuardada => ({
  material_id: "m1", nombre: "Hierro del 6", unidad: "unidad", cantidad: 10, precio: 12345.67, subtotal: 123456.7,
  proveedor_id: "p1", proveedor: "Corralón Uno", contacto: "Juan Contacto", telefono: TEL_PROVEEDOR, ...o,
});

const DOC = armarDocumento(
  [
    linea({}),
    linea({ material_id: "m2", nombre: "Cemento 25 kg", unidad: "bolsa", cantidad: 20, precio: 9876.5, subtotal: 197530 }),
    linea({ material_id: "m3", nombre: "Filtro", proveedor_id: "p2", proveedor: "Filtros SA", contacto: "Ana", telefono: "011 4444-5555", precio: null, subtotal: 0 }),
  ],
  {
    numero: 7,
    fecha: new Date(2026, 9, 5),
    obra: `Familia Pérez ${TEL_CLIENTE}`,
    solicitante: "Benja 3534 123456",
    parametros: PARAMETROS_POR_DEFECTO,
    observaciones: NOTA_INTERNA,
  }
);

async function textoDeXlsx(bytes: ArrayBuffer): Promise<string> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(bytes);
  const out: string[] = [];
  libro.eachSheet((h) => {
    out.push(h.name);
    h.eachRow((f) => f.eachCell((c) => out.push(String(c.value ?? ""))));
  });
  return out.join("\n");
}

/** Reglas: nada con "$", ni formato de precio, ni teléfonos, ni notas internas, ni los datos ocultos. */
function verificar(texto: string, etiqueta: string) {
  const falla = (que: string) => `${etiqueta}: ${que}`;
  expect(texto.trim().length, falla("quedó vacío: la extracción no sirve")).toBeGreaterThan(20);
  expect(texto, falla("tiene un monto con $")).not.toMatch(/\$/);
  expect(texto, falla("tiene formato de precio")).not.toMatch(/\d{1,3}(\.\d{3})+,\d{2}|\d+,\d{2}(?!\d)|\d+\.\d{2}(?!\d)/);
  expect(texto, falla("tiene un precio cargado")).not.toMatch(/12345|12\.345|9876|123456|197530|197\.530/);
  expect(texto, falla("tiene un teléfono (+54, 353, 011/11 o 8+ dígitos)")).not.toMatch(
    /\+54|(?<!\d)353\d|(?<!\d)011(?!\d)|(?<!\d)11[ -]?\d{4}|\+?\d(?:[ ().-]?\d){7,}/
  );
  expect(texto, falla("tiene una nota interna")).not.toContain(NOTA_INTERNA);
  expect(texto, falla("tiene el contacto del proveedor")).not.toMatch(/Juan Contacto|\bAna\b/);
  expect(texto, falla("dice precio/subtotal/total")).not.toMatch(/Precio unit|Subtotal|TOTAL ESTIMADO|A confirmar|Costo estimado|tentativos/i);
}

describe("Pedidos · lo que sale de la app no lleva precios, teléfonos ni notas internas", () => {
  for (const formato of ["pdf", "xlsx"] as const) {
    it(`${formato.toUpperCase()} todo junto`, async () => {
      const r = await exportarPedido(DOC, formato, "junto", { logo: async () => undefined });
      const bytes = await r.blob.arrayBuffer();
      verificar(formato === "pdf" ? textoDePdf(new Uint8Array(bytes)) : await textoDeXlsx(bytes), `${formato} junto`);
      expect(r.nombre).not.toMatch(/\d{7}/);
    });

    it(`${formato.toUpperCase()}: el ZIP y cada archivo por proveedor`, async () => {
      const r = await exportarPedido(DOC, formato, "por-proveedor", { logo: async () => undefined });
      const zip = await JSZip.loadAsync(await r.blob.arrayBuffer());
      const nombres = Object.keys(zip.files);
      expect(nombres).toHaveLength(2);
      for (const nombre of nombres) {
        const bytes = await zip.files[nombre].async("arraybuffer");
        const texto = formato === "pdf" ? textoDePdf(new Uint8Array(bytes)) : await textoDeXlsx(bytes);
        verificar(texto, nombre);
        // Un archivo individual no trae datos de los otros proveedores.
        const esCorralon = nombre.includes("Corralon");
        expect(texto, `${nombre} trae a otro proveedor`).not.toContain(esCorralon ? "Filtros SA" : "Corralón Uno");
        expect(texto, `${nombre} trae artículos de otro proveedor`).not.toContain(esCorralon ? "Filtro" : "Hierro");
      }
    });

    it(`${formato.toUpperCase()} de un solo proveedor (el de Compartir y Descargar)`, async () => {
      const [uno] = separarPorProveedor(DOC);
      const r = await exportarPedido(uno, formato, "por-proveedor", { logo: async () => undefined });
      const bytes = await r.blob.arrayBuffer();
      verificar(formato === "pdf" ? textoDePdf(new Uint8Array(bytes)) : await textoDeXlsx(bytes), r.nombre);
    });
  }

  it("el texto de copiar y compartir de cada proveedor", () => {
    for (const s of DOC.proveedores) verificar(mensajeProveedor(DOC, s), `mensaje ${s.nombre}`);
  });

  it("el CSV, el mensaje de WhatsApp y el mensaje por grupo", () => {
    const pedido = armarPedido(
      [{ id: "a", nombre: "Hierro del 6", unidad: "unidad", precio: 12345.67, usd_ref: null, proveedor_id: "p1", activo: true, cantidades: { "8x4": 10 } } as never],
      [{ id: "p1", nombre: "Corralón Uno", contacto: "Juan Contacto", telefono: TEL_PROVEEDOR, activo: true, orden: 1 } as never],
      PARAMETROS_POR_DEFECTO
    );
    verificar(csvPedido(pedido), "csv");
    verificar(mensajeWhatsApp(pedido, PARAMETROS_POR_DEFECTO, { obra: `Pérez ${TEL_CLIENTE}`, pide: "Benja 3534 123456" }), "whatsapp");
    for (const g of pedido.grupos) verificar(mensajeDeGrupo(g), "mensaje de grupo");
  });
});
