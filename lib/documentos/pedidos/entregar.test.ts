// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { entregarPedido } from "./entregar";
import { armarDocumento } from "@/lib/domain/abastecimiento/pedidoDocumento";

vi.mock("./exportar", async (orig) => {
  const real = await orig<typeof import("./exportar")>();
  return {
    ...real,
    exportarPedido: vi.fn(async () => ({ blob: new Blob(["zip"]), nombre: "pedido.zip", mime: "application/zip" })),
    exportarPedidoArchivos: vi.fn(async () => [
      { blob: new Blob(["a"]), nombre: "A.pdf", mime: "application/pdf" },
      { blob: new Blob(["b"]), nombre: "B.pdf", mime: "application/pdf" },
    ]),
  };
});

const doc = armarDocumento([], { numero: 1, fecha: new Date("2026-10-22"), obra: "Obra", solicitante: "", parametros: { tamano: "8x4", obras: 1, borde: "Losetas", luces: 0, luzCamaAgua: false, banoQuimico: false }, observaciones: "" });

afterEach(() => vi.restoreAllMocks());

describe("entregarPedido · uno por proveedor", () => {
  it("en el celular comparte los archivos SUELTOS en una sola hoja de compartir (nada de ZIP)", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    const texto = await entregarPedido(doc, "pdf", "por-proveedor", true);
    expect(share).toHaveBeenCalledTimes(1);
    const archivos = share.mock.calls[0][0].files as File[];
    expect(archivos.map((f) => f.name)).toEqual(["A.pdf", "B.pdf"]);
    expect(archivos.some((f) => f.name.endsWith(".zip"))).toBe(false);
    expect(texto).toMatch(/2 archivos/);
  });

  it("en la compu sigue siendo el ZIP de siempre", async () => {
    const share = vi.fn();
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    const clic = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    const nombre = await entregarPedido(doc, "pdf", "por-proveedor", false);
    expect(nombre).toBe("pedido.zip");
    expect(share).not.toHaveBeenCalled();
    expect(clic).toHaveBeenCalled();
  });
});
