// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MenuExportar } from "./MenuExportar";

describe("MenuExportar · con o sin precios", () => {
  it("por defecto es SIN precios (lo que se le manda al proveedor)", async () => {
    const onExportar = vi.fn();
    const user = userEvent.setup();
    render(<MenuExportar onExportar={onExportar} variosProveedores />);

    await user.click(screen.getByLabelText("Exportar"));
    const grupo = screen.getByRole("group", { name: "Precios en el archivo" });
    expect(within(grupo).getByRole("button", { name: /Sin precios/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Sin precios ni totales: listo para mandarle al proveedor/)).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: /PDF — todo junto/ }));
    expect(onExportar).toHaveBeenCalledWith("pdf", "junto", false);
  });

  it("'Con precios' avisa que son tentativos y exporta con precios", async () => {
    const onExportar = vi.fn();
    const onCsv = vi.fn();
    const user = userEvent.setup();
    render(<MenuExportar onExportar={onExportar} onCsv={onCsv} variosProveedores={false} />);

    await user.click(screen.getByLabelText("Exportar"));
    await user.click(screen.getByRole("button", { name: /Con precios/ }));
    expect(screen.getByText(/Los precios son tentativos/)).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: /Excel — todo junto/ }));
    expect(onExportar).toHaveBeenCalledWith("xlsx", "junto", true);
    await user.click(screen.getByLabelText("Exportar"));
    await user.click(screen.getByRole("menuitem", { name: /CSV simple/ }));
    expect(onCsv).toHaveBeenCalledWith(true);
  });
});
