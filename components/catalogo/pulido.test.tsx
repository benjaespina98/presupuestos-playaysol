// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BarraFiltros } from "./BarraFiltros";
import { EncabezadoPagina } from "./EncabezadoPagina";
import { VolverArriba } from "./VolverArriba";

describe("EncabezadoPagina", () => {
  it("muestra título, ayuda y las acciones", () => {
    render(
      <EncabezadoPagina titulo="Materiales" descripcion="Lo que se compra para las obras.">
        <button type="button">Agregar material</button>
      </EncabezadoPagina>
    );
    expect(screen.getByRole("heading", { level: 1, name: "Materiales" })).toBeInTheDocument();
    expect(screen.getByText("Lo que se compra para las obras.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar material" })).toBeInTheDocument();
  });

  it("sin acciones no deja un hueco", () => {
    const { container } = render(<EncabezadoPagina titulo="Pedido" descripcion="x" />);
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });
});

describe("BarraFiltros", () => {
  afterEach(() => document.documentElement.style.removeProperty("--catalogo-barra"));

  it("publica su alto en --catalogo-barra (el encabezado de columnas se pega debajo) y lo limpia al irse", () => {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, value: 118 });
    const { unmount } = render(
      <BarraFiltros>
        <input aria-label="buscar" />
      </BarraFiltros>
    );
    expect(document.documentElement.style.getPropertyValue("--catalogo-barra")).toBe("118px");

    unmount();
    expect(document.documentElement.style.getPropertyValue("--catalogo-barra")).toBe("");
    if (original) Object.defineProperty(HTMLElement.prototype, "offsetHeight", original);
  });

  it("deja pasar su contenido", () => {
    render(
      <BarraFiltros>
        <input aria-label="buscar" />
      </BarraFiltros>
    );
    expect(screen.getByLabelText("buscar")).toBeInTheDocument();
  });
});

describe("VolverArriba", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  });

  const scrollear = (y: number) =>
    act(() => {
      Object.defineProperty(window, "scrollY", { configurable: true, value: y });
      fireEvent.scroll(window);
    });

  it("no aparece al principio de la página, y sí después de bajar un buen trecho", () => {
    render(<VolverArriba umbral={500} />);
    expect(screen.queryByRole("button", { name: "Volver arriba" })).not.toBeInTheDocument();

    scrollear(300);
    expect(screen.queryByRole("button", { name: "Volver arriba" })).not.toBeInTheDocument();

    scrollear(900);
    expect(screen.getByRole("button", { name: "Volver arriba" })).toBeInTheDocument();
  });

  it("al tocarlo vuelve al principio con scroll suave, y desaparece al llegar", () => {
    const scrollTo = vi.fn();
    vi.spyOn(window, "scrollTo").mockImplementation(scrollTo);
    render(<VolverArriba umbral={500} />);
    scrollear(900);

    fireEvent.click(screen.getByRole("button", { name: "Volver arriba" }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });

    scrollear(0);
    expect(screen.queryByRole("button", { name: "Volver arriba" })).not.toBeInTheDocument();
  });
});
