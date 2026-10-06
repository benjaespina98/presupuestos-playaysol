// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ItemCatalogo } from "@/lib/domain/catalogo/item";
import { CATEGORIAS } from "@/lib/domain/catalogo/categorias";
import CatalogoPage from "./page";

const { listarItemsCatalogo, actualizarItemCatalogo, crearItemCatalogo, eliminarItemCatalogo } = vi.hoisted(() => ({
  listarItemsCatalogo: vi.fn(),
  actualizarItemCatalogo: vi.fn(),
  crearItemCatalogo: vi.fn(),
  eliminarItemCatalogo: vi.fn(),
}));
vi.mock("@/lib/catalogo", () => ({
  listarItemsCatalogo,
  actualizarItemCatalogo,
  crearItemCatalogo,
  eliminarItemCatalogo,
}));

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
    await user.click(screen.getByRole("button", { name: /^Cercos/ }));

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

describe("CatalogoPage · alta de un ítem nuevo", () => {
  beforeEach(() => {
    crearItemCatalogo.mockReset();
  });

  it("crear un ítem lo agrega al listado con feedback de éxito", async () => {
    listarItemsCatalogo.mockResolvedValue({
      items: [item({ id: "a", descripcion: "Luces LED" })],
      error: null,
    });
    crearItemCatalogo.mockResolvedValue({
      item: item({ id: "nuevo", clave: "cerco_reforzado", descripcion: "Cerco reforzado" }),
      error: null,
    });
    const user = userEvent.setup();
    render(<CatalogoPage />);
    await screen.findAllByText("Luces LED");

    await user.click(screen.getByRole("button", { name: "Agregar ítem" }));
    await user.type(await screen.findByLabelText("Clave"), "Cerco Reforzado");
    await user.type(screen.getByLabelText("Descripción"), "Cerco reforzado");
    await user.click(screen.getByRole("button", { name: "Agregar al catálogo" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getAllByText("Cerco reforzado")[0]).toBeInTheDocument();
    expect(await screen.findByText('Se agregó "Cerco reforzado".')).toBeInTheDocument();
  });

  it("en modo consulta rápida no se puede dar de alta un ítem nuevo", async () => {
    listarItemsCatalogo.mockResolvedValue({ items: [], error: null });
    const user = userEvent.setup();
    render(<CatalogoPage />);
    await user.click(screen.getByLabelText("Modo consulta rápida"));

    expect(screen.queryByRole("button", { name: "Agregar ítem" })).not.toBeInTheDocument();
  });
});

describe("CatalogoPage · dar de baja/reactivar rápido", () => {
  beforeEach(() => {
    actualizarItemCatalogo.mockReset();
  });

  it("el listado no tiene botón de encendido: dar de baja se hace dentro de Editar", async () => {
    listarItemsCatalogo.mockResolvedValue({
      items: [item({ id: "a", descripcion: "Luces LED", precio: 240000, categoria: "Iluminación", activo: true })],
      error: null,
    });
    render(<CatalogoPage />);
    await screen.findAllByText("Luces LED");

    expect(screen.queryByRole("button", { name: /Dar de baja/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reactivar/ })).not.toBeInTheDocument();
  });

  it("dar de baja desde la edición guarda activo:false y lo saca del listado", async () => {
    listarItemsCatalogo.mockResolvedValue({
      items: [item({ id: "a", descripcion: "Luces LED", precio: 240000, categoria: "Iluminación", activo: true })],
      error: null,
    });
    actualizarItemCatalogo.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<CatalogoPage />);
    await screen.findAllByText("Luces LED");

    await user.click(screen.getAllByRole("button", { name: /Editar/ })[0]);
    await user.click(await screen.findByLabelText("Activo"));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(actualizarItemCatalogo).toHaveBeenCalledWith("a", expect.objectContaining({ activo: false, precio: 240000 }))
    );
    // Sin "Mostrar dados de baja" tildado, desaparece del listado.
    await waitFor(() => expect(screen.queryByText("Luces LED")).not.toBeInTheDocument());
  });

  it("eliminar desde la edición lo saca del listado y avisa", async () => {
    listarItemsCatalogo.mockResolvedValue({
      items: [item({ id: "a", descripcion: "Luces LED" }), item({ id: "b", descripcion: "Kit de limpieza" })],
      error: null,
    });
    eliminarItemCatalogo.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<CatalogoPage />);
    await screen.findAllByText("Luces LED");

    // El listado va ordenado alfabéticamente: "Kit de limpieza" queda primero.
    await user.click(screen.getAllByRole("button", { name: /Editar/ })[0]);
    await user.click(await screen.findByRole("button", { name: "Eliminar ítem" }));
    await user.click(screen.getByRole("button", { name: "Sí, eliminar" }));

    await waitFor(() => expect(eliminarItemCatalogo).toHaveBeenCalledWith("b"));
    await waitFor(() => expect(screen.queryByText("Kit de limpieza")).not.toBeInTheDocument());
    expect(screen.getAllByText("Luces LED")[0]).toBeInTheDocument();
    expect(await screen.findByText('Se eliminó "Kit de limpieza".')).toBeInTheDocument();
  });
});

