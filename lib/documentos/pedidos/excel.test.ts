import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  armarDocumento,
  separarPorProveedor,
  type LineaGuardada,
} from "@/lib/domain/abastecimiento/pedidoDocumento";
import { PARAMETROS_POR_DEFECTO } from "@/lib/domain/abastecimiento/pedido";
import { generarExcelPedido, nombreDeHoja } from "./excel";

// Datos inventados (el repo es público).
const linea = (o: Partial<LineaGuardada>): LineaGuardada => ({
  material_id: "m1", nombre: "Hierro", unidad: "unidad", cantidad: 10, precio: 100, subtotal: 1000,
  proveedor_id: "p1", proveedor: "Corralón Uno", contacto: "Juan", telefono: "+54 9 111 111", ...o,
});

const LINEAS = [
  linea({ material_id: "a", nombre: "Hierro", cantidad: 10, precio: 100, subtotal: 1000 }),
  linea({ material_id: "b", nombre: "Cemento 25 kg", unidad: "bolsa", cantidad: 20, precio: 50, subtotal: 1000 }),
  linea({ material_id: "c", nombre: "Filtro", proveedor_id: "p2", proveedor: "Filtros SA", contacto: null, telefono: null, cantidad: 1, precio: null, subtotal: 0 }),
  linea({ material_id: "d", nombre: "Bomba", proveedor_id: "p2", proveedor: "Filtros SA", contacto: null, telefono: null, cantidad: 1, precio: 300, subtotal: 300 }),
];

const doc = () =>
  armarDocumento(LINEAS, {
    numero: 7, fecha: new Date(2026, 9, 5), obra: "Familia Pérez", solicitante: "Benja",
    parametros: PARAMETROS_POR_DEFECTO, observaciones: "Entregar temprano",
  });

async function leer(blob: Blob) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await blob.arrayBuffer());
  return libro;
}

/** Todos los textos de una hoja, para buscar sin depender de la fila exacta. */
function textos(hoja: ExcelJS.Worksheet): string[] {
  const out: string[] = [];
  hoja.eachRow((fila) => fila.eachCell((c) => out.push(String(c.value ?? ""))));
  return out;
}

/** La fila donde aparece un texto en la primera columna. */
function filaDe(hoja: ExcelJS.Worksheet, texto: string, exacto = false): ExcelJS.Row {
  let encontrada: ExcelJS.Row | null = null;
  hoja.eachRow((fila) => {
    const valor = String(fila.getCell(1).value ?? "");
    if (!encontrada && (exacto ? valor === texto : valor.startsWith(texto))) encontrada = fila;
  });
  if (!encontrada) throw new Error(`no encuentro "${texto}"`);
  return encontrada;
}

describe("nombreDeHoja", () => {
  it("saca los caracteres que Excel no admite y corta en 31", () => {
    expect(nombreDeHoja("AGUAS línea CEMEX (PVC)", new Set())).toBe("AGUAS línea CEMEX (PVC)");
    expect(nombreDeHoja("a/b:c*d?e[f]g\\h", new Set())).toBe("a b c d e f g h");
    expect(nombreDeHoja("x".repeat(50), new Set())).toHaveLength(31);
    expect(nombreDeHoja("   ", new Set())).toBe("Hoja");
  });

  it("si ya existe agrega un número, sin pasarse de 31", () => {
    expect(nombreDeHoja("Vulcano", new Set(["vulcano"]))).toBe("Vulcano (2)");
    expect(nombreDeHoja("Vulcano", new Set(["vulcano", "vulcano (2)"]))).toBe("Vulcano (3)");
    const largo = "y".repeat(40);
    const usados = new Set(["y".repeat(31)]);
    expect(nombreDeHoja(largo, usados).length).toBeLessThanOrEqual(31);
    expect(nombreDeHoja(largo, usados)).toMatch(/\(2\)$/);
  });

  it("no distingue mayúsculas (Excel tampoco)", () => {
    expect(nombreDeHoja("VULCANO", new Set(["vulcano"]))).toBe("VULCANO (2)");
  });
});

