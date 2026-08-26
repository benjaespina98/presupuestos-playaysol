// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccionesDocumento } from "./AccionesDocumento";

function props(overrides: Partial<React.ComponentProps<typeof AccionesDocumento>> = {}) {
  return {
    errorGuardado: null,
    guardadoOk: false,
    errorWord: null,
    errorPdf: null,
    guardando: false,
    generandoWord: false,
    generandoPdf: false,
    onDescargarWord: vi.fn(),
    onGenerarPdf: vi.fn(),
    ...overrides,
  };
}

describe("AccionesDocumento", () => {
  it("Guardar es un botón submit, Word/PDF son type=button", () => {
    render(<AccionesDocumento {...props()} />);
    expect(screen.getByRole("button", { name: "Guardar en la nube" })).toHaveAttribute("type", "submit");
    expect(screen.getByRole("button", { name: "Word" })).toHaveAttribute("type", "button");
    expect(screen.getByRole("button", { name: "PDF" })).toHaveAttribute("type", "button");
  });

  it("llama a onDescargarWord / onGenerarPdf al clickear", async () => {
    const user = userEvent.setup();
    const onDescargarWord = vi.fn();
    const onGenerarPdf = vi.fn();
    render(<AccionesDocumento {...props({ onDescargarWord, onGenerarPdf })} />);

    await user.click(screen.getByRole("button", { name: "Word" }));
    await user.click(screen.getByRole("button", { name: "PDF" }));

    expect(onDescargarWord).toHaveBeenCalledTimes(1);
    expect(onGenerarPdf).toHaveBeenCalledTimes(1);
  });

  it("muestra el error de guardado, el éxito, el error de Word y el de PDF cuando corresponde", () => {
    const { rerender } = render(<AccionesDocumento {...props({ errorGuardado: "sin conexión" })} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo guardar: sin conexión");

    rerender(<AccionesDocumento {...props({ guardadoOk: true })} />);
    expect(screen.getByRole("status")).toHaveTextContent("Presupuesto guardado en la nube.");

    rerender(<AccionesDocumento {...props({ errorWord: "algo falló" })} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo generar el Word: algo falló");

    rerender(<AccionesDocumento {...props({ errorPdf: "algo falló" })} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo generar el PDF: algo falló");
  });

  it("deshabilita Guardar mientras guarda, Word mientras genera Word, y PDF mientras genera PDF", () => {
    const { rerender } = render(<AccionesDocumento {...props({ guardando: true, generandoWord: true })} />);
    expect(screen.getByRole("button", { name: "Guardando..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Generando..." })).toBeDisabled();

    rerender(<AccionesDocumento {...props({ generandoPdf: true })} />);
    expect(screen.getByRole("button", { name: "Generando..." })).toBeDisabled();
  });
});
