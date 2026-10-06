// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PARAMETROS_POR_DEFECTO } from "@/lib/domain/abastecimiento/pedido";
import type { LineaGuardada, PedidoGuardado } from "@/lib/domain/abastecimiento/pedidoDocumento";
import PedidosPage from "./page";

const mocks = vi.hoisted(() => ({
  listarPedidos: vi.fn(),
  cambiarEstadoPedido: vi.fn(),
  eliminarPedido: vi.fn(),
  exportarPedido: vi.fn(),
  compartirOdescargarArchivo: vi.fn(),
}));
vi.mock("@/lib/pedidos", () => ({
  listarPedidos: mocks.listarPedidos,
  cambiarEstadoPedido: mocks.cambiarEstadoPedido,
  eliminarPedido: mocks.eliminarPedido,
}));
vi.mock("@/lib/documentos/pedidos/exportar", () => ({ exportarPedido: mocks.exportarPedido }));
vi.mock("@/lib/documentos/compartir", () => ({ compartirOdescargarArchivo: mocks.compartirOdescargarArchivo }));

// Datos inventados (el repo es público).
const linea = (o: Partial<LineaGuardada>): LineaGuardada => ({
  material_id: "m1", nombre: "Hierro", unidad: "unidad", cantidad: 10, precio: 100, subtotal: 1000,
  proveedor_id: "p1", proveedor: "Corralón Uno", contacto: "Juan", telefono: "+54 9 111 111", ...o,
});

const pedido = (o: Partial<PedidoGuardado>): PedidoGuardado => ({
  id: "x", numero: 1, obra: "", solicitante: "", parametros: PARAMETROS_POR_DEFECTO, lineas: [linea({})], costo: 1000,
  estado: "borrador", notas: null, created_at: "2026-10-05T15:00:00.000Z", updated_at: "2026-10-05T15:00:00.000Z", ...o,
});

const PEDIDOS = [
  pedido({ id: "a", numero: 1, obra: "Familia Pérez", estado: "recibido", costo: 5000 }),
  pedido({
    id: "b", numero: 2, obra: "Familia Gómez", solicitante: "Benja", estado: "enviado", costo: 2300, notas: "Entregar temprano",
    lineas: [
      linea({ material_id: "1", nombre: "Hierro", precio: 100, subtotal: 1000 }),
      linea({ material_id: "2", nombre: "Filtro", proveedor_id: "p2", proveedor: "Filtros SA", contacto: null, telefono: null, precio: null, subtotal: 0, cantidad: 1 }),
      linea({ material_id: "3", nombre: "Bomba", proveedor_id: "p2", proveedor: "Filtros SA", contacto: null, telefono: null, precio: 1300, subtotal: 1300, cantidad: 1 }),
    ],
  }),
  pedido({ id: "c", numero: 12, obra: "Club", estado: "borrador", costo: 800 }),
];

async function cargar() {
  render(<PedidosPage />);
  await screen.findByText(/3 pedidos/);
}

