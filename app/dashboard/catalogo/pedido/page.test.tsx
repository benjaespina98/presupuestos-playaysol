// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Material } from "@/lib/domain/abastecimiento/material";
import type { Proveedor } from "@/lib/domain/abastecimiento/proveedor";
import PedidoPage from "./page";

const mocks = vi.hoisted(() => ({
  listarMateriales: vi.fn(),
  listarProveedores: vi.fn(),
  copiarAlPortapapeles: vi.fn(),
  guardarPedido: vi.fn(),
  listarPedidos: vi.fn(),
  exportarPedido: vi.fn(),
  compartirOdescargarArchivo: vi.fn(),
  desde: { valor: null as string | null },
}));
vi.mock("@/lib/abastecimiento", () => ({ listarMateriales: mocks.listarMateriales, listarProveedores: mocks.listarProveedores }));
vi.mock("@/lib/clipboard", () => ({ copiarAlPortapapeles: mocks.copiarAlPortapapeles }));
vi.mock("@/lib/pedidos", () => ({ guardarPedido: mocks.guardarPedido, listarPedidos: mocks.listarPedidos }));
vi.mock("@/lib/documentos/pedidos/exportar", () => ({ exportarPedido: mocks.exportarPedido }));
vi.mock("@/lib/documentos/compartir", () => ({ compartirOdescargarArchivo: mocks.compartirOdescargarArchivo }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mocks.desde.valor ? { desde: mocks.desde.valor } : {}),
}));

// Datos inventados (el repo es público).
const proveedor = (o: Partial<Proveedor>): Proveedor => ({
  id: "p1", nombre: "Corralón Uno", rubro: null, contacto: null, telefono: "+54 9 111 111", forma_pago: null,
  plazo: null, notas: null, activo: true, orden: 1, updated_at: "", ...o,
});
const material = (o: Partial<Material>): Material => ({
  id: "m1", nombre: "Hierro", proveedor_id: "p1", unidad: "unidad", precio: 100, precio_actualizado: null,
  rubro: "Materiales", aplica: "Siempre", usd_ref: null, notas: null, cantidades: { "8x4": 10, "5x3": 4 },
  activo: true, orden: 1, updated_at: "", ...o,
});

const PROVEEDORES = [proveedor({}), proveedor({ id: "p2", nombre: "Filtros SA", telefono: null, orden: 2 })];
const MATERIALES = [
  material({ id: "a", nombre: "Hierro", precio: 100, cantidades: { "8x4": 10, "5x3": 4 } }),
  material({ id: "b", nombre: "Cemento", unidad: "bolsa", precio: 50, orden: 2, cantidades: { "8x4": 20, "5x3": 8 } }),
  material({ id: "c", nombre: "Filtro", proveedor_id: "p2", precio: null, orden: 3, cantidades: { "8x4": 1 } }),
  material({ id: "d", nombre: "Losetas", aplica: "Losetas", precio: 10, orden: 4, cantidades: { "8x4": 5 } }),
  material({ id: "e", nombre: "Deck", aplica: "Deck", precio: 20, orden: 5, cantidades: { "8x4": 7 } }),
  material({ id: "f", nombre: "Luminaria", aplica: "Luz", precio: 1000, orden: 6, proveedor_id: "p2", cantidades: { "8x4": 1 } }),
];

/** Lo que devolvería la base al guardar. */
function guardadoDe(d: { costo: number; obra?: string; parametros?: unknown }) {
  return {
    id: "ped-1", numero: 7, obra: d.obra ?? "", solicitante: "", parametros: d.parametros ?? {}, lineas: [], costo: d.costo,
    estado: "borrador", notas: null, created_at: "2026-10-05T12:00:00.000Z", updated_at: "2026-10-05T12:00:00.000Z",
  };
}

const abrirExportar = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByLabelText("Exportar"));

const resumen = (etiqueta: string) => within(screen.getByRole("region", { name: "Resumen del pedido" })).getByText(etiqueta).parentElement!;

async function cargar() {
  render(<PedidoPage />);
  await screen.findByRole("region", { name: "Resumen del pedido" });
}

