import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";
import {
  armarDocumento,
  type LineaGuardada,
} from "@/lib/domain/abastecimiento/pedidoDocumento";
import { PARAMETROS_POR_DEFECTO } from "@/lib/domain/abastecimiento/pedido";
import { exportarPedido, nombresUnicos } from "./exportar";

// Datos inventados (el repo es público).
const linea = (o: Partial<LineaGuardada>): LineaGuardada => ({
  material_id: "m1", nombre: "Hierro", unidad: "unidad", cantidad: 10, precio: 100, subtotal: 1000,
  proveedor_id: "p1", proveedor: "Corralón Uno", contacto: "Juan", telefono: "+54 9 111 111", ...o,
});

const datos = { numero: 7, fecha: new Date(2026, 9, 5), obra: "Familia Pérez", solicitante: "Benja", parametros: PARAMETROS_POR_DEFECTO };

const VARIOS = armarDocumento(
  [
    linea({ material_id: "a", nombre: "Hierro" }),
    linea({ material_id: "b", nombre: "Filtro", proveedor_id: "p2", proveedor: "Filtros SA", contacto: null, telefono: null }),
    linea({ material_id: "c", nombre: "Pintura", proveedor_id: "p3", proveedor: "Áridos y excavación" }),
  ],
  datos
);
const UNO = armarDocumento([linea({})], datos);

const sinLogo = { logo: async () => undefined };
const firma = async (blob: Blob, n = 5) => String.fromCharCode(...new Uint8Array(await blob.slice(0, n).arrayBuffer()));

describe("nombresUnicos", () => {
  it("deja igual lo que no se repite y numera lo repetido, sin pisar la extensión", () => {
    expect(nombresUnicos(["a.pdf", "b.pdf", "a.pdf", "A.pdf", "sin_extension", "sin_extension"])).toEqual([
      "a.pdf", "b.pdf", "a_2.pdf", "A_3.pdf", "sin_extension", "sin_extension_2",
    ]);
  });
});

describe("exportarPedido · todo junto", () => {
  it("PDF: un solo archivo, con el número y la obra en el nombre", async () => {
    const r = await exportarPedido(VARIOS, "pdf", "junto");
    expect(r).toMatchObject({ nombre: "Pedido_PED-0007_Familia_Perez.pdf", mime: "application/pdf" });
    expect(await firma(r.blob)).toBe("%PDF-");
  });

  it("Excel: un solo libro con Resumen y una hoja por proveedor", async () => {
    const r = await exportarPedido(VARIOS, "xlsx", "junto", sinLogo);
    expect(r.nombre).toBe("Pedido_PED-0007_Familia_Perez.xlsx");
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(await r.blob.arrayBuffer());
    expect(libro.worksheets.map((h) => h.name)).toEqual(["Resumen", "Corralón Uno", "Filtros SA", "Áridos y excavación"]);
  });

  it("baja el logo sólo para el Excel (el PDF lo resuelve por su cuenta)", async () => {
    const logo = vi.fn(async () => undefined);
    await exportarPedido(UNO, "pdf", "junto", { logo });
    expect(logo).not.toHaveBeenCalled();
    await exportarPedido(UNO, "xlsx", "junto", { logo });
    expect(logo).toHaveBeenCalledTimes(1);
  });
});

describe("exportarPedido · por proveedor", () => {
  it("PDF: un ZIP con un PDF por proveedor, nombrados con el proveedor", async () => {
    const r = await exportarPedido(VARIOS, "pdf", "por-proveedor");
    expect(r.mime).toBe("application/zip");
    expect(r.nombre).toBe("Pedido_PED-0007_Familia_Perez_por_proveedor_pdf.zip");

    const zip = await JSZip.loadAsync(await r.blob.arrayBuffer());
    expect(Object.keys(zip.files).sort()).toEqual([
      "Pedido_PED-0007_Aridos_y_excavacion.pdf",
      "Pedido_PED-0007_Corralon_Uno.pdf",
      "Pedido_PED-0007_Filtros_SA.pdf",
    ]);
    const pdf = await zip.file("Pedido_PED-0007_Corralon_Uno.pdf")!.async("uint8array");
    expect(String.fromCharCode(...pdf.slice(0, 5))).toBe("%PDF-");
  });

  it("Excel: un ZIP con un libro por proveedor, cada uno con sólo lo suyo", async () => {
    const r = await exportarPedido(VARIOS, "xlsx", "por-proveedor", sinLogo);
    const zip = await JSZip.loadAsync(await r.blob.arrayBuffer());
    expect(Object.keys(zip.files)).toHaveLength(3);

    const bytes = await zip.file("Pedido_PED-0007_Filtros_SA.xlsx")!.async("arraybuffer");
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(bytes);
    expect(libro.worksheets.map((h) => h.name)).toEqual(["Filtros SA"]);
  });

  it("con un solo proveedor no hace falta ZIP: es ese archivo", async () => {
    const r = await exportarPedido(UNO, "pdf", "por-proveedor");
    expect(r.mime).toBe("application/pdf");
    expect(r.nombre).toBe("Pedido_PED-0007_Corralon_Uno.pdf");
    expect(await firma(r.blob)).toBe("%PDF-");
  });

  it("dos proveedores con el mismo nombre no se pisan dentro del ZIP", async () => {
    const dos = armarDocumento(
      [linea({ proveedor_id: "x1", proveedor: "Igual" }), linea({ material_id: "z", proveedor_id: "x2", proveedor: "Igual" })],
      datos
    );
    const r = await exportarPedido(dos, "xlsx", "por-proveedor", sinLogo);
    const zip = await JSZip.loadAsync(await r.blob.arrayBuffer());
    expect(Object.keys(zip.files).sort()).toEqual(["Pedido_PED-0007_Igual.xlsx", "Pedido_PED-0007_Igual_2.xlsx"]);
  });

  it("el ZIP empieza con la firma de ZIP", async () => {
    const r = await exportarPedido(VARIOS, "xlsx", "por-proveedor", sinLogo);
    expect(await firma(r.blob, 2)).toBe("PK");
  });
});

describe("exportarPedido · con y sin precios", () => {
  const celdas = async (blob: Blob) => {
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(await blob.arrayBuffer());
    const out: string[] = [];
    libro.eachSheet((h) => h.eachRow((f) => f.eachCell((c) => out.push(String(c.value ?? "")))));
    return out.join("|");
  };

  it("sin precios el Excel no los lleva; con precios, sí", async () => {
    const sin = await exportarPedido(UNO, "xlsx", "junto", { ...sinLogo, conPrecios: false });
    const con = await exportarPedido(UNO, "xlsx", "junto", { ...sinLogo, conPrecios: true });
    expect(await celdas(sin.blob)).not.toMatch(/Precio unit|TOTAL/);
    expect(await celdas(con.blob)).toMatch(/Precio unit/);
  });

  it("el ZIP por proveedor también respeta 'sin precios'", async () => {
    const r = await exportarPedido(VARIOS, "xlsx", "por-proveedor", { ...sinLogo, conPrecios: false });
    const zip = await JSZip.loadAsync(await r.blob.arrayBuffer());
    for (const nombre of Object.keys(zip.files)) {
      expect(await celdas(new Blob([await zip.files[nombre].async("arraybuffer")]))).not.toMatch(/Precio unit|Subtotal/);
    }
  });
});
