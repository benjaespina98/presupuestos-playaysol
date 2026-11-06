// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ItemCatalogo } from "@/lib/domain/catalogo/item";
import StockPage from "./page";

const { listarItemsCatalogo } = vi.hoisted(() => ({ listarItemsCatalogo: vi.fn() }));
vi.mock("@/lib/catalogo", () => ({ listarItemsCatalogo }));

const { registrarMovimiento, ajustarConteo, anularMovimiento, listarMovimientos } = vi.hoisted(() => ({
  registrarMovimiento: vi.fn(),
  ajustarConteo: vi.fn(),
  anularMovimiento: vi.fn(),
  listarMovimientos: vi.fn(),
}));
vi.mock("@/lib/stock", () => ({ registrarMovimiento, ajustarConteo, anularMovimiento, listarMovimientos }));

function item(overrides: Partial<ItemCatalogo>): ItemCatalogo {
  return {
    id: "id",
    tipo: "piscinas",
    clave: "clave",
    descripcion: "Un ítem",
    precio: 1000,
    categoria: null,
    unidad: null,
    activo: true,
    orden: null,
    stock: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Abre el menú "⋯" de un ítem y elige una acción (Corregir stock o Ver movimientos). */
async function accion(user: ReturnType<typeof userEvent.setup>, nombre: string, etiqueta: string) {
  await user.click(screen.getAllByRole("button", { name: `Más acciones de ${nombre}` })[0]);
  await user.click(await screen.findByRole("menuitem", { name: etiqueta }));
}

describe("StockPage · lista", () => {
  const PISCINAS = [
    item({ id: "p1", clave: "indusplast_caribe_550", descripcion: "Caribe 550", categoria: "Piscinas", stock: 2 }),
    item({ id: "p2", clave: "indusplast_caribe_650", descripcion: "Caribe 650", categoria: "Piscinas", stock: 0 }),
    item({ id: "p3", clave: "indusplast_finesa_600", descripcion: "Finesa 600", categoria: "Piscinas", stock: -1 }),
    item({ id: "p4", clave: "indusplast_spa_240", descripcion: "Spa 240", categoria: "Piscinas", stock: 4, activo: false }),
    item({ id: "h1", clave: "hierro", descripcion: "Hierro del 6", categoria: "Accesorios" }),
  ];

  beforeEach(() => {
    window.sessionStorage.clear();
    for (const m of [registrarMovimiento, ajustarConteo, anularMovimiento, listarMovimientos]) m.mockReset();
    listarItemsCatalogo.mockResolvedValue({ items: PISCINAS, error: null });
  });

  it("muestra sólo lo que lleva stock y está activo, agrupado por modelo", async () => {
    render(<StockPage />);
    expect(await screen.findByRole("region", { name: "Indusplast · Caribe" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Indusplast · Finesa" })).toBeInTheDocument();
    expect(screen.getByText("Caribe 550")).toBeInTheDocument();
    expect(screen.queryByText("Hierro del 6")).not.toBeInTheDocument(); // se pide a pedido
    expect(screen.queryByText("Spa 240")).not.toBeInTheDocument(); // desactivado
  });

  it("resume lo que hay en una línea", async () => {
    render(<StockPage />);
    expect(await screen.findByText("2 unidades · 1 agotada · 1 negativa")).toBeInTheDocument();
  });

  it("los filtros rápidos traen su contador y filtran sin abrir nada", async () => {
    const user = userEvent.setup();
    render(<StockPage />);
    await screen.findByText("Caribe 550");

    expect(screen.getByRole("button", { name: "Todas (3)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Con stock (1)" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Agotadas (1)" }));
    expect(screen.getByText("Caribe 650")).toBeInTheDocument();
    expect(screen.queryByText("Caribe 550")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Negativas (1)" }));
    expect(screen.getByText("Finesa 600")).toBeInTheDocument();
    expect(screen.queryByText("Caribe 650")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Todas (3)" }));
    expect(screen.getByText("Caribe 550")).toBeInTheDocument();
  });

  it("busca por modelo o medida, sin importar mayúsculas", async () => {
    const user = userEvent.setup();
    render(<StockPage />);
    await screen.findByText("Caribe 550");

    await user.type(screen.getByRole("textbox", { name: "Buscar en el stock" }), "FINESA");
    expect(await screen.findByText("Finesa 600")).toBeInTheDocument();
    expect(screen.queryByText("Caribe 550")).not.toBeInTheDocument();

    await user.clear(screen.getByRole("textbox", { name: "Buscar en el stock" }));
    await user.type(screen.getByRole("textbox", { name: "Buscar en el stock" }), "650");
    expect(await screen.findByText("Caribe 650")).toBeInTheDocument();
    expect(screen.queryByText("Finesa 600")).not.toBeInTheDocument();
  });

  it("sin coincidencias lo dice y ofrece limpiar", async () => {
    const user = userEvent.setup();
    render(<StockPage />);
    await screen.findByText("Caribe 550");
    await user.type(screen.getByRole("textbox", { name: "Buscar en el stock" }), "zzz");
    expect(await screen.findByText("Ningún modelo coincide con el filtro.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(await screen.findByText("Caribe 550")).toBeInTheDocument();
  });

  it("si nada lleva stock, lo dice", async () => {
    listarItemsCatalogo.mockResolvedValue({ items: [PISCINAS[4]], error: null });
    render(<StockPage />);
    expect(await screen.findByText("Todavía no hay modelos con stock cargado.")).toBeInTheDocument();
  });

  it("la búsqueda y el filtro se conservan al salir y volver", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<StockPage />);
    await screen.findByText("Caribe 550");
    await user.click(screen.getByRole("button", { name: "Agotadas (1)" }));
    unmount();

    render(<StockPage />);
    await screen.findByText("Caribe 650");
    expect(screen.getByRole("button", { name: /^Agotadas/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Caribe 550")).not.toBeInTheDocument();
  });
});

describe("StockPage · mover el stock", () => {
  const PISCINAS = [
    item({ id: "p1", clave: "indusplast_caribe_550", descripcion: "Caribe 550", categoria: "Piscinas", stock: 2 }),
    item({ id: "p2", clave: "indusplast_caribe_650", descripcion: "Caribe 650", categoria: "Piscinas", stock: 0 }),
    item({ id: "h1", clave: "hierro", descripcion: "Hierro del 6", categoria: "Accesorios" }),
  ];

  beforeEach(() => {
    window.sessionStorage.clear();
    for (const m of [registrarMovimiento, ajustarConteo, anularMovimiento, listarMovimientos]) m.mockReset();
    listarItemsCatalogo.mockResolvedValue({ items: PISCINAS, error: null });
  });

  const resultado = (o: Record<string, unknown>) => ({
    resultado: { movimiento_id: "m1", tipo: "ingreso", cantidad: 1, stock_resultante: 3, stock_negativo: false, repetido: false, ...o },
    error: null,
  });

  it("un ítem que lleva stock muestra − y + a la vista, y Corregir stock y Ver movimientos en el menú; uno que no, nada de eso", async () => {
    render(<StockPage />);
    await screen.findAllByText("Caribe 550");

    // Restar y sumar están a la vista; Corregir stock y Ver movimientos, en el menú "⋯".
    expect(screen.getAllByRole("button", { name: "Restar stock de Caribe 550" }).length).toBeGreaterThan(0);
    const user = userEvent.setup();
    await user.click(screen.getAllByRole("button", { name: "Más acciones de Caribe 550" })[0]);
    expect(screen.getAllByRole("button", { name: "Sumar stock de Caribe 550" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("menuitem", { name: "Corregir stock" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Ver movimientos" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Más acciones de Hierro/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /(Restar|Sumar) stock de Hierro/ })).not.toBeInTheDocument();
  });

  it("un ingreso llama a la función con una clave y el stock pasa a lo que devuelve la base", async () => {
    registrarMovimiento.mockResolvedValue(resultado({ stock_resultante: 5, cantidad: 3 }));
    const user = userEvent.setup();
    render(<StockPage />);
    await screen.findAllByText("Caribe 550");

    await user.click(screen.getAllByRole("button", { name: "Sumar stock de Caribe 550" })[0]);
    await user.clear(screen.getByLabelText("Cantidad"));
    await user.type(screen.getByLabelText("Cantidad"), "3");
    await user.click(screen.getByRole("button", { name: /^Sumar( \d+)?$/ }));

    await waitFor(() => expect(registrarMovimiento).toHaveBeenCalledTimes(1));
    expect(registrarMovimiento.mock.calls[0][0]).toMatchObject({ itemId: "p1", tipo: "ingreso", cantidad: 3 });
    expect(registrarMovimiento.mock.calls[0][0].idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    expect((await screen.findAllByTitle("5 en stock")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("sumar arranca en 1, se ajusta con los botones y dice cómo queda, sin abrir el teclado", async () => {
    registrarMovimiento.mockResolvedValue(resultado({ stock_resultante: 4, cantidad: 2 }));
    const user = userEvent.setup();
    render(<StockPage />);
    await screen.findAllByText("Caribe 550");

    await user.click(screen.getAllByRole("button", { name: "Sumar stock de Caribe 550" })[0]);
    const cantidad = screen.getByLabelText("Cantidad");
    expect(cantidad).toHaveValue("1");
    expect(cantidad).not.toHaveFocus();
    expect(screen.getByRole("button", { name: "Una unidad menos" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Una unidad más" }));
    expect(cantidad).toHaveValue("2");
    await user.click(screen.getByRole("button", { name: "Sumar 2" }));

    await waitFor(() => expect(registrarMovimiento).toHaveBeenCalledTimes(1));
    expect(registrarMovimiento.mock.calls[0][0]).toMatchObject({ itemId: "p1", tipo: "ingreso", cantidad: 2 });
  });

  it("una venta que deja el stock en negativo pide confirmación antes de registrarse", async () => {
    registrarMovimiento.mockResolvedValue(resultado({ tipo: "venta", cantidad: -5, stock_resultante: -3, stock_negativo: true }));
    const user = userEvent.setup();
    render(<StockPage />);
    await screen.findAllByText("Caribe 550");

    await user.click(screen.getAllByRole("button", { name: "Restar stock de Caribe 550" })[0]);
    await user.clear(screen.getByLabelText("Cantidad"));
    await user.type(screen.getByLabelText("Cantidad"), "5");
    await user.click(screen.getByRole("button", { name: /^Restar( \d+)?$/ }));

    expect(registrarMovimiento).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/stock en negativo/);

    await user.click(screen.getByRole("button", { name: "Restar igual" }));
    await waitFor(() => expect(registrarMovimiento).toHaveBeenCalledTimes(1));
    expect(registrarMovimiento.mock.calls[0][0]).toMatchObject({ tipo: "venta", cantidad: 5 });
    // Queda una marca de aviso visible, tanto en el banner como en la fila.
    expect(await screen.findByText(/quedó en stock negativo \(−3\)/)).toBeInTheDocument();
    expect(screen.getAllByText("Stock negativo").length).toBeGreaterThan(0);
  });

  it("una venta que NO deja negativo se registra sin pedir confirmación", async () => {
    registrarMovimiento.mockResolvedValue(resultado({ tipo: "venta", cantidad: -1, stock_resultante: 1 }));
    const user = userEvent.setup();
    render(<StockPage />);
    await screen.findAllByText("Caribe 550");

    await user.click(screen.getAllByRole("button", { name: "Restar stock de Caribe 550" })[0]);
    await user.clear(screen.getByLabelText("Cantidad"));
    await user.type(screen.getByLabelText("Cantidad"), "1");
    await user.click(screen.getByRole("button", { name: /^Restar( \d+)?$/ }));

    await waitFor(() => expect(registrarMovimiento).toHaveBeenCalledTimes(1));
  });

  it("los reintentos tras un error reusan la clave; si cambia un dato, la clave es otra", async () => {
    registrarMovimiento.mockResolvedValueOnce({ resultado: null, error: "No se pudo conectar. Revisá tu conexión a internet e intentá de nuevo." });
    registrarMovimiento.mockResolvedValue(resultado({ stock_resultante: 3 }));
    const user = userEvent.setup();
    render(<StockPage />);
    await screen.findAllByText("Caribe 550");

    await user.click(screen.getAllByRole("button", { name: "Sumar stock de Caribe 550" })[0]);
    await user.clear(screen.getByLabelText("Cantidad"));
    await user.type(screen.getByLabelText("Cantidad"), "1");
    await user.click(screen.getByRole("button", { name: /^Sumar( \d+)?$/ }));
    expect(await screen.findByText(/No se pudo conectar/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Sumar( \d+)?$/ }));
    await waitFor(() => expect(registrarMovimiento).toHaveBeenCalledTimes(2));
    expect(registrarMovimiento.mock.calls[1][0].idempotencyKey).toBe(registrarMovimiento.mock.calls[0][0].idempotencyKey);
  });

  it("sin cantidad válida no llama a la base y lo explica", async () => {
    const user = userEvent.setup();
    render(<StockPage />);
    await screen.findAllByText("Caribe 550");

    await user.click(screen.getAllByRole("button", { name: "Sumar stock de Caribe 550" })[0]);
    await user.clear(screen.getByLabelText("Cantidad"));
    await user.click(screen.getByRole("button", { name: /^Sumar( \d+)?$/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Escribí la cantidad/);
    await user.clear(screen.getByLabelText("Cantidad"));
    await user.type(screen.getByLabelText("Cantidad"), "1.5");
    await user.click(screen.getByRole("button", { name: /^Sumar( \d+)?$/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(/número entero/);
    expect(registrarMovimiento).not.toHaveBeenCalled();
  });

  it("Corregir stock manda el conteo (no la diferencia) y exige motivo", async () => {
    ajustarConteo.mockResolvedValue(resultado({ tipo: "ajuste", cantidad: 3, stock_resultante: 5 }));
    const user = userEvent.setup();
    render(<StockPage />);
    await screen.findAllByText("Caribe 550");

    await accion(user, "Caribe 550", "Corregir stock");
    await user.clear(screen.getByLabelText("Unidades que contaste"));
    await user.type(screen.getByLabelText("Unidades que contaste"), "5");
    await user.click(screen.getByRole("button", { name: "Guardar conteo" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/motivo/i);
    expect(ajustarConteo).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Motivo"), "Conteo del depósito");
    await user.click(screen.getByRole("button", { name: "Guardar conteo" }));

    await waitFor(() => expect(ajustarConteo).toHaveBeenCalledTimes(1));
    expect(ajustarConteo.mock.calls[0][0]).toMatchObject({ itemId: "p1", stockContado: 5, motivo: "Conteo del depósito" });
    expect(ajustarConteo.mock.calls[0][0]).not.toHaveProperty("diferencia");
    expect((await screen.findAllByTitle("5 en stock")).length).toBeGreaterThan(0);
  });

  it("un conteo que coincide con el stock de la base avisa que no hubo cambios", async () => {
    ajustarConteo.mockResolvedValue(resultado({ movimiento_id: null, tipo: "ajuste", cantidad: 0, stock_resultante: 2 }));
    const user = userEvent.setup();
    render(<StockPage />);
    await screen.findAllByText("Caribe 550");

    await accion(user, "Caribe 550", "Corregir stock");
    await user.type(screen.getByLabelText("Motivo"), "Verificación");
    await user.click(screen.getByRole("button", { name: "Guardar conteo" }));

    expect(await screen.findByText(/coincidía con el stock cargado/)).toBeInTheDocument();
  });

  it("el historial muestra los movimientos con quién, motivo y anulados, y permite anular con motivo", async () => {
    listarMovimientos.mockResolvedValue({
      movimientos: [
        { id: "m3", item_id: "p1", tipo: "anulacion", cantidad: 1, stock_resultante: 2, motivo: "Se cargó mal", referencia: null, anula_a: "m2", creado_por: "u1", creado_at: "2026-10-22T15:00:00Z", anulado: false, creadorNombre: "Benja" },
        { id: "m2", item_id: "p1", tipo: "venta", cantidad: -1, stock_resultante: 1, motivo: null, referencia: "Pérez", anula_a: null, creado_por: "u1", creado_at: "2026-10-22T14:00:00Z", anulado: true, creadorNombre: "Benja" },
        { id: "m1", item_id: "p1", tipo: "ingreso", cantidad: 2, stock_resultante: 2, motivo: null, referencia: "Remito 7", anula_a: null, creado_por: "u2", creado_at: "2026-10-22T10:00:00Z", anulado: false, creadorNombre: "Ana" },
      ],
      error: null,
    });
    anularMovimiento.mockResolvedValue(resultado({ tipo: "anulacion", cantidad: -2, stock_resultante: 0 }));
    const user = userEvent.setup();
    render(<StockPage />);
    await screen.findAllByText("Caribe 550");

    await accion(user, "Caribe 550", "Ver movimientos");
    const dialogo = await screen.findByRole("dialog", { name: "Movimientos de stock" });
    expect(within(dialogo).getByText("Contra-asiento")).toBeInTheDocument();
    expect(within(dialogo).getAllByText("Anulado").length).toBeGreaterThan(0);
    expect(within(dialogo).getByText(/Referencia: Remito 7/)).toBeInTheDocument();
    expect(within(dialogo).getByText(/Motivo: Se cargó mal/)).toBeInTheDocument();
    expect(within(dialogo).getByText(/Ana/)).toBeInTheDocument();
    // Solo el ingreso sin anular se puede anular: la venta ya está anulada y la anulación no se anula.
    expect(within(dialogo).getAllByRole("button", { name: "Anular" })).toHaveLength(1);

    await user.click(within(dialogo).getByRole("button", { name: "Anular" }));
    await user.type(screen.getByLabelText("Motivo de la anulación"), "Remito equivocado");
    await user.click(screen.getAllByRole("button", { name: "Anular" }).at(-1)!);

    await waitFor(() => expect(anularMovimiento).toHaveBeenCalledTimes(1));
    expect(anularMovimiento.mock.calls[0][0]).toMatchObject({ movimientoId: "m1", motivo: "Remito equivocado" });
    expect(listarMovimientos.mock.calls.length).toBeGreaterThanOrEqual(2); // se recargó
  });

  it("un error de la base se muestra en castellano y el diálogo queda abierto", async () => {
    registrarMovimiento.mockResolvedValue({ resultado: null, error: "Este ítem no lleva stock." });
    const user = userEvent.setup();
    render(<StockPage />);
    await screen.findAllByText("Caribe 550");

    await user.click(screen.getAllByRole("button", { name: "Sumar stock de Caribe 550" })[0]);
    await user.clear(screen.getByLabelText("Cantidad"));
    await user.type(screen.getByLabelText("Cantidad"), "2");
    await user.click(screen.getByRole("button", { name: /^Sumar( \d+)?$/ }));

    expect(await screen.findByText("Este ítem no lleva stock.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
