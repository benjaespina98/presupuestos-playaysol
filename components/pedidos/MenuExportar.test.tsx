// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MenuExportar } from "./MenuExportar";

describe("MenuExportar · siempre sin precios", () => {
  it("no ofrece precios y avisa que sale sin precios ni teléfonos", async () => {
    const onExportar = vi.fn();
    const user = userEvent.setup();
    render(<MenuExportar onExportar={onExportar} variosProveedores />);

    await user.click(screen.getByLabelText("Exportar"));
    expect(screen.queryByRole("button", { name: /Con precios/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Sin precios ni teléfonos: listo para mandarle al proveedor/)).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: /PDF — todo junto/ }));
    expect(onExportar).toHaveBeenCalledWith("pdf", "junto");
  });

  it("exporta Excel y CSV", async () => {
    const onExportar = vi.fn();
    const onCsv = vi.fn();
    const user = userEvent.setup();
    render(<MenuExportar onExportar={onExportar} onCsv={onCsv} variosProveedores={false} />);

    await user.click(screen.getByLabelText("Exportar"));
    await user.click(screen.getByRole("menuitem", { name: /Excel — todo junto/ }));
    expect(onExportar).toHaveBeenCalledWith("xlsx", "junto");
    await user.click(screen.getByLabelText("Exportar"));
    await user.click(screen.getByRole("menuitem", { name: /CSV simple/ }));
    expect(onCsv).toHaveBeenCalledTimes(1);
  });
});
