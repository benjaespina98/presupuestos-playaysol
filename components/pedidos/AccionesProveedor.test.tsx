// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { armarDocumento, type LineaGuardada } from "@/lib/domain/abastecimiento/pedidoDocumento";
import { PARAMETROS_POR_DEFECTO } from "@/lib/domain/abastecimiento/pedido";
import { problemasDeSalida } from "../../tests/helpers/salidasPedido";
import { AccionesProveedor } from "./AccionesProveedor";

const mocks = vi.hoisted(() => ({
  exportarPedido: vi.fn(),
  copiarAlPortapapeles: vi.fn(),
  compartirArchivoYTexto: vi.fn(),
  descargarArchivo: vi.fn(),
  esDispositivoMovil: vi.fn(),
}));
vi.mock("@/lib/documentos/pedidos/exportar", () => ({ exportarPedido: mocks.exportarPedido }));
vi.mock("@/lib/clipboard", () => ({ copiarAlPortapapeles: mocks.copiarAlPortapapeles }));
vi.mock("@/lib/documentos/compartir", () => ({
  compartirArchivoYTexto: mocks.compartirArchivoYTexto,
  descargarArchivo: mocks.descargarArchivo,
  esDispositivoMovil: mocks.esDispositivoMovil,
}));

const linea = (o: Partial<LineaGuardada>): LineaGuardada => ({
  material_id: "m1", nombre: "Hierro del 6", unidad: "unidad", cantidad: 10, precio: 12345.67, subtotal: 123456.7,
  proveedor_id: "p1", proveedor: "Corralón Uno", contacto: "Juan Contacto", telefono: "+54 9 353 411-2233", ...o,
});
const doc = armarDocumento([linea({}), linea({ material_id: "m2", nombre: "Cemento", unidad: "bolsa", cantidad: 20, precio: 9876.5, subtotal: 197530 })], {
  numero: 7, fecha: new Date(2026, 9, 5), obra: "Familia Pérez 3534 55 66 77", solicitante: "Benja", parametros: PARAMETROS_POR_DEFECTO, observaciones: "NOTA-INTERNA",
});
const archivo = { blob: new Blob(["%PDF-"]), nombre: "Pedido_PED-0007_Corralon_Uno.pdf", mime: "application/pdf" };

describe("AccionesProveedor", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset());
    mocks.exportarPedido.mockResolvedValue(archivo);
    mocks.copiarAlPortapapeles.mockResolvedValue(true);
    mocks.esDispositivoMovil.mockReturnValue(false);
  });

  it("en escritorio ofrece Descargar y Copiar mensaje, no Compartir", () => {
    render(<AccionesProveedor doc={doc} seccion={doc.proveedores[0]} onMensaje={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Descargar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar mensaje" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Compartir/ })).not.toBeInTheDocument();
  });

  it("Copiar mensaje copia el texto del proveedor sin precios, teléfonos ni notas", async () => {
    const user = userEvent.setup();
    render(<AccionesProveedor doc={doc} seccion={doc.proveedores[0]} onMensaje={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Copiar mensaje" }));
    const texto = mocks.copiarAlPortapapeles.mock.calls[0][0] as string;
    expect(problemasDeSalida(texto)).toEqual([]);
    expect(texto).toContain("Corralón Uno");
    expect(texto).toContain("- Hierro del 6: 10");
    expect(texto).toContain("- Cemento: 20 bolsa");
    expect(await screen.findByText("¡Copiado!")).toBeInTheDocument();
  });

  it("Descargar genera el PDF de ese proveedor solo y lo baja", async () => {
    const user = userEvent.setup();
    const onMensaje = vi.fn();
    render(<AccionesProveedor doc={doc} seccion={doc.proveedores[0]} onMensaje={onMensaje} />);
    await user.click(screen.getByRole("button", { name: "Descargar" }));
    await waitFor(() => expect(mocks.descargarArchivo).toHaveBeenCalledWith(archivo.blob, archivo.nombre));
    const [enviado, formato, modo] = mocks.exportarPedido.mock.calls[0];
    expect(formato).toBe("pdf");
    expect(modo).toBe("por-proveedor");
    expect(enviado.proveedores).toHaveLength(1);
    expect(onMensaje).toHaveBeenCalledWith("ok", expect.stringContaining(archivo.nombre));
  });

  it("en el celular ofrece Compartir (con el PDF ya preparado) y comparte archivo y texto", async () => {
    mocks.esDispositivoMovil.mockReturnValue(true);
    mocks.compartirArchivoYTexto.mockResolvedValue("compartido");
    const user = userEvent.setup();
    const onMensaje = vi.fn();
    render(<AccionesProveedor doc={doc} seccion={doc.proveedores[0]} onMensaje={onMensaje} />);
    const boton = await screen.findByRole("button", { name: "Compartir" });
    await waitFor(() => expect(boton).toBeEnabled());
    await user.click(boton);
    const [blob, nombre, mime, texto] = mocks.compartirArchivoYTexto.mock.calls[0];
    expect(blob).toBe(archivo.blob);
    expect(nombre).toBe(archivo.nombre);
    expect(mime).toBe("application/pdf");
    expect(problemasDeSalida(texto)).toEqual([]);
    expect(onMensaje).toHaveBeenCalledWith("ok", expect.stringContaining("compartido"));
  });

  it("si sólo se pudo compartir el texto, lo dice", async () => {
    mocks.esDispositivoMovil.mockReturnValue(true);
    mocks.compartirArchivoYTexto.mockResolvedValue("texto");
    const user = userEvent.setup();
    const onMensaje = vi.fn();
    render(<AccionesProveedor doc={doc} seccion={doc.proveedores[0]} onMensaje={onMensaje} />);
    const boton = await screen.findByRole("button", { name: "Compartir" });
    await waitFor(() => expect(boton).toBeEnabled());
    await user.click(boton);
    expect(onMensaje).toHaveBeenCalledWith("ok", expect.stringContaining("compartió el texto"));
  });
});
