// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EncabezadoPagina } from "./EncabezadoPagina";
import { VolverArriba } from "./VolverArriba";

describe("EncabezadoPagina", () => {
  it("deja el título y la ayuda para los lectores de pantalla (lo visible lo dicen el menú y la barra de herramientas)", () => {
    render(<EncabezadoPagina titulo="Materiales" descripcion="Lo que se compra para las obras." />);
    expect(screen.getByRole("heading", { level: 1, name: "Materiales" })).toBeInTheDocument();
    expect(screen.getByText("Lo que se compra para las obras.")).toBeInTheDocument();
  });
});

describe("VolverArriba", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  });

  const scrollear = (y: number) =>
    act(() => {
      Object.defineProperty(window, "scrollY", { configurable: true, value: y });
      fireEvent.scroll(window);
    });

  it("no aparece al bajar; aparece al SUBIR pasado el umbral (así no queda quieta encima de un botón)", () => {
    render(<VolverArriba umbral={500} />);
    expect(screen.queryByRole("button", { name: "Volver arriba" })).not.toBeInTheDocument();

    scrollear(900); // bajando
    expect(screen.queryByRole("button", { name: "Volver arriba" })).not.toBeInTheDocument();

    scrollear(800); // subiendo
    expect(screen.getByRole("button", { name: "Volver arriba" })).toBeInTheDocument();
  });

  it("no aparece al subir cerca del principio, y se va sola a los 2,5 segundos", () => {
    vi.useFakeTimers();
    render(<VolverArriba umbral={500} />);
    scrollear(450);
    scrollear(300);
    expect(screen.queryByRole("button", { name: "Volver arriba" })).not.toBeInTheDocument();

    scrollear(1200);
    scrollear(1100);
    expect(screen.getByRole("button", { name: "Volver arriba" })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(screen.queryByRole("button", { name: "Volver arriba" })).not.toBeInTheDocument();
  });

  it("al tocarlo vuelve al principio con scroll suave", () => {
    const scrollTo = vi.fn();
    vi.spyOn(window, "scrollTo").mockImplementation(scrollTo);
    render(<VolverArriba umbral={500} />);
    scrollear(1200);
    scrollear(1100);

    fireEvent.click(screen.getByRole("button", { name: "Volver arriba" }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });

    scrollear(0);
    expect(screen.queryByRole("button", { name: "Volver arriba" })).not.toBeInTheDocument();
  });
});
