// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MovimientoConItem } from "@/lib/domain/stock/resumen";
import MovimientosPage from "./page";

const { listarMovimientosGeneral } = vi.hoisted(() => ({ listarMovimientosGeneral: vi.fn() }));
vi.mock("@/lib/stock", () => ({ listarMovimientosGeneral, LIMITE_MOVIMIENTOS: 1000 }));

let n = 0;
function mov(o: Partial<MovimientoConItem>): MovimientoConItem {
  n++;
  return {
    id: `m${n}`,
    item_id: "a",
    itemNombre: "Caribe 550",
    tipo: "venta",
    cantidad: -1,
    stock_resultante: 0,
    motivo: null,
    referencia: null,
    anula_a: null,
    creado_por: "u1",
    creado_at: new Date().toISOString(),
    anulado: false,
    creadorNombre: "Ana",
    ...o,
  };
}

describe("MovimientosPage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    listarMovimientosGeneral.mockReset();
  });

  it("muestra quién hizo cada movimiento, las métricas y cuándo se agotó lo que está sin stock", async () => {
    listarMovimientosGeneral.mockResolvedValue({
      movimientos: [
        mov({ tipo: "venta", cantidad: -1, stock_resultante: 0, creadorNombre: "Beto" }),
        mov({ tipo: "ingreso", cantidad: 3, stock_resultante: 1, creadorNombre: "Ana" }),
        mov({ item_id: "b", itemNombre: "Racionalista 400", tipo: "ingreso", cantidad: 2, stock_resultante: 2, creadorNombre: "Ana" }),
      ],
      truncado: false,
      error: null,
    });
    render(<MovimientosPage />);

    expect(await screen.findByText("Registro")).toBeInTheDocument();
    const registro = screen.getAllByRole("list").at(-1)!;
    expect(within(registro).getAllByRole("listitem")).toHaveLength(3);
    expect(within(registro).getAllByText(/Beto/).length).toBeGreaterThan(0);
    expect(screen.getByText("Vendidas").nextSibling).toHaveTextContent("1");
    expect(screen.getByText("Ingresadas").nextSibling).toHaveTextContent("5");
    expect(screen.getByText("Sin stock ahora: cuándo se agotaron")).toBeInTheDocument();
  });

  it("filtra por tipo de movimiento", async () => {
    listarMovimientosGeneral.mockResolvedValue({
      movimientos: [mov({ tipo: "venta" }), mov({ tipo: "ingreso", cantidad: 2, stock_resultante: 2 })],
      truncado: false,
      error: null,
    });
    const user = userEvent.setup();
    render(<MovimientosPage />);
    await screen.findByText("Registro");

    await user.click(screen.getByRole("button", { name: "Ingresos" }));
    const registro = screen.getAllByRole("list").at(-1)!;
    expect(within(registro).getAllByRole("listitem")).toHaveLength(1);
  });

  it("sin movimientos en el período lo dice, y un error de lectura se avisa", async () => {
    listarMovimientosGeneral.mockResolvedValue({ movimientos: [], truncado: false, error: null });
    const { unmount } = render(<MovimientosPage />);
    expect(await screen.findByText("No hay movimientos en este período.")).toBeInTheDocument();
    unmount();

    listarMovimientosGeneral.mockResolvedValue({ movimientos: null, truncado: false, error: "No se pudieron leer los movimientos." });
    render(<MovimientosPage />);
    expect(await screen.findByText("No se pudieron leer los movimientos.")).toBeInTheDocument();
  });
});
