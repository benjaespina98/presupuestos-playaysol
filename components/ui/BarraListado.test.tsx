// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Interruptor, MenuSeleccion, Toast } from "./BarraListado";

describe("MenuSeleccion", () => {
  const opciones = [
    { id: "todos", etiqueta: "Todos", cantidad: 4 },
    { id: "negativo", etiqueta: "Stock negativo", cantidad: 1, tono: "aviso" as const, descripcion: "Se vendió más de lo cargado" },
    { id: "vacio", etiqueta: "Sin nada", cantidad: 0 },
  ];
  function Caja({ alCambiar }: { alCambiar: (v: string) => void }) {
    const [v, setV] = useState("todos");
    return (
      <MenuSeleccion
        etiqueta="Filtrar por stock"
        titulo="Stock"
        opciones={opciones}
        valor={v}
        porDefecto="todos"
        onCambio={(x) => {
          setV(x);
          alCambiar(x);
        }}
      />
    );
  }

  it("muestra el título y la opción actual, abre una lista con contadores y cierra al elegir", async () => {
    const alCambiar = vi.fn();
    const user = userEvent.setup();
    render(<Caja alCambiar={alCambiar} />);
    const boton = screen.getByRole("button", { name: "Filtrar por stock" });
    expect(boton).toHaveTextContent("Stock: Todos");

    await user.click(boton);
    const lista = await screen.findByRole("radiogroup", { name: "Filtrar por stock" });
    expect(within(lista).getByRole("radio", { name: /Todos.*4/ })).toBeChecked();
    expect(within(lista).getByRole("radio", { name: /Stock negativo.*1/ })).toBeInTheDocument();
    expect(within(lista).getByText("Se vendió más de lo cargado")).toBeInTheDocument();

    await user.click(within(lista).getByRole("radio", { name: /Stock negativo/ }));
    expect(alCambiar).toHaveBeenCalledWith("negativo");
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filtrar por stock" })).toHaveTextContent("Stock: Stock negativo");
  });

  it("se cierra con Escape", async () => {
    const user = userEvent.setup();
    render(<Caja alCambiar={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Filtrar por stock" }));
    expect(await screen.findByRole("radiogroup")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });
});

describe("Interruptor", () => {
  it("es un checkbox real con su etiqueta", async () => {
    const alCambiar = vi.fn();
    const user = userEvent.setup();
    render(
      <Interruptor checked={false} onChange={alCambiar}>
        Mostrar desactivados
      </Interruptor>
    );
    await user.click(screen.getByLabelText("Mostrar desactivados"));
    expect(alCambiar).toHaveBeenCalledWith(true);
  });
});

describe("Toast", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("avisa y se va solo a los 5 segundos", () => {
    const onCerrar = vi.fn();
    render(<Toast mensaje='Se guardó "Cemento".' onCerrar={onCerrar} />);
    expect(screen.getByRole("status")).toHaveTextContent('Se guardó "Cemento".');
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it("sin mensaje no muestra nada", () => {
    render(<Toast mensaje={null} onCerrar={() => {}} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
