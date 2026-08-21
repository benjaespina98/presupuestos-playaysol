// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FloatingSaveBar } from "./FloatingSaveBar";

describe("FloatingSaveBar", () => {
  it("es un botón submit (depende de vivir dentro del <form> que lo usa)", () => {
    render(<FloatingSaveBar guardando={false} />);
    const boton = screen.getByRole("button", { name: "Guardar en la nube" });
    expect(boton).toHaveAttribute("type", "submit");
    expect(boton).not.toBeDisabled();
  });

  it("se deshabilita y cambia el texto mientras guarda", () => {
    render(<FloatingSaveBar guardando={true} />);
    expect(screen.getByRole("button", { name: "Guardando..." })).toBeDisabled();
  });

  it("acepta un label distinto", () => {
    render(<FloatingSaveBar guardando={false} label="Guardar plano" />);
    expect(screen.getByRole("button", { name: "Guardar plano" })).toBeInTheDocument();
  });
});
