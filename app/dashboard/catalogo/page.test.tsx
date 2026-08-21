// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ItemCatalogo } from "@/lib/domain/catalogo/item";
import { CATEGORIAS } from "@/lib/domain/catalogo/categorias";
import CatalogoPage from "./page";

const { listarItemsCatalogo, actualizarItemCatalogo } = vi.hoisted(() => ({
  listarItemsCatalogo: vi.fn(),
  actualizarItemCatalogo: vi.fn(),
}));
vi.mock("@/lib/catalogo", () => ({ listarItemsCatalogo, actualizarItemCatalogo }));

const { copiarAlPortapapeles } = vi.hoisted(() => ({ copiarAlPortapapeles: vi.fn() }));
vi.mock("@/lib/clipboard", () => ({ copiarAlPortapapeles }));

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

  it("agrupa los ítems por categoría, con un encabezado por bloque", async () => {
    listarItemsCatalogo.mockResolvedValue({
      items: [
        item({ id: "a", descripcion: "Luces LED", categoria: "Iluminación" }),
        item({ id: "b", descripcion: "Cerco perimetral", categoria: "Cercos" }),
      ],
      error: null,
    });
    render(<CatalogoPage />);

    await screen.findAllByText("Luces LED");
    expect(screen.getAllByText("Iluminación")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Cercos")[0]).toBeInTheDocument();
    // Ya no se repite la categoría al lado de cada ítem individual.
    expect(screen.queryByText("Iluminación · Piscinas")).not.toBeInTheDocument();
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

  it("muestra hace cuánto se actualizó cada ítem", async () => {
    const hoy = new Date().toISOString();
    listarItemsCatalogo.mockResolvedValue({
      items: [item({ id: "a", descripcion: "Luces LED", updated_at: hoy })],
      error: null,
    });
    render(<CatalogoPage />);

    expect((await screen.findAllByText("hoy"))[0]).toBeInTheDocument();
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

describe("CatalogoPage · modo consulta rápida", () => {
  beforeEach(() => {
    copiarAlPortapapeles.mockReset();
    copiarAlPortapapeles.mockResolvedValue(true);
  });

  it("por defecto se puede editar y no hay botón Copiar", async () => {
    listarItemsCatalogo.mockResolvedValue({
      items: [item({ id: "a", descripcion: "Luces LED", precio: 240000 })],
      error: null,
    });
    render(<CatalogoPage />);

    expect((await screen.findAllByRole("button", { name: /Editar/ }))[0]).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Copiar/ })).not.toBeInTheDocument();
  });

  it("activar el modo consulta cambia Editar por Copiar y oculta el Estado", async () => {
    const user = userEvent.setup();
    listarItemsCatalogo.mockResolvedValue({
      items: [item({ id: "a", descripcion: "Luces LED", precio: 240000, unidad: "unidad" })],
      error: null,
    });
    render(<CatalogoPage />);
    await screen.findAllByText("Luces LED");

    await user.click(screen.getByLabelText("Modo consulta rápida"));

    expect(screen.queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();
    expect((await screen.findAllByRole("button", { name: /^Copiar$/ }))[0]).toBeInTheDocument();
    expect(screen.queryByText("Activo")).not.toBeInTheDocument();
  });

  it("copiar arma el texto tipo WhatsApp y lo manda al portapapeles", async () => {
    const user = userEvent.setup();
    listarItemsCatalogo.mockResolvedValue({
      items: [
        item({ id: "a", descripcion: "Cerco perimetral con instalación", precio: 79500, unidad: "ml" }),
      ],
      error: null,
    });
    render(<CatalogoPage />);
    await screen.findAllByText("Cerco perimetral con instalación");
    await user.click(screen.getByLabelText("Modo consulta rápida"));

    await user.click((await screen.findAllByRole("button", { name: /^Copiar$/ }))[0]);

    expect(copiarAlPortapapeles).toHaveBeenCalledWith("Cerco perimetral con instalación: $ 79.500/ml");
    expect((await screen.findAllByText("¡Copiado!"))[0]).toBeInTheDocument();
  });

  it("sin permiso de portapapeles, no muestra '¡Copiado!' (no hay feedback engañoso)", async () => {
    copiarAlPortapapeles.mockResolvedValue(false);
    const user = userEvent.setup();
    listarItemsCatalogo.mockResolvedValue({
      items: [item({ id: "a", descripcion: "Luces LED", precio: 240000 })],
      error: null,
    });
    render(<CatalogoPage />);
    await screen.findAllByText("Luces LED");
    await user.click(screen.getByLabelText("Modo consulta rápida"));

    await user.click((await screen.findAllByRole("button", { name: /^Copiar$/ }))[0]);

    expect(copiarAlPortapapeles).toHaveBeenCalled();
    expect(screen.queryByText("¡Copiado!")).not.toBeInTheDocument();
  });
});

describe("CatalogoPage · edición", () => {
  beforeEach(() => {
    actualizarItemCatalogo.mockReset();
  });

  it("editar un ítem, guardarlo y ver el listado actualizado con feedback de éxito", async () => {
    listarItemsCatalogo.mockResolvedValue({
      items: [item({ id: "a", descripcion: "Luces LED", precio: 240000 })],
      error: null,
    });
    actualizarItemCatalogo.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<CatalogoPage />);

    await screen.findAllByText("Luces LED");
    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);

    const precio = await screen.findByLabelText("Precio");
    await user.clear(precio);
    await user.type(precio, "300000");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    // El modal se cierra y el listado ya muestra el precio nuevo.
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getAllByText("$ 300.000")[0]).toBeInTheDocument();
    expect(await screen.findByText('Se guardó "Luces LED".')).toBeInTheDocument();
  });

  it("cancelar la edición no cambia el listado", async () => {
    listarItemsCatalogo.mockResolvedValue({
      items: [item({ id: "a", descripcion: "Luces LED", precio: 240000 })],
      error: null,
    });
    const user = userEvent.setup();
    render(<CatalogoPage />);

    await screen.findAllByText("Luces LED");
    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    await screen.findByLabelText("Precio");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getAllByText("$ 240.000")[0]).toBeInTheDocument();
    expect(actualizarItemCatalogo).not.toHaveBeenCalled();
  });

  it("editar otro campo sin tocar la categoría no se la pierde", async () => {
    listarItemsCatalogo.mockResolvedValue({
      items: [item({ id: "a", descripcion: "Luces LED", precio: 240000, categoria: "Iluminación" })],
      error: null,
    });
    actualizarItemCatalogo.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<CatalogoPage />);

    await screen.findAllByText("Luces LED");
    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    await user.clear(await screen.findByLabelText("Precio"));
    await user.type(screen.getByLabelText("Precio"), "300000");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(actualizarItemCatalogo).toHaveBeenCalled());
    expect(actualizarItemCatalogo).toHaveBeenCalledWith(
      "a",
      expect.objectContaining({ categoria: "Iluminación" })
    );
    // La columna Categoría del listado sigue mostrando la original.
    expect(screen.getAllByText("Iluminación")[0]).toBeInTheDocument();
  });
});

