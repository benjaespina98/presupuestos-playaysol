// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CatalogoTabs } from "./CatalogoTabs";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname }));

describe("CatalogoTabs", () => {
  beforeEach(() => usePathname.mockReset());

  it("muestra las cuatro secciones y marca sólo la actual", () => {
    usePathname.mockReturnValue("/dashboard/catalogo/materiales");
    render(<CatalogoTabs />);

    expect(screen.getByRole("link", { name: "Materiales" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Precios de venta" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Proveedores" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Armar pedido" })).toHaveAttribute("href", "/dashboard/catalogo/pedido");
  });

  it("'Precios de venta' es la raíz: no queda activa en las subsecciones", () => {
    usePathname.mockReturnValue("/dashboard/catalogo");
    const { unmount } = render(<CatalogoTabs />);
    expect(screen.getByRole("link", { name: "Precios de venta" })).toHaveAttribute("aria-current", "page");
    unmount();

    usePathname.mockReturnValue("/dashboard/catalogo/proveedores");
    render(<CatalogoTabs />);
    expect(screen.getByRole("link", { name: "Precios de venta" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Proveedores" })).toHaveAttribute("aria-current", "page");
  });
});
