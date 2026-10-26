// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ItemCatalogo } from "@/lib/domain/catalogo/item";
import CatalogoPage from "./page";

const { listarItemsCatalogo, actualizarItemCatalogo, crearItemCatalogo } = vi.hoisted(() => ({
  listarItemsCatalogo: vi.fn(),
  actualizarItemCatalogo: vi.fn(),
  crearItemCatalogo: vi.fn(),
}));
vi.mock("@/lib/catalogo", () => ({
  listarItemsCatalogo,
  actualizarItemCatalogo,
  crearItemCatalogo,
}));

const { registrarMovimiento, ajustarConteo, anularMovimiento, listarMovimientos } = vi.hoisted(() => ({
  registrarMovimiento: vi.fn(),
  ajustarConteo: vi.fn(),
  anularMovimiento: vi.fn(),
  listarMovimientos: vi.fn(),
}));
vi.mock("@/lib/stock", () => ({ registrarMovimiento, ajustarConteo, anularMovimiento, listarMovimientos }));

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
    stock: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// La pantalla renderiza el mismo dato dos veces (tabla desktop + tarjetas
// mobile, una oculta con clases de Tailwind que jsdom no interpreta como
// layout real) — por eso todas las búsquedas de texto acá usan las variantes
// `All*` en vez de asumir una sola coincidencia.

/** Abre el panel "Más filtros" (con "Mostrar desactivados", "Modo consulta rápida" y "Limpiar filtros") si no está abierto. */
async function abrirFiltros(user: ReturnType<typeof userEvent.setup>) {
  if (!screen.queryByRole("dialog", { name: "Más filtros" })) await user.click(screen.getByRole("button", { name: /^Más filtros/ }));
}

/** Abre el menú de Categoría y devuelve la lista de opciones (con sus contadores). */
async function menuCategoria(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Filtrar por categoría" }));
  return screen.findByRole("radiogroup", { name: "Filtrar por categoría" });
}

async function elegirCategoria(user: ReturnType<typeof userEvent.setup>, nombre: RegExp) {
  const lista = await menuCategoria(user);
  await user.click(within(lista).getByRole("radio", { name: nombre }));
}

/** Abre el menú "⋯" de un ítem y elige una acción (Llegó mercadería, Corregir stock o Ver movimientos). */
async function accion(user: ReturnType<typeof userEvent.setup>, nombre: string, etiqueta: string) {
  await user.click(screen.getAllByRole("button", { name: `Más acciones de ${nombre}` })[0]);
  await user.click(await screen.findByRole("menuitem", { name: etiqueta }));
}