describe("CatalogoPage · las 9 categorías", () => {
  beforeEach(() => {
    actualizarItemCatalogo.mockReset();
  });

  it("el filtro por categoría ofrece exactamente las 9 acordadas en Fase 2", async () => {
    listarItemsCatalogo.mockResolvedValue({ items: [], error: null });
    render(<CatalogoPage />);
    await screen.findByLabelText("Filtrar por categoría");

    const opciones = screen
      .getAllByRole("option")
      .filter((o) => o.closest("select")?.getAttribute("aria-label") === "Filtrar por categoría")
      .map((o) => o.textContent);

    expect(opciones).toEqual(["Todas las categorías", ...CATEGORIAS]);
  });

  it("un ítem sin clasificar (categoria null) se lista bajo 'Otros' y puede clasificarse", async () => {
    listarItemsCatalogo.mockResolvedValue({
      items: [item({ id: "a", descripcion: "Material nuevo", categoria: null })],
      error: null,
    });
    actualizarItemCatalogo.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<CatalogoPage />);

    expect((await screen.findAllByText("Otros"))[0]).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    await user.selectOptions(await screen.findByLabelText("Categoría"), "Piscinas");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(actualizarItemCatalogo).toHaveBeenCalledWith(
        "a",
        expect.objectContaining({ categoria: "Piscinas" })
      )
    );
    expect(screen.getAllByText("Piscinas")[0]).toBeInTheDocument();
  });
});
