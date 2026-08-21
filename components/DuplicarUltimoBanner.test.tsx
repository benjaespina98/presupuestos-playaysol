// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Presupuesto } from "@/lib/presupuestos";
import { DuplicarUltimoBanner } from "./DuplicarUltimoBanner";

const { obtenerUltimoPresupuesto } = vi.hoisted(() => ({ obtenerUltimoPresupuesto: vi.fn() }));
vi.mock("@/lib/presupuestos", () => ({ obtenerUltimoPresupuesto }));

function presupuesto(overrides: Partial<Presupuesto>): Presupuesto {
  return {
    id: "abc-123",
    tipo: "cercos",
    cliente_nombre: "Gómez, Martín",
    datos: {},
    created_by: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("DuplicarUltimoBanner", () => {
  it("no muestra nada mientras no hay un presupuesto previo de ese tipo", async () => {
    obtenerUltimoPresupuesto.mockResolvedValue(null);
    render(<DuplicarUltimoBanner tipo="cercos" tipoLabel="Cerco perimetral" />);

    await waitFor(() => expect(obtenerUltimoPresupuesto).toHaveBeenCalledWith("cercos"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("ofrece duplicar el último, con el cliente y hace cuánto", async () => {
    obtenerUltimoPresupuesto.mockResolvedValue(presupuesto({ id: "xyz-9", cliente_nombre: "Pérez, Juan" }));
    render(<DuplicarUltimoBanner tipo="cercos" tipoLabel="Cerco perimetral" />);

    expect(await screen.findByText(/Pérez, Juan/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Duplicar el último" });
    expect(link).toHaveAttribute("href", "?duplicar=xyz-9");
  });

  it("se puede descartar y no vuelve a aparecer", async () => {
    const user = userEvent.setup();
    obtenerUltimoPresupuesto.mockResolvedValue(presupuesto({}));
    render(<DuplicarUltimoBanner tipo="cercos" tipoLabel="Cerco perimetral" />);

    await screen.findByRole("status");
    await user.click(screen.getByRole("button", { name: "Descartar sugerencia" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("sin nombre de cliente cargado, muestra 'Sin nombre' en vez de dejarlo vacío", async () => {
    obtenerUltimoPresupuesto.mockResolvedValue(presupuesto({ cliente_nombre: "" }));
    render(<DuplicarUltimoBanner tipo="piscinas" tipoLabel="Piscina" />);

    expect(await screen.findByText(/Sin nombre/)).toBeInTheDocument();
  });
});
