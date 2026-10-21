// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnularDialog } from "./AnularDialog";

function montar(onConfirmar = vi.fn().mockResolvedValue(null), onCancel = vi.fn()) {
  render(<AnularDialog open titulo="Anular presupuesto" mensaje="Vas a anular." onConfirmar={onConfirmar} onCancel={onCancel} />);
  return { onConfirmar, onCancel };
}

describe("AnularDialog", () => {
  it("no se muestra cerrado", () => {
    render(<AnularDialog open={false} titulo="x" mensaje="y" onConfirmar={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("sin motivo no confirma y explica por qué", async () => {
    const { onConfirmar } = montar();
    await userEvent.click(screen.getByRole("button", { name: "Anular" }));
    expect(onConfirmar).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/motivo/i);
  });

  it("un motivo de sólo espacios o demasiado corto tampoco sirve", async () => {
    const { onConfirmar } = montar();
    await userEvent.type(screen.getByLabelText(/motivo de la anulación/i), "  a ");
    await userEvent.click(screen.getByRole("button", { name: "Anular" }));
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it("con motivo válido lo manda recortado", async () => {
    const { onConfirmar } = montar();
    await userEvent.type(screen.getByLabelText(/motivo de la anulación/i), "  Duplicado  ");
    await userEvent.click(screen.getByRole("button", { name: "Anular" }));
    expect(onConfirmar).toHaveBeenCalledWith("Duplicado");
  });

  it("si la base lo rechaza, queda abierto con el mensaje", async () => {
    const onConfirmar = vi.fn().mockResolvedValue("No se pudo anular: lo creó otra persona.");
    montar(onConfirmar);
    await userEvent.type(screen.getByLabelText(/motivo de la anulación/i), "Duplicado");
    await userEvent.click(screen.getByRole("button", { name: "Anular" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/lo creó otra persona/);
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });

  it("cancelar avisa y no confirma", async () => {
    const { onConfirmar, onCancel } = montar();
    await userEvent.click(screen.getByRole("button", { name: "No, conservarlo" }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirmar).not.toHaveBeenCalled();
  });
});
