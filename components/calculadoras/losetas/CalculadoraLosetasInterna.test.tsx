// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CalculadoraLosetasInterna } from "./CalculadoraLosetasInterna";

describe("CalculadoraLosetasInterna", () => {
  it("arranca con las medidas del plano y muestra borde, planas y total con el detalle", () => {
    render(<CalculadoraLosetasInterna largoPlano={7} anchoPlano={3} />);
    const resultado = screen.getByLabelText("Resultado");
    expect(within(resultado).getByText("De borde").nextSibling).toHaveTextContent("44");
    expect(within(resultado).getByText("Planas").nextSibling).toHaveTextContent("6");
    expect(within(resultado).getByText("Total").nextSibling).toHaveTextContent("50");
    expect(screen.getByText(/Área del borde = /)).toBeInTheDocument();
  });

  it("sin medidas no calcula y lo explica; 'Usar las medidas del plano' las trae", async () => {
    render(<CalculadoraLosetasInterna largoPlano={0} anchoPlano={0} />);
    expect(screen.getByRole("status")).toHaveTextContent(/largo y el ancho/);
    expect(screen.getByRole("button", { name: "Usar las medidas del plano" })).toBeDisabled();
  });

  it("el desperdicio y la medida de la loseta se pueden cambiar", async () => {
    const user = userEvent.setup();
    render(<CalculadoraLosetasInterna largoPlano={5} anchoPlano={3} />);
    await user.clear(screen.getByLabelText("Desperdicio (%)"));
    await user.type(screen.getByLabelText("Desperdicio (%)"), "10");
    expect(within(screen.getByLabelText("Resultado")).getByText("De borde").nextSibling).toHaveTextContent("40");
  });

  it("Enter dentro de la calculadora no envía el formulario que la contiene", async () => {
    const user = userEvent.setup();
    const enviar = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={enviar}>
        <CalculadoraLosetasInterna largoPlano={5} anchoPlano={3} />
      </form>
    );
    await user.click(screen.getByLabelText("Largo exterior (m)"));
    await user.keyboard("{Enter}");
    expect(enviar).not.toHaveBeenCalled();
  });

  it("la fibra pide las medidas reales a mano", async () => {
    const user = userEvent.setup();
    render(<CalculadoraLosetasInterna largoPlano={5} anchoPlano={3} />);
    await user.click(screen.getByRole("button", { name: "Fibra" }));
    expect(screen.getByText(/medidas reales del modelo/)).toBeInTheDocument();
  });
});
