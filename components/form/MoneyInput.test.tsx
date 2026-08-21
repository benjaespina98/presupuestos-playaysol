// @vitest-environment jsdom
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MoneyInput } from "./MoneyInput";

/**
 * Arnés mínimo: MoneyInput es controlado, así que un test tiene que jugar el
 * papel de "el form" y sostener el estado, igual que haría React Hook Form.
 */
function Arnes({
  inicial = null,
  emptyValue,
  onValueChange,
}: {
  inicial?: number | null;
  emptyValue?: "null" | "zero";
  onValueChange?: (v: number | null) => void;
}) {
  const [valor, setValor] = useState<number | null>(inicial);
  return (
    <MoneyInput
      value={valor}
      onValueChange={(v) => {
        setValor(v);
        onValueChange?.(v);
      }}
      emptyValue={emptyValue}
      aria-label="importe"
    />
  );
}

describe("MoneyInput · casos mínimos del plan de Fase 3", () => {
  it("vacío → null", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Arnes inicial={1500} onValueChange={onValueChange} />);
    const input = screen.getByRole("textbox", { name: "importe" });

    await user.clear(input);

    expect(onValueChange).toHaveBeenLastCalledWith(null);
  });

  it("cero → 0", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Arnes onValueChange={onValueChange} />);
    const input = screen.getByRole("textbox", { name: "importe" });

    await user.type(input, "0");

    expect(onValueChange).toHaveBeenLastCalledWith(0);
  });

  it("$ 1.500 → 1500", async () => {
    const onValueChange = vi.fn();
    render(<Arnes onValueChange={onValueChange} />);
    const input = screen.getByRole("textbox", { name: "importe" }) as HTMLInputElement;

    // Pegado, no tipeado tecla por tecla: simula un paste real.
    await userEvent.setup().click(input);
    await userEvent.setup().paste("$ 1.500");

    expect(onValueChange).toHaveBeenLastCalledWith(1500);
  });

  it("$ 1.500.000 → 1500000", async () => {
    const onValueChange = vi.fn();
    render(<Arnes onValueChange={onValueChange} />);
    const input = screen.getByRole("textbox", { name: "importe" }) as HTMLInputElement;

    await userEvent.setup().click(input);
    await userEvent.setup().paste("$ 1.500.000");

    expect(onValueChange).toHaveBeenLastCalledWith(1500000);
  });

  it("valores válidos durante la edición", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Arnes onValueChange={onValueChange} />);
    const input = screen.getByRole("textbox", { name: "importe" });

    await user.type(input, "1500");

    expect(onValueChange).toHaveBeenLastCalledWith(1500);
    expect(input).toHaveValue("1500");
  });

  it("borrar el contenido deja el campo vacío en pantalla", async () => {
    const user = userEvent.setup();
    render(<Arnes inicial={1500} />);
    const input = screen.getByRole("textbox", { name: "importe" });

    await user.clear(input);

    expect(input).toHaveValue("");
  });

  it("formatea al perder el foco", async () => {
    const user = userEvent.setup();
    render(<Arnes />);
    const input = screen.getByRole("textbox", { name: "importe" });

    await user.type(input, "1500000");
    expect(input).toHaveValue("1500000");

    await user.tab();

    expect(input).toHaveValue("$ 1.500.000");
  });

  it("no reformatea mientras el campo tiene foco", async () => {
    const user = userEvent.setup();
    render(<Arnes inicial={1500} />);
    const input = screen.getByRole("textbox", { name: "importe" });

    // Antes de tocarlo se ve formateado.
    expect(input).toHaveValue("$ 1.500");

    await user.click(input);
    // Foco puesto pero sin editar todavía: el texto no debería mutar solo.
    expect(input).toHaveValue("$ 1.500");
  });

  it("no destruye la posición del cursor mientras se escribe", async () => {
    const user = userEvent.setup();
    render(<Arnes />);
    const input = screen.getByRole("textbox", { name: "importe" }) as HTMLInputElement;

    await user.click(input);
    await user.keyboard("15003");
    input.setSelectionRange(2, 2);
    await user.keyboard("9");

    // "15" + "9" + "003" = "159003": el 9 se insertó donde estaba el cursor,
    // no al final ni reformateado con separadores.
    expect(input).toHaveValue("159003");
  });

  it("emptyValue='zero': vacío da 0, no null", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Arnes inicial={1500} emptyValue="zero" onValueChange={onValueChange} />);
    const input = screen.getByRole("textbox", { name: "importe" });

    await user.clear(input);

    expect(onValueChange).toHaveBeenLastCalledWith(0);
  });
});
