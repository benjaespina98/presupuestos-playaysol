// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventoActividad } from "@/lib/domain/actividad/evento";
import ActividadPage from "./page";

const { listarActividad } = vi.hoisted(() => ({ listarActividad: vi.fn() }));
vi.mock("@/lib/actividad", () => ({ listarActividad, LIMITE_AUDITORIA: 500 }));

const ahora = () => new Date().toISOString();
const ev = (o: Partial<EventoActividad>): EventoActividad => ({
  id: "x", fecha: ahora(), area: "precios", titulo: "Cambió el precio de «Lona premium»", detalle: "$ 1 → $ 2", quien: "Ana", sistema: false, ...o,
});

describe("ActividadPage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    listarActividad.mockReset();
  });

  it("una fila por hecho, con qué se hizo, quién y el detalle; lo del Sistema va marcado", async () => {
    listarActividad.mockResolvedValue({
      eventos: [ev({ id: "1" }), ev({ id: "2", area: "stock", titulo: "Abrió el stock de Caribe 550 (+2)", quien: "Sistema", sistema: true, detalle: null })],
      truncado: false,
      error: null,
    });
    render(<ActividadPage />);

    expect(await screen.findByText("Cambió el precio de «Lona premium»")).toBeInTheDocument();
    const lista = screen.getAllByRole("list").at(-1)!;
    expect(within(lista).getAllByRole("listitem")).toHaveLength(2);
    expect(within(lista).getAllByText("Ana").length).toBeGreaterThan(0);
    expect(within(lista).getAllByText("Sistema")).toHaveLength(1);
    expect(screen.getByText("$ 1 → $ 2")).toBeInTheDocument();
  });

  it("el buscador filtra los hechos y se puede limpiar", async () => {
    listarActividad.mockResolvedValue({ eventos: [ev({ id: "1" }), ev({ id: "2", titulo: "Abrió el stock de Caribe 550", area: "stock", detalle: null })], truncado: false, error: null });
    const user = userEvent.setup();
    render(<ActividadPage />);
    await screen.findByText("Abrió el stock de Caribe 550");

    await user.type(screen.getByLabelText("Buscar en la actividad"), "caribe");
    expect(screen.queryByText("Cambió el precio de «Lona premium»")).not.toBeInTheDocument();
    expect(screen.getByText("Abrió el stock de Caribe 550")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Buscar en la actividad"), "zzz");
    expect(await screen.findByText("No hay actividad con estos filtros.")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Limpiar filtros" }).at(-1)!);
    expect(await screen.findByText("Cambió el precio de «Lona premium»")).toBeInTheDocument();
  });

  it("avisa si todavía no hay actividad y si falla la lectura", async () => {
    listarActividad.mockResolvedValue({ eventos: [], truncado: false, error: null });
    const { unmount } = render(<ActividadPage />);
    expect(await screen.findByText("Todavía no hay actividad.")).toBeInTheDocument();
    unmount();

    listarActividad.mockResolvedValue({ eventos: null, truncado: false, error: "No se pudo leer la actividad. Probá de nuevo." });
    render(<ActividadPage />);
    expect(await screen.findByText("No se pudo leer la actividad. Probá de nuevo.")).toBeInTheDocument();
  });
});
