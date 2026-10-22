// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CatalogoTabs } from "./CatalogoTabs";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname }));

describe("CatalogoTabs", () => {
  beforeEach(() => usePathname.mockReset());

  it("/pedido y /pedidos se parecen pero son pestañas distintas: nunca quedan activas las dos", () => {
    usePathname.mockReturnValue("/dashboard/catalogo/pedidos");
    const { unmount } = render(<CatalogoTabs />);
    expect(screen.getByRole("link", { name: "Pedidos" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Armar pedido" })).not.toHaveAttribute("aria-current");
    unmount();

    usePathname.mockReturnValue("/dashboard/catalogo/pedido");
    render(<CatalogoTabs />);
    expect(screen.getByRole("link", { name: "Armar pedido" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Pedidos" })).not.toHaveAttribute("aria-current");
  });

  it("en Compras muestra sus cuatro secciones y marca sólo la actual (Precios de venta es otra sección del menú)", () => {
    usePathname.mockReturnValue("/dashboard/catalogo/materiales");
    render(<CatalogoTabs />);

    expect(screen.getByRole("link", { name: "Materiales" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "Precios de venta" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Proveedores" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Armar pedido" })).toHaveAttribute("href", "/dashboard/catalogo/pedido");
  });

  it("'Precios de venta' es una sola pantalla: no lleva pestañas; en Compras sí", () => {
    usePathname.mockReturnValue("/dashboard/catalogo");
    const { container, unmount } = render(<CatalogoTabs />);
    expect(container).toBeEmptyDOMElement();
    unmount();

    usePathname.mockReturnValue("/dashboard/catalogo/proveedores");
    render(<CatalogoTabs />);
    expect(screen.queryByRole("link", { name: "Precios de venta" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Proveedores" })).toHaveAttribute("aria-current", "page");
  });
});