describe("Pedidos", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset());
    mocks.listarPedidos.mockResolvedValue({ items: PEDIDOS, error: null });
    mocks.cambiarEstadoPedido.mockResolvedValue({ error: null });
    mocks.eliminarPedido.mockResolvedValue({ error: null });
    mocks.exportarPedido.mockResolvedValue({ blob: new Blob(["x"]), nombre: "Pedido_PED-0002.pdf", mime: "application/pdf" });
    mocks.compartirOdescargarArchivo.mockResolvedValue(undefined);
  });

  it("lista los pedidos con su número, obra, costo y estado, los más nuevos primero", async () => {
    await cargar();

    const numeros = screen.getAllByText(/^PED-\d{4}$/).map((n) => n.textContent);
    expect(numeros).toEqual(["PED-0012", "PED-0002", "PED-0001"]);
    expect(screen.getByText("Familia Gómez")).toBeInTheDocument();
    expect(screen.getByText("Pide: Benja")).toBeInTheDocument();
    expect(screen.getByText(/\$\s*2\.300/).className).toContain("whitespace-nowrap");
    expect(screen.getAllByText("Recibido").length).toBeGreaterThan(0);
  });

  it("los chips de estado muestran su contador y filtran", async () => {
    const user = userEvent.setup();
    await cargar();
    const grupo = screen.getByRole("group", { name: "Filtrar por estado" });
    expect(within(grupo).getByRole("button", { name: /^Todos\s*3$/ })).toBeInTheDocument();
    expect(within(grupo).getByRole("button", { name: /^Enviado\s*1$/ })).toBeInTheDocument();

    await user.click(within(grupo).getByRole("button", { name: /^Enviado/ }));

    expect(screen.getByText("Familia Gómez")).toBeInTheDocument();
    expect(screen.queryByText("Familia Pérez")).not.toBeInTheDocument();
    expect(screen.getByText(/1 pedido de 3/)).toBeInTheDocument();
  });

  it("busca por número y por obra", async () => {
    const user = userEvent.setup();
    await cargar();

    await user.type(screen.getByLabelText("Buscar pedidos"), "ped-0012");
    expect(screen.getByText("Club")).toBeInTheDocument();
    expect(screen.queryByText("Familia Pérez")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Buscar pedidos"));
    await user.type(screen.getByLabelText("Buscar pedidos"), "gómez");
    expect(screen.getByText("Familia Gómez")).toBeInTheDocument();
    expect(screen.queryByText("Club")).not.toBeInTheDocument();
  });

  it("sin pedidos ofrece armar el primero; con filtro sin resultados lo dice", async () => {
    mocks.listarPedidos.mockResolvedValue({ items: [], error: null });
    render(<PedidosPage />);
    expect(await screen.findByText(/Todavía no hay pedidos guardados/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Armá el primero" })).toHaveAttribute("href", "/dashboard/catalogo/pedido");
  });

  it("si todavía no se corrió la migración muestra el aviso claro", async () => {
    mocks.listarPedidos.mockResolvedValue({ items: null, error: "Falta correr supabase/migration_pedidos.sql" });
    render(<PedidosPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/migration_pedidos/);
  });

  describe("el detalle de un pedido", () => {
    async function abrir(user: ReturnType<typeof userEvent.setup>, numero = "PED-0002") {
      await user.click(screen.getByRole("button", { name: `Abrir ${numero}` }));
      return screen.findByRole("dialog");
    }

    it("muestra las líneas por proveedor, los subtotales y el total (lo sin precio no suma)", async () => {
      const user = userEvent.setup();
      await cargar();
      const dialogo = await abrir(user);

      const filtros = within(dialogo).getByRole("region", { name: "Pedido a Filtros SA" });
      expect(within(filtros).getByText("Bomba")).toBeInTheDocument();
      expect(within(filtros).getByText("A confirmar")).toBeInTheDocument();
      expect(within(filtros).getByText(/Subtotal \$\s*1\.300/)).toBeInTheDocument();
      expect(within(dialogo).getByText("Total estimado").parentElement).toHaveTextContent("$ 2.300");
      expect(within(dialogo).getByText(/No incluye 1 artículo con precio a confirmar/)).toBeInTheDocument();
      expect(within(dialogo).getByText(/Entregar temprano/)).toBeInTheDocument();
      expect(within(dialogo).getByText("Pedido PED-0002")).toBeInTheDocument();
    });

    it("cambiar el estado lo guarda y actualiza la lista", async () => {
      const user = userEvent.setup();
      await cargar();
      const dialogo = await abrir(user);

      await user.selectOptions(within(dialogo).getByLabelText("Estado"), "recibido");

      await waitFor(() => expect(mocks.cambiarEstadoPedido).toHaveBeenCalledWith("b", "recibido"));
      expect(await within(dialogo).findByText("Estado: Recibido.")).toBeInTheDocument();
      const grupo = screen.getByRole("group", { name: "Filtrar por estado" });
      expect(within(grupo).getByRole("button", { name: /^Recibido/ }).textContent).toContain("2");
    });

    it("si no se puede cambiar el estado lo dice y no lo cambia", async () => {
      mocks.cambiarEstadoPedido.mockResolvedValue({ error: "No se pudo cambiar el estado: ya no existe" });
      const user = userEvent.setup();
      await cargar();
      const dialogo = await abrir(user);

      await user.selectOptions(within(dialogo).getByLabelText("Estado"), "cancelado");

      expect(await within(dialogo).findByRole("alert")).toHaveTextContent(/ya no existe/);
      expect(within(dialogo).getByLabelText("Estado")).toHaveValue("enviado");
    });

    it("exporta desde lo guardado: el documento lleva su número y su fecha originales", async () => {
      const user = userEvent.setup();
      await cargar();
      const dialogo = await abrir(user);

      await user.click(within(dialogo).getByLabelText("Exportar"));
      await user.click(within(dialogo).getByRole("menuitem", { name: /PDF — uno por proveedor/ }));

      await waitFor(() => expect(mocks.exportarPedido).toHaveBeenCalledTimes(1));
      const [doc, formato, modo] = mocks.exportarPedido.mock.calls[0];
      expect([formato, modo]).toEqual(["pdf", "por-proveedor"]);
      expect(doc).toMatchObject({ numero: "PED-0002", obra: "Familia Gómez", solicitante: "Benja", observaciones: "Entregar temprano" });
      expect(doc.proveedores.map((p: { nombre: string }) => p.nombre)).toEqual(["Corralón Uno", "Filtros SA"]);
      expect(mocks.compartirOdescargarArchivo).toHaveBeenCalledWith(expect.any(Blob), "Pedido_PED-0002.pdf", "application/pdf");
    });

    it("un pedido de un solo proveedor no ofrece 'uno por proveedor'", async () => {
      const user = userEvent.setup();
      await cargar();
      const dialogo = await abrir(user, "PED-0001");

      await user.click(within(dialogo).getByLabelText("Exportar"));

      expect(within(dialogo).getByRole("menuitem", { name: /Excel — todo junto/ })).toBeInTheDocument();
      expect(within(dialogo).queryByRole("menuitem", { name: /uno por proveedor/ })).not.toBeInTheDocument();
    });

    it("'Volver a armar' lleva al armado con los datos de este pedido", async () => {
      const user = userEvent.setup();
      await cargar();
      const dialogo = await abrir(user);

      expect(within(dialogo).getByRole("link", { name: "Volver a armar con estos datos" })).toHaveAttribute(
        "href",
        "/dashboard/catalogo/pedido?desde=b"
      );
    });

    it("eliminar pide confirmación y lo saca de la lista", async () => {
      const user = userEvent.setup();
      await cargar();
      const dialogo = await abrir(user);

      await user.click(within(dialogo).getByRole("button", { name: "Eliminar pedido" }));
      expect(screen.getByRole("alertdialog")).toHaveTextContent(/PED-0002/);
      expect(mocks.eliminarPedido).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: "Sí, eliminar" }));

      await waitFor(() => expect(mocks.eliminarPedido).toHaveBeenCalledWith("b"));
      expect(await screen.findByText("Se eliminó PED-0002.")).toBeInTheDocument();
      expect(screen.queryByText("Familia Gómez")).not.toBeInTheDocument();
    });

    it("si falla la generación del archivo lo dice, sin romper", async () => {
      mocks.exportarPedido.mockRejectedValue(new Error("boom"));
      const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const user = userEvent.setup();
      await cargar();
      const dialogo = await abrir(user);

      await user.click(within(dialogo).getByLabelText("Exportar"));
      await user.click(within(dialogo).getByRole("menuitem", { name: /PDF — todo junto/ }));

      expect(await within(dialogo).findByRole("alert")).toHaveTextContent(/No se pudo generar el archivo/);
      err.mockRestore();
    });
  });
});