describe("CatalogoPage · lectura", () => {
  it("muestra el skeleton mientras carga", () => {
    listarItemsCatalogo.mockReturnValue(new Promise(() => {})); // nunca resuelve
    const { container } = render(<CatalogoPage />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
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
    // Cercos tiene su sección; lo que no es de ninguna cae en "Otros", por categoría.
    expect(screen.getAllByText("Otros · Iluminación")[0]).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Cercos" })[0]).toBeInTheDocument();
    // La categoría no se repite al lado de cada ítem.
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

    await abrirFiltros(user);
    await user.click(screen.getByLabelText("Mostrar desactivados"));

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
    await elegirCategoria(user, /^Cercos/);

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

    await abrirFiltros(user);
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
    await abrirFiltros(user);
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
    await abrirFiltros(user);
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
    // El bloque del listado sigue mostrando la categoría original.
    expect(screen.getAllByText("Otros · Iluminación")[0]).toBeInTheDocument();
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
    await user.type(await screen.findByLabelText("Clave (opcional)"), "Cerco Reforzado");
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
    await abrirFiltros(user);
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
    // Sin "Mostrar desactivados" tildado, desaparece del listado.
    await waitFor(() => expect(screen.queryByText("Luces LED")).not.toBeInTheDocument());
  });

  it("no se puede eliminar un ítem desde la edición: sólo desactivarlo", async () => {
    listarItemsCatalogo.mockResolvedValue({
      items: [item({ id: "a", descripcion: "Luces LED" })],
      error: null,
    });
    const user = userEvent.setup();
    render(<CatalogoPage />);
    await screen.findAllByText("Luces LED");

    await user.click(screen.getAllByRole("button", { name: /Editar/ })[0]);
    await screen.findByLabelText("Activo");

    expect(screen.queryByRole("button", { name: /eliminar/i })).not.toBeInTheDocument();
  });

  it("un ítem desactivado vuelve con 'Mostrar desactivados', lleva su etiqueta y se puede reactivar", async () => {
    listarItemsCatalogo.mockResolvedValue({
      items: [item({ id: "a", descripcion: "Luces LED", activo: false })],
      error: null,
    });
    actualizarItemCatalogo.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<CatalogoPage />);
    await waitFor(() => expect(listarItemsCatalogo).toHaveBeenCalled());
    expect(screen.queryByText("Luces LED")).not.toBeInTheDocument();

    await abrirFiltros(user);
    await user.click(screen.getByLabelText("Mostrar desactivados"));
    expect((await screen.findAllByText("Luces LED")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Desactivado").length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole("button", { name: /Editar/ })[0]);
    await user.click(await screen.findByLabelText("Activo"));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(actualizarItemCatalogo).toHaveBeenCalledWith("a", expect.objectContaining({ activo: true })));
  });
});

describe("CatalogoPage · secciones", () => {
  beforeEach(() => {
    actualizarItemCatalogo.mockReset();
  });

  it("ofrece las secciones que más se consultan como accesos directos, en este orden", async () => {
    listarItemsCatalogo.mockResolvedValue({
      items: [
        item({ id: "1", clave: "lista_hormigon_8x4", descripcion: "Hormigón 8x4" }),
        item({ id: "2", clave: "indusplast_caribe_550", descripcion: "Caribe" }),
        item({ id: "3", tipo: "cobertores", clave: "precioMenos15", descripcion: "Cobertor" }),
        item({ id: "4", tipo: "cercos", clave: "precioCon", descripcion: "Cerco" }),
        item({ id: "5", clave: "climatizacion25000", descripcion: "Clima" }),
        item({ id: "6", tipo: "revestimientos", clave: "travertino", descripcion: "Travertino" }),
        item({ id: "7", clave: "luces", descripcion: "Luces" }),
      ],
      error: null,
    });
    const user = userEvent.setup();
    render(<CatalogoPage />);
    await screen.findAllByText("Hormigón 8x4");
    const lista = await menuCategoria(user);

    const opciones = within(lista)
      .getAllByRole("radio")
      .map((r) => r.textContent?.replace(/\d+✓$/, ""));
    expect(opciones).toEqual([
      "Todas",
      "Piscinas de hormigón",
      "Piscinas de fibra Indusplast",
      "Cobertores",
      "Cercos",
      "Climatización",
      "Revestimientos",
      "Otros",
    ]);
  });

  it("los chips muestran sólo las secciones con ítems, con su contador, y filtran", async () => {
    listarItemsCatalogo.mockResolvedValue({
      items: [
        item({ id: "a", tipo: "cercos", descripcion: "Uno" }),
        item({ id: "b", tipo: "cercos", descripcion: "Dos" }),
        item({ id: "c", tipo: "cobertores", descripcion: "Tres" }),
      ],
      error: null,
    });
    const user = userEvent.setup();
    render(<CatalogoPage />);
    await screen.findAllByText("Uno");
    const lista = await menuCategoria(user);

    expect(within(lista).getByRole("radio", { name: /^Todas.*3/ })).toBeInTheDocument();
    expect(within(lista).getByRole("radio", { name: /^Cercos.*2/ })).toBeInTheDocument();
    expect(within(lista).getByRole("radio", { name: /^Cobertores.*1/ })).toBeInTheDocument();
    expect(within(lista).queryByRole("radio", { name: /Climatización/ })).not.toBeInTheDocument();

    await user.click(within(lista).getByRole("radio", { name: /^Cobertores/ }));
    expect(screen.getAllByText("Tres").length).toBeGreaterThan(0);
    expect(screen.queryByText("Uno")).not.toBeInTheDocument();
  });

  it("'Limpiar filtros' lo deja todo como estaba", async () => {
    listarItemsCatalogo.mockResolvedValue({
      items: [item({ id: "a", descripcion: "De luces" }), item({ id: "b", tipo: "cercos", descripcion: "De cercos" })],
      error: null,
    });
    const user = userEvent.setup();
    render(<CatalogoPage />);
    await screen.findAllByText("De luces");

    await elegirCategoria(user, /^Cercos/);
    await waitFor(() => expect(screen.queryByText("De luces")).not.toBeInTheDocument());

    await abrirFiltros(user);
    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(screen.getAllByText("De luces")[0]).toBeInTheDocument();
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

    expect((await screen.findAllByText("Otros · Otros"))[0]).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    await user.selectOptions(await screen.findByLabelText("Categoría"), "Piscinas");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(actualizarItemCatalogo).toHaveBeenCalledWith(
        "a",
        expect.objectContaining({ categoria: "Piscinas" })
      )
    );
    expect(screen.getAllByText("Otros · Piscinas")[0]).toBeInTheDocument();
  });
});