describe("generarExcelPedido · todo junto", () => {
  it("arma una hoja Resumen y una por proveedor", async () => {
    const libro = await leer(await generarExcelPedido(doc()));
    expect(libro.worksheets.map((h) => h.name)).toEqual(["Resumen", "Corralón Uno", "Filtros SA"]);
  });

  it("el Resumen lleva el encabezado del pedido, todos los proveedores y el total general", async () => {
    const hoja = (await leer(await generarExcelPedido(doc()))).getWorksheet("Resumen")!;
    const t = textos(hoja);

    expect(t).toContain("PLAYA Y SOL S.A.S.");
    expect(t).toContain("ORDEN DE PEDIDO DE MATERIALES — RESUMEN");
    expect(t).toContain("PED-0007");
    expect(t).toContain("05/10/2026");
    expect(t).toContain("Familia Pérez");
    expect(t).toContain("Benja");
    expect(t).toContain("Pileta 8x4 · Borde: Losetas");
    expect(t.some((x) => x.startsWith("Corralón Uno"))).toBe(true);
    expect(t.some((x) => x.startsWith("Filtros SA"))).toBe(true);

    expect(filaDe(hoja, "TOTAL ESTIMADO").getCell(5).value).toBe(2300);
    expect(t.some((x) => /no incluye 1 artículo con precio a confirmar/.test(x))).toBe(true);
    expect(t.some((x) => x.startsWith("Observaciones: Entregar temprano"))).toBe(true);
  });

  it("las líneas llevan cantidad, unidad, precio y subtotal con formato; lo sin precio dice 'A confirmar'", async () => {
    const hoja = (await leer(await generarExcelPedido(doc()))).getWorksheet("Resumen")!;

    const cemento = filaDe(hoja, "Cemento 25 kg");
    expect(cemento.getCell(2).value).toBe(20);
    expect(cemento.getCell(3).value).toBe("bolsa");
    expect(cemento.getCell(4).value).toBe(50);
    expect(cemento.getCell(5).value).toBe(1000);
    expect(cemento.getCell(5).numFmt).toBe('"$" #,##0.00');

    const filtro = filaDe(hoja, "Filtro", true);
    expect(filtro.getCell(4).value).toBe("A confirmar");
    expect(filtro.getCell(5).value).toBe("—");
  });

  it("cada hoja de proveedor lleva sólo lo suyo y su propio total", async () => {
    const libro = await leer(await generarExcelPedido(doc()));
    const filtros = libro.getWorksheet("Filtros SA")!;
    const t = textos(filtros);

    expect(t).toContain("ORDEN DE PEDIDO DE MATERIALES — Filtros SA");
    expect(t).toContain("Bomba");
    expect(t).not.toContain("Hierro");
    expect(filaDe(filtros, "TOTAL ESTIMADO").getCell(5).value).toBe(300);
    expect(filaDe(libro.getWorksheet("Corralón Uno")!, "TOTAL ESTIMADO").getCell(5).value).toBe(2000);
  });
});

describe("generarExcelPedido · un proveedor", () => {
  it("con un solo proveedor es una única hoja, sin Resumen", async () => {
    const [soloFiltros] = separarPorProveedor(doc()).slice(1);
    const libro = await leer(await generarExcelPedido(soloFiltros));
    expect(libro.worksheets.map((h) => h.name)).toEqual(["Filtros SA"]);
    expect(filaDe(libro.worksheets[0], "TOTAL ESTIMADO").getCell(5).value).toBe(300);
  });

  it("dos proveedores con el mismo nombre no pisan la hoja", async () => {
    const d = armarDocumento(
      [linea({ proveedor_id: "x1", proveedor: "Igual" }), linea({ material_id: "z", proveedor_id: "x2", proveedor: "Igual" })],
      { numero: 1, fecha: new Date(2026, 0, 1), obra: "", solicitante: "", parametros: PARAMETROS_POR_DEFECTO }
    );
    const libro = await leer(await generarExcelPedido(d));
    expect(libro.worksheets.map((h) => h.name)).toEqual(["Resumen", "Igual", "Igual (2)"]);
  });
});

