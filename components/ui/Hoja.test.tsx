// @vitest-environment jsdom
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Hoja } from "./Hoja";

function ConBoton({ onCerrar = () => {} }: { onCerrar?: () => void }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAbierta(true)}>
        Abrir
      </button>
      {abierta && (
        <Hoja
          titulo="Hoja"
          onCerrar={() => {
            onCerrar();
            setAbierta(false);
          }}
          pie={<button type="button">Guardar</button>}
        >
          <input aria-label="Campo" />
        </Hoja>
      )}
    </>
  );
}

describe("Hoja", () => {
  it("al abrir el foco entra a la hoja y al cerrar vuelve al botón que la abrió", async () => {
    const user = userEvent.setup();
    render(<ConBoton />);
    const abrir = screen.getByRole("button", { name: "Abrir" });
    await user.click(abrir);

    expect(screen.getByRole("dialog", { name: "Hoja" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(abrir).toHaveFocus();
  });

  it("un campo con autoFocus se queda con el foco", () => {
    render(
      <Hoja titulo="Hoja" onCerrar={() => {}}>
        <input aria-label="Campo" autoFocus />
      </Hoja>
    );
    expect(screen.getByLabelText("Campo")).toHaveFocus();
  });

  it("Escape cierra sólo la hoja de arriba cuando una hoja abre otra", async () => {
    const user = userEvent.setup();
    const cerrarAbajo = vi.fn();
    const cerrarArriba = vi.fn();
    function ConHojaArriba() {
      const [arriba, setArriba] = useState(false);
      return (
        <Hoja titulo="Abajo" onCerrar={cerrarAbajo}>
          <button type="button" onClick={() => setArriba(true)}>
            Ver más
          </button>
          {arriba && (
            <Hoja titulo="Arriba" onCerrar={cerrarArriba}>
              contenido
            </Hoja>
          )}
        </Hoja>
      );
    }
    render(<ConHojaArriba />);
    await user.click(screen.getByRole("button", { name: "Ver más" }));

    await user.keyboard("{Escape}");

    expect(cerrarArriba).toHaveBeenCalledTimes(1);
    expect(cerrarAbajo).not.toHaveBeenCalled();
  });

  it("con cambios sin guardar, Escape pregunta antes de cerrar", async () => {
    const user = userEvent.setup();
    const cerrar = vi.fn();
    render(
      <Hoja titulo="Hoja" hayCambios onCerrar={cerrar} pie={<button type="button">Guardar</button>}>
        contenido
      </Hoja>
    );

    await user.keyboard("{Escape}");

    expect(cerrar).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog", { name: "Cambios sin guardar" })).toBeInTheDocument();
  });
});
