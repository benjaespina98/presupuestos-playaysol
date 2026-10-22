// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BotonFiltros, Chip, ChipsFila, Interruptor, MenuSeleccion, Toast } from "./BarraListado";

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

describe("BotonFiltros", () => {
  it("muestra cuántos filtros hay activos y abre el panel con 'Limpiar filtros'", async () => {
    const onLimpiar = vi.fn();
    const user = userEvent.setup();
    render(
      <BotonFiltros contador={2} hayFiltros onLimpiar={onLimpiar}>
        <Interruptor checked={false} onChange={() => {}}>
          Mostrar desactivados
        </Interruptor>
      </BotonFiltros>
    );
    expect(screen.getByRole("button", { name: "Filtros" })).toHaveTextContent("2");
    await user.click(screen.getByRole("button", { name: "Filtros" }));
    const panel = await screen.findByRole("dialog", { name: "Filtros" });
    expect(within(panel).getByLabelText("Mostrar desactivados")).toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: "Limpiar filtros" }));
    expect(onLimpiar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: "Filtros" })).not.toBeInTheDocument();
  });

  it("sin filtros no ofrece limpiar", async () => {
    const user = userEvent.setup();
    render(<BotonFiltros contador={0} hayFiltros={false} onLimpiar={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Filtros" }));
    expect(screen.queryByRole("button", { name: "Limpiar filtros" })).not.toBeInTheDocument();
  });
});

describe("ChipsFila y Chip", () => {
  it("un chip marca si está activo y muestra su contador", () => {
    render(
      <ChipsFila etiqueta="Filtrar por rubro">
        <Chip activo onClick={() => {}} cantidad={5}>
          Áridos
        </Chip>
        <Chip activo={false} onClick={() => {}} cantidad={0}>
          PVC
        </Chip>
      </ChipsFila>
    );
    const grupo = screen.getByRole("group", { name: "Filtrar por rubro" });
    expect(within(grupo).getByRole("button", { name: /Áridos\s*5/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(grupo).getByRole("button", { name: /PVC\s*0/ })).toHaveAttribute("aria-pressed", "false");
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