describe("Armar pedido", () => {
  beforeEach(() => {
    Object.entries(mocks).forEach(([k, m]) => k !== "desde" && (m as ReturnType<typeof vi.fn>).mockReset());
    mocks.listarMateriales.mockResolvedValue({ items: MATERIALES, error: null });
    mocks.listarProveedores.mockResolvedValue({ items: PROVEEDORES, error: null });
    mocks.copiarAlPortapapeles.mockResolvedValue(true);
    mocks.desde.valor = null;
    mocks.guardarPedido.mockImplementation(async (d: { costo: number }) => ({ pedido: guardadoDe(d), error: null }));
    mocks.listarPedidos.mockResolvedValue({ items: [], error: null });
    mocks.exportarPedido.mockResolvedValue({ blob: new Blob(["x"]), nombre: "Pedido_PED-0007.pdf", mime: "application/pdf" });
    mocks.compartirOdescargarArchivo.mockResolvedValue(undefined);
  });

  it("para 8x4 con losetas arma las tablas por proveedor y el resumen", async () => {
    await cargar();

    // Hierro 10×100 + Cemento 20×50 + Losetas 5×10 = 2.050 (Filtro sin precio no suma)
    expect(resumen("Artículos a pedir")).toHaveTextContent("4");
    expect(resumen("Proveedores a contactar")).toHaveTextContent("2");
    expect(resumen("Costo estimado")).toHaveTextContent("$ 2.050");
    expect(resumen("Costo estimado")).toHaveTextContent("Sin contar 1 artículo con precio a confirmar");

    const uno = screen.getByRole("region", { name: "Pedido a Corralón Uno" });
    expect(within(uno).getByText("+54 9 111 111")).toBeInTheDocument();
    expect(within(uno).getByText("Hierro")).toBeInTheDocument();
    expect(within(uno).getByText("Losetas")).toBeInTheDocument();
    expect(within(uno).queryByText("Deck")).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Pedido a Filtros SA" })).getByText("A confirmar")).toBeInTheDocument();
  });

  it("cambiar el borde cambia qué se pide", async () => {
    const user = userEvent.setup();
    await cargar();

    await user.click(screen.getByRole("button", { name: "Deck" }));

    const uno = screen.getByRole("region", { name: "Pedido a Corralón Uno" });
    expect(within(uno).getByText("Deck")).toBeInTheDocument();
    expect(within(uno).queryByText("Losetas")).not.toBeInTheDocument();
    expect(resumen("Costo estimado")).toHaveTextContent("$ 2.140"); // 1000 + 1000 + 7×20
  });

  it("cambiar el tamaño usa las cantidades de ese tamaño", async () => {
    const user = userEvent.setup();
    await cargar();

    await user.selectOptions(screen.getByLabelText("Tamaño de pileta"), "5x3");

    expect(resumen("Artículos a pedir")).toHaveTextContent("2"); // sólo Hierro y Cemento tienen 5x3
    expect(resumen("Costo estimado")).toHaveTextContent("$ 800"); // 4×100 + 8×50
  });

  it("las luces suman una luminaria por cada luz", async () => {
    const user = userEvent.setup();
    await cargar();
    expect(screen.queryByText("Luminaria")).not.toBeInTheDocument();

    const luces = screen.getByLabelText("Cantidad de luces (por pileta)");
    await user.clear(luces);
    await user.type(luces, "3");

    const filtros = screen.getByRole("region", { name: "Pedido a Filtros SA" });
    expect(within(filtros).getByLabelText("Cantidad de Luminaria")).toHaveValue(3);
  });

  it("la cantidad de obras multiplica", async () => {
    const user = userEvent.setup();
    await cargar();
    const obras = screen.getByLabelText("Cantidad de obras");
    await user.clear(obras);
    await user.type(obras, "2");

    expect(screen.getByLabelText("Cantidad de Hierro")).toHaveValue(20);
  });

  it("se puede ajustar una cantidad a mano: recalcula el subtotal y avisa lo que daba la cuenta", async () => {
    const user = userEvent.setup();
    await cargar();

    const campo = screen.getByLabelText("Cantidad de Hierro");
    await user.clear(campo);
    await user.type(campo, "12");
    await user.tab();

    expect(screen.getByLabelText("Cantidad de Hierro")).toHaveValue(12);
    expect(screen.getByText("calculado: 10")).toBeInTheDocument();
    expect(resumen("Costo estimado")).toHaveTextContent("$ 2.250");
  });

  it("dejar el campo vacío no hace desaparecer la fila: se conserva la cantidad anterior", async () => {
    const user = userEvent.setup();
    await cargar();

    const campo = screen.getByLabelText("Cantidad de Hierro");
    await user.clear(campo);
    await user.tab();

    expect(screen.getByLabelText("Cantidad de Hierro")).toHaveValue(10);
  });

  it("'Restablecer cantidades' deshace los ajustes", async () => {
    const user = userEvent.setup();
    await cargar();
    const campo = screen.getByLabelText("Cantidad de Hierro");
    await user.clear(campo);
    await user.type(campo, "12");
    await user.tab();

    await user.click(screen.getByRole("button", { name: "Restablecer cantidades" }));

    expect(screen.getByLabelText("Cantidad de Hierro")).toHaveValue(10);
    expect(screen.queryByRole("button", { name: "Restablecer cantidades" })).not.toBeInTheDocument();
  });

  it("se puede quitar un material y volver a ponerlo", async () => {
    const user = userEvent.setup();
    await cargar();

    await user.click(screen.getByRole("button", { name: "Quitar Cemento del pedido" }));
    expect(screen.queryByLabelText("Cantidad de Cemento")).not.toBeInTheDocument();
    expect(resumen("Costo estimado")).toHaveTextContent("$ 1.050");

    await user.click(screen.getByRole("button", { name: "Volver a poner Cemento" }));
    expect(screen.getByLabelText("Cantidad de Cemento")).toBeInTheDocument();
    expect(resumen("Costo estimado")).toHaveTextContent("$ 2.050");
  });

  it("cambiar el tamaño descarta los ajustes a mano (ya no corresponden)", async () => {
    const user = userEvent.setup();
    await cargar();
    await user.click(screen.getByRole("button", { name: "Quitar Cemento del pedido" }));

    await user.selectOptions(screen.getByLabelText("Tamaño de pileta"), "5x3");

    expect(screen.getByLabelText("Cantidad de Cemento")).toBeInTheDocument();
  });

  it("copia el mensaje de WhatsApp con el formato de la planilla", async () => {
    const user = userEvent.setup();
    await cargar();
    await user.type(screen.getByLabelText("Cliente / obra"), "Familia Pérez");
    await user.type(screen.getByLabelText("Pide (quién hace el pedido)"), "Benja");

    await user.click(screen.getByRole("button", { name: "Copiar mensaje para WhatsApp" }));

    await waitFor(() => expect(mocks.copiarAlPortapapeles).toHaveBeenCalled());
    const texto = mocks.copiarAlPortapapeles.mock.calls[0][0] as string;
    expect(texto).toContain("*PEDIDO DE MATERIALES — Playa & Sol*");
    expect(texto).toContain("Obra: Familia Pérez · Pileta 8x4");
    expect(texto).toContain("Pide: Benja");
    expect(texto).toContain("*Corralón Uno* · +54 9 111 111\n- Hierro: 10\n- Cemento: 20 bolsa");
    expect(await screen.findByText("¡Copiado!")).toBeInTheDocument();
  });

  it("copia el pedido de UN proveedor solo", async () => {
    const user = userEvent.setup();
    await cargar();

    await user.click(screen.getByRole("button", { name: "Copiar el pedido a Filtros SA" }));

    await waitFor(() => expect(mocks.copiarAlPortapapeles).toHaveBeenCalledWith("*Filtros SA*\n- Filtro: 1"));
  });

  it("el mensaje refleja los ajustes a mano", async () => {
    const user = userEvent.setup();
    await cargar();
    const campo = screen.getByLabelText("Cantidad de Hierro");
    await user.clear(campo);
    await user.type(campo, "12");
    await user.tab();

    await user.click(screen.getByRole("button", { name: "Copiar mensaje para WhatsApp" }));

    await waitFor(() => expect(mocks.copiarAlPortapapeles).toHaveBeenCalled());
    expect(mocks.copiarAlPortapapeles.mock.calls[0][0]).toContain("- Hierro: 12");
  });

  it("descarga el pedido como CSV para Excel, con un nombre sin tildes", async () => {
    const user = userEvent.setup();
    const crear = vi.fn(() => "blob:falso");
    const revocar = vi.fn();
    Object.assign(URL, { createObjectURL: crear, revokeObjectURL: revocar });
    const clic = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    await cargar();
    await user.type(screen.getByLabelText("Cliente / obra"), "Familia Pérez");

    await abrirExportar(user);
    await user.click(screen.getByRole("menuitem", { name: /CSV simple/ }));

    expect(crear).toHaveBeenCalledTimes(1);
    const blob = (crear.mock.calls as unknown as [Blob][])[0][0];
    expect(blob.type).toContain("text/csv");
    expect(clic).toHaveBeenCalled();
    expect(revocar).toHaveBeenCalledWith("blob:falso");
    clic.mockRestore();
  });

  it("si no hay cantidades para ese tamaño lo dice y manda a Materiales", async () => {
    const user = userEvent.setup();
    await cargar();

    await user.selectOptions(screen.getByLabelText("Tamaño de pileta"), "10x4");

    expect(screen.getByText(/No hay cantidades cargadas para la pileta 10x4/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Materiales" })).toHaveAttribute("href", "/dashboard/catalogo/materiales");
    expect(screen.queryByRole("button", { name: "Copiar mensaje para WhatsApp" })).not.toBeInTheDocument();
  });

  it("sin materiales cargados avisa y manda a cargarlos", async () => {
    mocks.listarMateriales.mockResolvedValue({ items: [], error: null });
    render(<PedidoPage />);
    expect(await screen.findByText(/Todavía no hay materiales cargados/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cargalos en Materiales" })).toBeInTheDocument();
  });

  it("si todavía no se corrió la migración muestra el aviso claro", async () => {
    mocks.listarMateriales.mockResolvedValue({ items: null, error: "Falta correr supabase/migration_proveedores_materiales.sql" });
    render(<PedidoPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/migration_proveedores_materiales/);
  });

  it("los materiales dados de baja no entran en el pedido", async () => {
    mocks.listarMateriales.mockResolvedValue({ items: [...MATERIALES, material({ id: "z", nombre: "Viejo", activo: false, orden: 9 })], error: null });
    await cargar();
    expect(screen.queryByText("Viejo")).not.toBeInTheDocument();
  });

  describe("guardar y exportar", () => {
    it("'Guardar pedido' lo guarda con sus datos y avisa el número", async () => {
      const user = userEvent.setup();
      await cargar();
      await user.type(screen.getByLabelText("Cliente / obra"), "Familia Pérez");
      await user.type(screen.getByLabelText("Pide (quién hace el pedido)"), "Benja");
      await user.type(screen.getByLabelText(/Observaciones/), "Entregar temprano");

      await user.click(screen.getByRole("button", { name: "Guardar pedido" }));

      await waitFor(() => expect(mocks.guardarPedido).toHaveBeenCalledTimes(1));
      const datos = mocks.guardarPedido.mock.calls[0][0];
      expect(datos).toMatchObject({ obra: "Familia Pérez", solicitante: "Benja", notas: "Entregar temprano", costo: 2050 });
      expect(datos.parametros).toMatchObject({ tamano: "8x4", borde: "Losetas" });
      expect(datos.lineas.map((l: { nombre: string }) => l.nombre)).toEqual(["Hierro", "Cemento", "Losetas", "Filtro"]);
      expect(await screen.findByText(/Pedido PED-0007 guardado/)).toBeInTheDocument();
    });

    it("una vez guardado, el botón queda como 'Guardado · PED-0007' y no deja guardar el mismo dos veces", async () => {
      const user = userEvent.setup();
      await cargar();
      await user.click(screen.getByRole("button", { name: "Guardar pedido" }));

      const boton = await screen.findByRole("button", { name: "Guardado · PED-0007" });
      expect(boton).toBeDisabled();
    });

    it("si se cambia algo después de guardar, vuelve a poder guardarse como OTRO pedido", async () => {
      const user = userEvent.setup();
      await cargar();
      await user.click(screen.getByRole("button", { name: "Guardar pedido" }));
      await screen.findByRole("button", { name: "Guardado · PED-0007" });

      await user.click(screen.getByRole("button", { name: "Deck" }));

      expect(screen.getByRole("button", { name: "Guardar pedido" })).toBeEnabled();
    });

    it("exportar un PDF guarda el pedido primero y el documento lleva su número", async () => {
      const user = userEvent.setup();
      await cargar();
      await user.type(screen.getByLabelText("Cliente / obra"), "Familia Pérez");

      await abrirExportar(user);
      await user.click(screen.getByRole("menuitem", { name: /PDF — todo junto/ }));

      await waitFor(() => expect(mocks.exportarPedido).toHaveBeenCalledTimes(1));
      expect(mocks.guardarPedido).toHaveBeenCalledTimes(1);
      const [doc, formato, modo] = mocks.exportarPedido.mock.calls[0];
      expect(formato).toBe("pdf");
      expect(modo).toBe("junto");
      expect(doc).toMatchObject({ numero: "PED-0007", obra: "Familia Pérez", fecha: "05/10/2026" });
      expect(doc.proveedores.map((p: { nombre: string }) => p.nombre)).toEqual(["Corralón Uno", "Filtros SA"]);
      expect(mocks.compartirOdescargarArchivo).toHaveBeenCalledWith(expect.any(Blob), "Pedido_PED-0007.pdf", "application/pdf");
      expect(await screen.findByText(/generado\. Quedó guardado como PED-0007/)).toBeInTheDocument();
    });

    it("exportar el mismo pedido otra vez NO lo vuelve a guardar (no se duplican los números)", async () => {
      const user = userEvent.setup();
      await cargar();

      await abrirExportar(user);
      await user.click(screen.getByRole("menuitem", { name: /PDF — todo junto/ }));
      await waitFor(() => expect(mocks.exportarPedido).toHaveBeenCalledTimes(1));
      await abrirExportar(user);
      await user.click(screen.getByRole("menuitem", { name: /Excel — todo junto/ }));
      await waitFor(() => expect(mocks.exportarPedido).toHaveBeenCalledTimes(2));

      expect(mocks.guardarPedido).toHaveBeenCalledTimes(1);
      expect(mocks.exportarPedido.mock.calls[1][1]).toBe("xlsx");
    });

    it("las salidas 'uno por proveedor' piden un ZIP con un archivo por cada uno", async () => {
      const user = userEvent.setup();
      await cargar();

      await abrirExportar(user);
      await user.click(screen.getByRole("menuitem", { name: /Excel — uno por proveedor/ }));

      await waitFor(() => expect(mocks.exportarPedido).toHaveBeenCalled());
      expect(mocks.exportarPedido.mock.calls[0].slice(1, 3)).toEqual(["xlsx", "por-proveedor"]);
    });

    it("si no se puede guardar (falta la migración) el archivo sale igual, como BORRADOR, y lo avisa", async () => {
      mocks.guardarPedido.mockResolvedValue({ pedido: null, error: "Falta correr supabase/migration_pedidos.sql" });
      const user = userEvent.setup();
      await cargar();

      await abrirExportar(user);
      await user.click(screen.getByRole("menuitem", { name: /PDF — todo junto/ }));

      await waitFor(() => expect(mocks.exportarPedido).toHaveBeenCalled());
      expect(mocks.exportarPedido.mock.calls[0][0].numero).toBe("BORRADOR");
      expect(await screen.findByText(/BORRADOR \(sin número\).*migration_pedidos/)).toBeInTheDocument();
    });

    it("'Guardar pedido' con la tabla sin crear muestra el error y no dice que guardó", async () => {
      mocks.guardarPedido.mockResolvedValue({ pedido: null, error: "Falta correr supabase/migration_pedidos.sql" });
      const user = userEvent.setup();
      await cargar();

      await user.click(screen.getByRole("button", { name: "Guardar pedido" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(/migration_pedidos/);
      expect(screen.getByRole("button", { name: "Guardar pedido" })).toBeEnabled();
    });

    it("si falla la generación del archivo lo dice, sin romper la pantalla", async () => {
      mocks.exportarPedido.mockRejectedValue(new Error("boom"));
      const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const user = userEvent.setup();
      await cargar();

      await abrirExportar(user);
      await user.click(screen.getByRole("menuitem", { name: /PDF — todo junto/ }));

      expect(await screen.findByRole("alert")).toHaveTextContent(/No se pudo generar el archivo/);
      err.mockRestore();
    });

    it("con un solo proveedor no se ofrecen las salidas 'uno por proveedor'", async () => {
      mocks.listarMateriales.mockResolvedValue({ items: [MATERIALES[0], MATERIALES[1]], error: null });
      const user = userEvent.setup();
      await cargar();

      await abrirExportar(user);

      expect(screen.getByRole("menuitem", { name: /PDF — todo junto/ })).toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: /uno por proveedor/ })).not.toBeInTheDocument();
    });

    it("las observaciones salen en el documento", async () => {
      const user = userEvent.setup();
      await cargar();
      await user.type(screen.getByLabelText(/Observaciones/), "Entregar temprano");

      await abrirExportar(user);
      await user.click(screen.getByRole("menuitem", { name: /PDF — todo junto/ }));

      await waitFor(() => expect(mocks.exportarPedido).toHaveBeenCalled());
      expect(mocks.exportarPedido.mock.calls[0][0].observaciones).toBe("Entregar temprano");
    });
  });

  describe("volver a armar desde un pedido guardado (?desde=)", () => {
    it("carga la obra, quien pide y las condiciones, y avisa que las cantidades se recalcularon", async () => {
      mocks.desde.valor = "ped-9";
      mocks.listarPedidos.mockResolvedValue({
        items: [
          {
            ...guardadoDe({ costo: 1, obra: "Familia Gómez" }),
            id: "ped-9", numero: 9, solicitante: "Fer", notas: "Con deck",
            parametros: { tamano: "5x3", obras: 1, borde: "Deck", luces: 0, luzCamaAgua: false, banoQuimico: false },
          },
        ],
        error: null,
      });
      await cargar();

      await waitFor(() => expect(screen.getByLabelText("Cliente / obra")).toHaveValue("Familia Gómez"));
      expect(screen.getByLabelText("Pide (quién hace el pedido)")).toHaveValue("Fer");
      expect(screen.getByLabelText("Tamaño de pileta")).toHaveValue("5x3");
      expect(screen.getByLabelText(/Observaciones/)).toHaveValue("Con deck");
      expect(screen.getByRole("button", { name: "Deck" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByText(/Se cargaron los datos de PED-0009/)).toBeInTheDocument();
    });

    it("si el pedido no existe más, no cambia nada", async () => {
      mocks.desde.valor = "no-existe";
      await cargar();
      expect(screen.getByLabelText("Cliente / obra")).toHaveValue("");
    });
  });

  it("el luces y la luz de cama de agua / baño químico se pueden tildar", async () => {
    mocks.listarMateriales.mockResolvedValue({
      items: [
        material({ id: "a", nombre: "Hierro" }),
        material({ id: "n", nombre: "Baño químico (servicio)", aplica: "Baño químico", orden: 2, cantidades: { "8x4": 1 } }),
        material({ id: "k", nombre: "Luz cama", aplica: "Luz cama de agua", orden: 3, cantidades: { "8x4": 1 } }),
      ],
      error: null,
    });
    const user = userEvent.setup();
    await cargar();
    expect(screen.queryByText("Baño químico (servicio)")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Baño químico"));
    fireEvent.click(screen.getByLabelText("Luz en la cama de agua"));

    expect(await screen.findByText("Baño químico (servicio)")).toBeInTheDocument();
    expect(screen.getByText("Luz cama")).toBeInTheDocument();
    void user;
  });
});
