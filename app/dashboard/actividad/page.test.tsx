// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventoActividad } from "@/lib/domain/actividad/evento";
import ActividadPage from "./page";

const { listarActividad } = vi.hoisted(() => ({ listarActividad: vi.fn() }));
vi.mock("@/lib/actividad", () => ({ listarActividad, LIMITE_AUDITORIA: 500 }));

const ev = (o: Partial<EventoActividad>): EventoActividad => ({
  id: "x", fecha: "2026-11-05T10:00:00.000Z", area: "precios", titulo: "Cambió el precio de «Lona premium»", detalle: "$ 1 → $ 2", quien: "Ana", sistema: false, ...o,
});

describe("ActividadPage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    listarActividad.mockReset();
  });

  it("muestra qué se hizo, quién y cuándo, y marca lo del Sistema", async () => {
    listarActividad.mockResolvedValue({
      eventos: [ev({ id: "1" }), ev({ id: "2", area: "stock", titulo: "Abrió el stock de Caribe 550 (+2)", quien: "Sistema", sistema: true, detalle: null })],
      truncado: false,
      error: null,
    });
    render(<ActividadPage />);

    expect(await screen.findByText("Cambió el precio de «Lona premium»")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    const lista = screen.getAllByRole("list").at(-1)!;
    expect(within(lista).getAllByText("Sistema")).toHaveLength(1);
  });

  it("filtra por quién: sólo lo del Sistema", async () => {
    listarActividad.mockResolvedValue({ eventos: [ev({ id: "1" }), ev({ id: "2", titulo: "Abrió el stock", quien: "Sistema", sistema: true })], truncado: false, error: null });
    const user = userEvent.setup();
    render(<ActividadPage />);
    await screen.findByText("Abrió el stock");

    await user.click(screen.getByRole("button", { name: "Sistema" }));
    expect(screen.queryByText("Cambió el precio de «Lona premium»")).not.toBeInTheDocument();
    expect(screen.getByText("Abrió el stock")).toBeInTheDocument();
  });

  it("avisa si no hay actividad y si falla la lectura", async () => {
    listarActividad.mockResolvedValue({ eventos: [], truncado: false, error: null });
    const { unmount } = render(<ActividadPage />);
    expect(await screen.findByText("No hay actividad con estos filtros.")).toBeInTheDocument();
    unmount();

    listarActividad.mockResolvedValue({ eventos: null, truncado: false, error: "No se pudo leer la actividad. Probá de nuevo." });
    render(<ActividadPage />);
    expect(await screen.findByText("No se pudo leer la actividad. Probá de nuevo.")).toBeInTheDocument();
  });
});
