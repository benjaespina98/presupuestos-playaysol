// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ItemCatalogo } from "@/lib/domain/catalogo/item";
import CatalogoPage from "./page";

const { listarItemsCatalogo } = vi.hoisted(() => ({
  listarItemsCatalogo: vi.fn(),
}));
vi.mock("@/lib/catalogo", () => ({ listarItemsCatalogo }));

function item(overrides: Partial<ItemCatalogo>): ItemCatalogo {
  return {
    id: "id",
    tipo: "piscinas",
    clave: "clave",
    descripcion: "Un ítem",
    precio: 1000,
    categoria: null,
    unidad: null,
    activo: true,
    orden: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// La pantalla renderiza el mismo dato dos veces (tabla desktop + tarjetas
// mobile, una oculta con clases de Tailwind que jsdom no interpreta como
// layout real) — por eso todas las búsquedas de texto acá usan las variantes
// `All*` en vez de asumir una sola coincidencia.

describe("CatalogoPage · lectura", () => {
  it("muestra el skeleton mientras carga", () => {
    listarItemsCatalogo.mockReturnValue(new Promise(() => {})); // nunca resuelve
    render(<CatalogoPage />);
    expect(screen.getAllByRole("table")[0]).toBeInTheDocument();
  });

  it("lista los ítems activos una vez cargados", async () => {
    listarItemsCatalogo.mockResolvedValue({
      items: [
        item({ id: "a", descripcion: "Luces LED", precio: 240000, categoria: "Iluminación" }),
        item({ id: "b", descripcion: "Cerco perimetral", precio: 79500, categoria: "Cercos" }),
      ],
      error: null,
    });
    render(<CatalogoPage />);

    expect((await screen.findAllByText("Luces LED"))[0]).toBeInTheDocument();
    expect(screen.getAllByText("Cerco perimetral")[0]).toBeInTheDocument();
  });

  it("un precio null se muestra como 'A cotizar', no como $0", async () => {
    listarItemsCatalogo.mockResolvedValue({
      items: [item({ id: "a", descripcion: "Baño químico", precio: null })],
      error: null,
    });
    render(<CatalogoPage />);

    expect((await screen.findAllByText("A cotizar"))[0]).toBeInTheDocument();
    expect(screen.queryByText("$ 0")).not.toBeInTheDocument();
  });

  it("estado vacío cuando no hay ítems", async () => {
    listarItemsCatalogo.mockResolvedValue({ items: [], error: null });
    render(<CatalogoPage />);

    expect(await screen.findByText("Todavía no hay ítems cargados en el catálogo.")).toBeInTheDocument();
  });

  it("estado de error cuando falla la carga (por ejemplo, migración pendiente)", async () => {
    listarItemsCatalogo.mockResolvedValue({
      items: null,
      error: "El catálogo todavía no tiene las columnas de categoría/unidad/estado.",
    });
    render(<CatalogoPage />);

    expect(
      await screen.findByText("El catálogo todavía no tiene las columnas de categoría/unidad/estado.")
    ).toBeInTheDocument();
  });

  it("los inactivos quedan afuera por default, y el toggle los trae de vuelta", async () => {
    listarItemsCatalogo.mockResolvedValue({
      items: [
        item({ id: "a", descripcion: "Activo", activo: true }),
        item({ id: "b", descripcion: "Descontinuado", activo: false }),
      ],
      error: null,
    });
    const user = userEvent.setup();
    render(<CatalogoPage />);

    await screen.findAllByText("Activo");
    expect(screen.queryByText("Descontinuado")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Mostrar dados de baja"));

    expect((await screen.findAllByText("Descontinuado"))[0]).toBeInTheDocument();
  });

  it("la búsqueda filtra por descripción", async () => {
    listarItemsCatalogo.mockResolvedValue({
      items: [
        item({ id: "a", descripcion: "Luces LED" }),
        item({ id: "b", descripcion: "Cerco perimetral" }),
      ],
      error: null,
    });
    const user = userEvent.setup();
    render(<CatalogoPage />);

    await screen.findAllByText("Luces LED");
    await user.type(screen.getByLabelText("Buscar en el catálogo"), "cerco");

    await waitFor(() => expect(screen.queryByText("Luces LED")).not.toBeInTheDocument());
    expect(screen.getAllByText("Cerco perimetral")[0]).toBeInTheDocument();
  });

  it("el filtro de categoría deja solo esa categoría", async () => {
    listarItemsCatalogo.mockResolvedValue({
      items: [
        item({ id: "a", descripcion: "Luces LED", categoria: "Iluminación" }),
        item({ id: "b", descripcion: "Cerco perimetral", categoria: "Cercos" }),
      ],
      error: null,
    });
    const user = userEvent.setup();
    render(<CatalogoPage />);

    await screen.findAllByText("Luces LED");
    await user.selectOptions(screen.getByLabelText("Filtrar por categoría"), "Cercos");

    await waitFor(() => expect(screen.queryByText("Luces LED")).not.toBeInTheDocument());
    expect(screen.getAllByText("Cerco perimetral")[0]).toBeInTheDocument();
  });
});