describe("CatalogoPage · stock", () => {
  const PISCINAS = [
    item({ id: "p1", clave: "indusplast_caribe_550", descripcion: "Caribe 550", categoria: "Piscinas", stock: 2 }),
    item({ id: "p2", clave: "indusplast_caribe_650", descripcion: "Caribe 650", categoria: "Piscinas", stock: 0 }),
    item({ id: "h1", clave: "hierro", descripcion: "Hierro del 6", categoria: "Accesorios" }),
  ];

  beforeEach(() => {
    for (const m of [registrarMovimiento, ajustarConteo, anularMovimiento, listarMovimientos]) m.mockReset();
    listarItemsCatalogo.mockResolvedValue({ items: PISCINAS, error: null });
  });

  it("muestra el stock de las piscinas y 'A pedido' en lo que no lleva stock", async () => {
    render(<CatalogoPage />);
    await screen.findAllByText("Caribe 550");

    expect(screen.getAllByTitle("2 en stock").length).toBeGreaterThan(0);
    expect(screen.getAllByTitle("sin stock").length).toBeGreaterThan(0);
    expect(screen.getAllByText("A pedido").length).toBeGreaterThan(0);
  });

  it("resume el stock del local arriba", async () => {
    render(<CatalogoPage />);
    expect(await screen.findByText(/2 unidades en 1 modelo/)).toBeInTheDocument();
    expect(screen.getByText(/Local Av\. Carranza/)).toBeInTheDocument();
  });

  it("si ningún ítem lleva stock, no aparece el resumen ni el filtro", async () => {
    listarItemsCatalogo.mockResolvedValue({ items: [PISCINAS[2]], error: null });
    render(<CatalogoPage />);
    await screen.findAllByText("Hierro del 6");
    expect(screen.queryByText(/Stock · /)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Filtrar por stock")).not.toBeInTheDocument();
  });

  const resultado = (o: Record<string, unknown>) => ({
    resultado: { movimiento_id: "m1", tipo: "ingreso", cantidad: 1, stock_resultante: 3, stock_negativo: false, repetido: false, ...o },
    error: null,
  });

  it("un ítem que lleva stock muestra Llegó mercadería, Venta, Corregir stock y Ver movimientos; uno que no, nada de eso", async () => {
    render(<CatalogoPage />);
    await screen.findAllByText("Caribe 550");

    // La acción principal (Venta) está a la vista; Llegó mercadería, Corregir stock y Ver movimientos, en el menú "⋯".
    expect(screen.getAllByRole("button", { name: "Venta de Caribe 550" }).length).toBeGreaterThan(0);
    const user = userEvent.setup();
    await user.click(screen.getAllByRole("button", { name: "Más acciones de Caribe 550" })[0]);
    expect(screen.getByRole("menuitem", { name: "Llegó mercadería" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Corregir stock" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Ver movimientos" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Más acciones de Hierro/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Venta de Hierro/ })).not.toBeInTheDocument();
  });

  it("un ingreso llama a la función con una clave y el stock pasa a lo que devuelve la base", async () => {
    registrarMovimiento.mockResolvedValue(resultado({ stock_resultante: 5, cantidad: 3 }));
    const user = userEvent.setup();
    render(<CatalogoPage />);
    await screen.findAllByText("Caribe 550");

    await accion(user, "Caribe 550", "Llegó mercadería");
    await user.type(screen.getByLabelText("Cantidad"), "3");
    await user.click(screen.getByRole("button", { name: "Registrar ingreso" }));

    await waitFor(() => expect(registrarMovimiento).toHaveBeenCalledTimes(1));
    expect(registrarMovimiento.mock.calls[0][0]).toMatchObject({ itemId: "p1", tipo: "ingreso", cantidad: 3 });
    expect(registrarMovimiento.mock.calls[0][0].idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    expect((await screen.findAllByTitle("5 en stock")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("una venta que deja el stock en negativo pide confirmación antes de registrarse", async () => {
    registrarMovimiento.mockResolvedValue(resultado({ tipo: "venta", cantidad: -5, stock_resultante: -3, stock_negativo: true }));
    const user = userEvent.setup();
    render(<CatalogoPage />);
    await screen.findAllByText("Caribe 550");

    await user.click(screen.getAllByRole("button", { name: "Venta de Caribe 550" })[0]);
    await user.type(screen.getByLabelText("Cantidad"), "5");
    await user.click(screen.getByRole("button", { name: "Registrar venta" }));

    expect(registrarMovimiento).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/stock en negativo/);

    await user.click(screen.getByRole("button", { name: "Vender igual" }));
    await waitFor(() => expect(registrarMovimiento).toHaveBeenCalledTimes(1));
    expect(registrarMovimiento.mock.calls[0][0]).toMatchObject({ tipo: "venta", cantidad: 5 });
    // Queda una marca de aviso visible, tanto en el banner como en la fila.
    expect(await screen.findByText(/quedó en stock negativo \(−3\)/)).toBeInTheDocument();
    expect(screen.getAllByText("Stock negativo").length).toBeGreaterThan(0);
  });

  it("una venta que NO deja negativo se registra sin pedir confirmación", async () => {
    registrarMovimiento.mockResolvedValue(resultado({ tipo: "venta", cantidad: -1, stock_resultante: 1 }));
    const user = userEvent.setup();
    render(<CatalogoPage />);
    await screen.findAllByText("Caribe 550");

    await user.click(screen.getAllByRole("button", { name: "Venta de Caribe 550" })[0]);
    await user.type(screen.getByLabelText("Cantidad"), "1");
    await user.click(screen.getByRole("button", { name: "Registrar venta" }));

    await waitFor(() => expect(registrarMovimiento).toHaveBeenCalledTimes(1));
  });

  it("los reintentos tras un error reusan la clave; si cambia un dato, la clave es otra", async () => {
    registrarMovimiento.mockResolvedValueOnce({ resultado: null, error: "No se pudo conectar. Revisá tu conexión a internet e intentá de nuevo." });
    registrarMovimiento.mockResolvedValue(resultado({ stock_resultante: 3 }));
    const user = userEvent.setup();
    render(<CatalogoPage />);
    await screen.findAllByText("Caribe 550");

    await accion(user, "Caribe 550", "Llegó mercadería");
    await user.type(screen.getByLabelText("Cantidad"), "1");
    await user.click(screen.getByRole("button", { name: "Registrar ingreso" }));
    expect(await screen.findByText(/No se pudo conectar/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Registrar ingreso" }));
    await waitFor(() => expect(registrarMovimiento).toHaveBeenCalledTimes(2));
    expect(registrarMovimiento.mock.calls[1][0].idempotencyKey).toBe(registrarMovimiento.mock.calls[0][0].idempotencyKey);
  });

  it("sin cantidad válida no llama a la base y lo explica", async () => {
    const user = userEvent.setup();
    render(<CatalogoPage />);
    await screen.findAllByText("Caribe 550");

    await accion(user, "Caribe 550", "Llegó mercadería");
    await user.click(screen.getByRole("button", { name: "Registrar ingreso" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Escribí la cantidad/);
    await user.type(screen.getByLabelText("Cantidad"), "1.5");
    await user.click(screen.getByRole("button", { name: "Registrar ingreso" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/número entero/);
    expect(registrarMovimiento).not.toHaveBeenCalled();
  });

  it("Corregir stock manda el conteo (no la diferencia) y exige motivo", async () => {
    ajustarConteo.mockResolvedValue(resultado({ tipo: "ajuste", cantidad: 3, stock_resultante: 5 }));
    const user = userEvent.setup();
    render(<CatalogoPage />);
    await screen.findAllByText("Caribe 550");

    await accion(user, "Caribe 550", "Corregir stock");
    await user.clear(screen.getByLabelText("Unidades que contaste"));
    await user.type(screen.getByLabelText("Unidades que contaste"), "5");
    await user.click(screen.getByRole("button", { name: "Guardar conteo" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/motivo/i);
    expect(ajustarConteo).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Motivo"), "Conteo del depósito");
    await user.click(screen.getByRole("button", { name: "Guardar conteo" }));

    await waitFor(() => expect(ajustarConteo).toHaveBeenCalledTimes(1));
    expect(ajustarConteo.mock.calls[0][0]).toMatchObject({ itemId: "p1", stockContado: 5, motivo: "Conteo del depósito" });
    expect(ajustarConteo.mock.calls[0][0]).not.toHaveProperty("diferencia");
    expect((await screen.findAllByTitle("5 en stock")).length).toBeGreaterThan(0);
  });

  it("un conteo que coincide con el stock de la base avisa que no hubo cambios", async () => {
    ajustarConteo.mockResolvedValue(resultado({ movimiento_id: null, tipo: "ajuste", cantidad: 0, stock_resultante: 2 }));
    const user = userEvent.setup();
    render(<CatalogoPage />);
    await screen.findAllByText("Caribe 550");

    await accion(user, "Caribe 550", "Corregir stock");
    await user.type(screen.getByLabelText("Motivo"), "Verificación");
    await user.click(screen.getByRole("button", { name: "Guardar conteo" }));

    expect(await screen.findByText(/coincidía con el stock cargado/)).toBeInTheDocument();
  });

  it("el historial muestra los movimientos con quién, motivo y anulados, y permite anular con motivo", async () => {
    listarMovimientos.mockResolvedValue({
      movimientos: [
        { id: "m3", item_id: "p1", tipo: "anulacion", cantidad: 1, stock_resultante: 2, motivo: "Se cargó mal", referencia: null, anula_a: "m2", creado_por: "u1", creado_at: "2026-10-22T15:00:00Z", anulado: false, creadorNombre: "Benja" },
        { id: "m2", item_id: "p1", tipo: "venta", cantidad: -1, stock_resultante: 1, motivo: null, referencia: "Pérez", anula_a: null, creado_por: "u1", creado_at: "2026-10-22T14:00:00Z", anulado: true, creadorNombre: "Benja" },
        { id: "m1", item_id: "p1", tipo: "ingreso", cantidad: 2, stock_resultante: 2, motivo: null, referencia: "Remito 7", anula_a: null, creado_por: "u2", creado_at: "2026-10-22T10:00:00Z", anulado: false, creadorNombre: "Ana" },
      ],
      error: null,
    });
    anularMovimiento.mockResolvedValue(resultado({ tipo: "anulacion", cantidad: -2, stock_resultante: 0 }));
    const user = userEvent.setup();
    render(<CatalogoPage />);
    await screen.findAllByText("Caribe 550");

    await accion(user, "Caribe 550", "Ver movimientos");
    const dialogo = await screen.findByRole("dialog", { name: "Movimientos de stock" });
    expect(within(dialogo).getByText("Contra-asiento")).toBeInTheDocument();
    expect(within(dialogo).getAllByText("Anulado").length).toBeGreaterThan(0);
    expect(within(dialogo).getByText(/Referencia: Remito 7/)).toBeInTheDocument();
    expect(within(dialogo).getByText(/Motivo: Se cargó mal/)).toBeInTheDocument();
    expect(within(dialogo).getByText(/Ana/)).toBeInTheDocument();
    // Solo el ingreso sin anular se puede anular: la venta ya está anulada y la anulación no se anula.
    expect(within(dialogo).getAllByRole("button", { name: "Anular" })).toHaveLength(1);

    await user.click(within(dialogo).getByRole("button", { name: "Anular" }));
    await user.type(screen.getByLabelText("Motivo de la anulación"), "Remito equivocado");
    await user.click(screen.getAllByRole("button", { name: "Anular" }).at(-1)!);

    await waitFor(() => expect(anularMovimiento).toHaveBeenCalledTimes(1));
    expect(anularMovimiento.mock.calls[0][0]).toMatchObject({ movimientoId: "m1", motivo: "Remito equivocado" });
    expect(listarMovimientos.mock.calls.length).toBeGreaterThanOrEqual(2); // se recargó
  });

  it("un error de la base se muestra en castellano y el diálogo queda abierto", async () => {
    registrarMovimiento.mockResolvedValue({ resultado: null, error: "Este ítem no lleva stock." });
    const user = userEvent.setup();
    render(<CatalogoPage />);
    await screen.findAllByText("Caribe 550");

    await accion(user, "Caribe 550", "Llegó mercadería");
    await user.type(screen.getByLabelText("Cantidad"), "2");
    await user.click(screen.getByRole("button", { name: "Registrar ingreso" }));

    expect(await screen.findByText("Este ítem no lleva stock.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("un stock negativo se ve en rojo, con la marca de aviso", async () => {
    listarItemsCatalogo.mockResolvedValue({
      items: [item({ id: "p9", clave: "indusplast_spa_240", descripcion: "Spa 240", categoria: "Piscinas", stock: -2 })],
      error: null,
    });
    render(<CatalogoPage />);
    await screen.findAllByText("Spa 240");
    expect(screen.getAllByTitle("stock negativo: -2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Stock negativo").length).toBeGreaterThan(0);
  });

  it("filtra por stock con contadores: todos, con stock, sin stock, negativo y sin control", async () => {
    listarItemsCatalogo.mockResolvedValue({
      items: [
        item({ id: "a", clave: "indusplast_caribe_550", descripcion: "Caribe 550", stock: 2 }),
        item({ id: "b", clave: "indusplast_caribe_650", descripcion: "Caribe 650", stock: 0 }),
        item({ id: "c", clave: "indusplast_spa_240", descripcion: "Spa 240", stock: -2 }),
        item({ id: "d", clave: "hierro", descripcion: "Hierro del 6", stock: null }),
      ],
      error: null,
    });
    const user = userEvent.setup();
    render(<CatalogoPage />);
    await screen.findAllByText("Caribe 550");

    const elegir = async (nombre: RegExp) => {
      await user.click(screen.getByRole("button", { name: "Filtrar por stock" }));
      await user.click(await screen.findByRole("radio", { name: nombre }));
    };

    // El menú muestra cada opción con su contador.
    await user.click(screen.getByRole("button", { name: "Filtrar por stock" }));
    const menu = await screen.findByRole("radiogroup", { name: "Filtrar por stock" });
    expect(within(menu).getByRole("radio", { name: /Todos.*4/ })).toBeInTheDocument();
    expect(within(menu).getByRole("radio", { name: /Con stock.*1/ })).toBeInTheDocument();
    expect(within(menu).getByRole("radio", { name: /Sin stock.*1/ })).toBeInTheDocument();
    expect(within(menu).getByRole("radio", { name: /Stock negativo.*1/ })).toBeInTheDocument();
    expect(within(menu).getByRole("radio", { name: /Sin control de stock.*1/ })).toBeInTheDocument();
    await user.click(within(menu).getByRole("radio", { name: /Sin stock/ }));
    expect(screen.getAllByText("Caribe 650").length).toBeGreaterThan(0);
    expect(screen.queryByText("Caribe 550")).not.toBeInTheDocument();
    expect(screen.queryByText("Spa 240")).not.toBeInTheDocument(); // el negativo NO es "sin stock"

    await elegir(/Stock negativo/);
    expect(screen.getAllByText("Spa 240").length).toBeGreaterThan(0);
    expect(screen.queryByText("Caribe 650")).not.toBeInTheDocument();

    await elegir(/Con stock/);
    expect(screen.getAllByText("Caribe 550").length).toBeGreaterThan(0);
    expect(screen.queryByText("Spa 240")).not.toBeInTheDocument();

    await elegir(/Sin control de stock/);
    expect(screen.getAllByText("Hierro del 6").length).toBeGreaterThan(0);
    expect(screen.queryByText("Caribe 550")).not.toBeInTheDocument();
  });

  it("si no hay ítems con stock negativo lo dice claro, y el filtro se conserva al volver", async () => {
    listarItemsCatalogo.mockResolvedValue({
      items: [item({ id: "a", clave: "indusplast_caribe_550", descripcion: "Caribe 550", stock: 2 })],
      error: null,
    });
    const user = userEvent.setup();
    const { unmount } = render(<CatalogoPage />);
    await screen.findAllByText("Caribe 550");
    await user.click(screen.getByRole("button", { name: "Filtrar por stock" }));
    await user.click(await screen.findByRole("radio", { name: /Stock negativo/ }));
    expect(await screen.findByText("No hay ítems con stock negativo.")).toBeInTheDocument();

    // Se abre otra pantalla y se vuelve: el filtro sigue puesto.
    unmount();
    render(<CatalogoPage />);
    expect(await screen.findByText("No hay ítems con stock negativo.")).toBeInTheDocument();
  });

  it("en modo consulta el stock es de sólo lectura", async () => {
    const user = userEvent.setup();
    render(<CatalogoPage />);
    await screen.findAllByText("Caribe 550");

    await abrirFiltros(user);
    await user.click(screen.getByLabelText("Modo consulta rápida"));

    expect(screen.queryByRole("button", { name: /Más acciones de|Venta de/ })).not.toBeInTheDocument();
    expect(screen.getAllByTitle("2 en stock").length).toBeGreaterThan(0);
  });
});

describe("CatalogoPage · piscinas de lista", () => {
  const LISTA = [
    item({ id: "c650", clave: "indusplast_caribe_650", descripcion: "Piscina de fibra Indusplast Caribe 650 — contado, kit estándar instalado", categoria: "Piscinas", precio: 9965000 }),
    item({ id: "r400", clave: "indusplast_racionalista_400", descripcion: "Piscina de fibra Indusplast Racionalista 400 — contado, kit estándar instalado", categoria: "Piscinas", precio: 6490000 }),
    item({ id: "r450", clave: "indusplast_racionalista_450", descripcion: "Piscina de fibra Indusplast Racionalista 450 — contado, kit estándar instalado", categoria: "Piscinas", precio: 6950000 }),
    item({ id: "kit", clave: "kit_limpieza", descripcion: "Kit de limpieza", categoria: "Piscinas" }),
  ];

  it("muestra un bloque por modelo, en orden, con nombre corto y el detalle debajo", async () => {
    listarItemsCatalogo.mockResolvedValue({ items: LISTA, error: null });
    render(<CatalogoPage />);
    await screen.findAllByText("Racionalista 400");

    const titulos = [...new Set(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent))];
    expect(titulos.slice(0, 2)).toEqual(["Indusplast · Racionalista", "Indusplast · Caribe"]);
    expect(screen.getAllByText("Contado, kit estándar instalado").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Kit de limpieza").length).toBeGreaterThan(0);
  });

  it("el acceso directo de Indusplast deja sólo esas piscinas", async () => {
    const user = userEvent.setup();
    listarItemsCatalogo.mockResolvedValue({ items: LISTA, error: null });
    render(<CatalogoPage />);
    await screen.findAllByText("Racionalista 400");
    const secciones = await menuCategoria(user);
    expect(within(secciones).getByRole("radio", { name: /^Piscinas de fibra Indusplast.*3/ })).toBeInTheDocument();
    expect(within(secciones).getByRole("radio", { name: /^Otros.*1/ })).toBeInTheDocument();

    await user.click(within(secciones).getByRole("radio", { name: /Piscinas de fibra Indusplast/ }));

    expect(screen.queryByText("Kit de limpieza")).not.toBeInTheDocument();
    expect(screen.getAllByText("Caribe 650").length).toBeGreaterThan(0);
  });

  it("sin piscinas de lista no hay acceso directo a Indusplast ni a hormigón", async () => {
    const user = userEvent.setup();
    listarItemsCatalogo.mockResolvedValue({ items: [LISTA[3]], error: null });
    render(<CatalogoPage />);
    await screen.findAllByText("Kit de limpieza");
    const secciones = await menuCategoria(user);
    expect(within(secciones).queryByRole("radio", { name: /Indusplast|hormigón/ })).not.toBeInTheDocument();
  });
});

describe("CatalogoPage · alta de una piscina (clave y categoría salen solas)", () => {
  beforeEach(() => {
    crearItemCatalogo.mockReset();
    listarItemsCatalogo.mockResolvedValue({ items: [item({ id: "a", descripcion: "Luces LED" })], error: null });
  });

  async function abrirAlta(user: ReturnType<typeof userEvent.setup>) {
    render(<CatalogoPage />);
    await screen.findAllByText("Luces LED");
    await user.click(screen.getByRole("button", { name: "Agregar ítem" }));
    return screen.findByRole("dialog");
  }

  it("piscina de hormigón: se cargan sólo las medidas y el precio", async () => {
    crearItemCatalogo.mockResolvedValue({
      item: item({ id: "n", clave: "lista_hormigon_8x4_5", descripcion: "Piscina de hormigón 8x4.5 — precio de lista, obra terminada", categoria: "Piscinas" }),
      error: null,
    });
    const user = userEvent.setup();
    const dialogo = await abrirAlta(user);

    await user.selectOptions(within(dialogo).getByLabelText("¿Qué vas a agregar?"), "hormigon");
    expect(within(dialogo).queryByLabelText("Clave (opcional)")).not.toBeInTheDocument();
    await user.type(within(dialogo).getByLabelText("Largo (m)"), "8");
    await user.type(within(dialogo).getByLabelText("Ancho (m)"), "4,5");
    expect(within(dialogo).getByText("lista_hormigon_8x4_5")).toBeInTheDocument(); // vista previa
    await user.type(within(dialogo).getByLabelText("Precio"), "13000000");
    await user.click(within(dialogo).getByRole("button", { name: "Agregar al catálogo" }));

    await waitFor(() => expect(crearItemCatalogo).toHaveBeenCalledTimes(1));
    expect(crearItemCatalogo.mock.calls[0][0]).toMatchObject({
      tipo: "piscinas",
      clave: "lista_hormigon_8x4_5",
      categoria: "Piscinas",
      unidad: "obra",
      precio: 13000000,
      activo: true,
    });
  });

  it("piscina Indusplast: modelo y medida", async () => {
    crearItemCatalogo.mockResolvedValue({ item: item({ id: "n", clave: "indusplast_caribe_750" }), error: null });
    const user = userEvent.setup();
    const dialogo = await abrirAlta(user);

    await user.selectOptions(within(dialogo).getByLabelText("¿Qué vas a agregar?"), "indusplast");
    await user.selectOptions(within(dialogo).getByLabelText("Modelo"), "caribe");
    await user.type(within(dialogo).getByLabelText("Medida"), "750");
    await user.click(within(dialogo).getByRole("button", { name: "Agregar al catálogo" }));

    await waitFor(() => expect(crearItemCatalogo).toHaveBeenCalledTimes(1));
    expect(crearItemCatalogo.mock.calls[0][0]).toMatchObject({ clave: "indusplast_caribe_750", categoria: "Piscinas", unidad: "obra" });
  });

  it("si faltan las medidas lo avisa y no crea nada", async () => {
    const user = userEvent.setup();
    const dialogo = await abrirAlta(user);

    await user.selectOptions(within(dialogo).getByLabelText("¿Qué vas a agregar?"), "hormigon");
    await user.click(within(dialogo).getByRole("button", { name: "Agregar al catálogo" }));

    expect(await within(dialogo).findByText(/Ingresá el largo y el ancho/)).toBeInTheDocument();
    expect(crearItemCatalogo).not.toHaveBeenCalled();
  });

  it("otro ítem sin clave: se arma con la descripción", async () => {
    crearItemCatalogo.mockResolvedValue({ item: item({ id: "n", clave: "cerco_reforzado", descripcion: "Cerco reforzado" }), error: null });
    const user = userEvent.setup();
    const dialogo = await abrirAlta(user);

    await user.type(within(dialogo).getByLabelText("Descripción"), "Cerco reforzado");
    await user.click(within(dialogo).getByRole("button", { name: "Agregar al catálogo" }));

    await waitFor(() => expect(crearItemCatalogo).toHaveBeenCalledTimes(1));
    expect(crearItemCatalogo.mock.calls[0][0]).toMatchObject({ clave: "cerco_reforzado", descripcion: "Cerco reforzado" });
  });
});