describe("generarExcelPedido · formato", () => {
  it("es un .xlsx real (tipo MIME correcto) y se puede volver a abrir", async () => {
    const blob = await generarExcelPedido(doc());
    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(blob.size).toBeGreaterThan(1000);
  });

  it("sin logo el encabezado lleva el nombre de la empresa; con logo se incrusta la imagen", async () => {
    const sinLogo = (await leer(await generarExcelPedido(doc()))).getWorksheet("Resumen")!;
    expect(sinLogo.getImages()).toHaveLength(0);

    // Un PNG mínimo válido (1×1).
    const png = Uint8Array.from(
      atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
      (c) => c.charCodeAt(0)
    ).buffer;
    const conLogo = (await leer(await generarExcelPedido(doc(), { logo: png }))).getWorksheet("Resumen")!;
    expect(conLogo.getImages()).toHaveLength(1);
  });

  it("deja la primera fila de la tabla fija y la hoja lista para imprimir en A4 a lo ancho", async () => {
    const hoja = (await leer(await generarExcelPedido(doc()))).getWorksheet("Corralón Uno")!;
    expect(hoja.views[0]).toMatchObject({ state: "frozen", showGridLines: false });
    expect(hoja.pageSetup).toMatchObject({ paperSize: 9, fitToPage: true, fitToWidth: 1 });
  });

  it("un pedido sin precios no rompe y el total es 0", async () => {
    const d = armarDocumento([linea({ precio: null, subtotal: 0 })], {
      numero: null, fecha: new Date(2026, 0, 1), obra: "", solicitante: "", parametros: PARAMETROS_POR_DEFECTO,
    });
    const hoja = (await leer(await generarExcelPedido(d))).worksheets[0];
    expect(filaDe(hoja, "TOTAL ESTIMADO").getCell(5).value).toBe(0);
    expect(textos(hoja)).toContain("BORRADOR");
  });
});

describe("generarExcelPedido · sin precios (para pedirle al proveedor)", () => {
  it("no lleva precios, subtotales ni total, y los artículos y cantidades siguen", async () => {
    const libro = await leer(await generarExcelPedido(doc(), { conPrecios: false }));
    for (const hoja of libro.worksheets) {
      const t = textos(hoja).join("|");
      expect(t).not.toMatch(/Precio unit|Subtotal|TOTAL ESTIMADO|A confirmar|Precios tentativos/);
      expect(hoja.getRow(1).values).toBeTruthy();
    }
    const resumen = libro.getWorksheet("Resumen")!;
    expect(textos(resumen)).toEqual(expect.arrayContaining(["Hierro", "Cemento 25 kg", "Filtro", "Bomba", "Cantidad", "Unidad"]));
    // Sólo 3 columnas con datos: artículo, cantidad, unidad.
    resumen.eachRow((fila) => expect(fila.getCell(4).value ?? null).toBeNull());
  });

  it("las observaciones se conservan", async () => {
    const libro = await leer(await generarExcelPedido(doc(), { conPrecios: false }));
    expect(textos(libro.getWorksheet("Resumen")!).some((t) => t.includes("Entregar temprano"))).toBe(true);
  });

  it("con precios (por defecto) avisa que son tentativos y de uso interno", async () => {
    const libro = await leer(await generarExcelPedido(doc()));
    expect(textos(libro.getWorksheet("Resumen")!).some((t) => /tentativos.*uso interno/.test(t))).toBe(true);
    expect(textos(libro.getWorksheet("Resumen")!)).toContain("TOTAL ESTIMADO");
  });
});