describe("CatalogoPage · las 9 categorías", () => {
  beforeEach(() => {
    actualizarItemCatalogo.mockReset();
  });

  it("el filtro por categoría ofrece exactamente las 9 acordadas en Fase 2 (con ítems en cada una)", async () => {
    listarItemsCatalogo.mockResolvedValue({
      items: CATEGORIAS.map((c, i) => item({ id: String(i), clave: "k" + i, descripcion: "Ítem " + c, categoria: c })),
      error: null,
    });
    render(<CatalogoPage />);
    const grupo = await screen.findByRole("group", { name: "Filtrar por categoría" });

    const chips = within(grupo)
      .getAllByRole("button")
      .map((b) => b.textContent?.replace(/\d+$/, ""));

    expect(chips).toEqual(["Todas", ...CATEGORIAS]);
  });

  it("los chips muestran sólo las categorías que tienen ítems, con su contador", async () => {
    listarItemsCatalogo.mockResolvedValue({
      items: [
        item({ id: "a", descripcion: "Uno", categoria: "Cercos" }),
        item({ id: "b", descripcion: "Dos", categoria: "Cercos" }),
        item({ id: "c", descripcion: "Tres", categoria: "Piscinas" }),
      ],
      error: null,
    });
    render(<CatalogoPage />);
    const grupo = await screen.findByRole("group", { name: "Filtrar por categoría" });

    expect(within(grupo).getByRole("button", { name: /^Todass*3$/ })).toBeInTheDocument();
    expect(within(grupo).getByRole("button", { name: /^Cercoss*2$/ })).toBeInTheDocument();
    expect(within(grupo).getByRole("button", { name: /^Piscinass*1$/ })).toBeInTheDocument();
    expect(within(grupo).queryByRole("button", { name: /Mano de obra/ })).not.toBeInTheDocument();
  });

  it("filtra por calculadora y 'Limpiar filtros' lo deja todo como estaba", async () => {
    listarItemsCatalogo.mockResolvedValue({
      items: [
        item({ id: "a", tipo: "piscinas", descripcion: "De piscinas" }),
        item({ id: "b", tipo: "cercos", descripcion: "De cercos" }),
      ],
      error: null,
    });
    const user = userEvent.setup();
    render(<CatalogoPage />);
    await screen.findAllByText("De piscinas");

    await user.selectOptions(screen.getByLabelText("Filtrar por calculadora"), "cercos");
    await waitFor(() => expect(screen.queryByText("De piscinas")).not.toBeInTheDocument());
    expect(screen.getAllByText("De cercos")[0]).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(screen.getAllByText("De piscinas")[0]).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpiar filtros" })).not.toBeInTheDocument();
  });

  it("hay un botón que abre la planilla de costos en Drive en otra pestaña", async () => {
    listarItemsCatalogo.mockResolvedValue({ items: [], error: null });
    render(<CatalogoPage />);

    const link = await screen.findByRole("link", { name: /Planilla de costos/ });
    expect(link).toHaveAttribute("href", expect.stringContaining("docs.google.com/spreadsheets"));
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
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
