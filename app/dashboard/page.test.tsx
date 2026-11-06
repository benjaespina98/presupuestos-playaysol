// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InicioPage from "./page";

const mocks = vi.hoisted(() => ({
  listarItemsCatalogo: vi.fn(),
  listarMateriales: vi.fn(),
  listarProveedores: vi.fn(),
  listarPresupuestosResumen: vi.fn(),
}));
vi.mock("@/lib/catalogo", () => ({ listarItemsCatalogo: mocks.listarItemsCatalogo }));
vi.mock("@/lib/abastecimiento", () => ({ listarMateriales: mocks.listarMateriales, listarProveedores: mocks.listarProveedores }));
vi.mock("@/lib/presupuestos", () => ({ listarPresupuestosResumen: mocks.listarPresupuestosResumen }));

const ITEM = {
  id: "i1",
  tipo: "piscinas",
  clave: "solarium",
  descripcion: "Solárium seco",
  precio: 239000,
  unidad: "m²",
  categoria: null,
  activo: true,
  stock: 3,
  updated_at: "2026-01-01T00:00:00.000Z",
};
const AGOTADO = { ...ITEM, id: "i2", clave: "indusplast_caribe_550", descripcion: "Caribe 550", stock: 0 };
const PROVEEDOR = {
  id: "p1",
  nombre: "Corralón Norte",
  rubro: null,
  contacto: null,
  telefono: "Ana 111 / Beto 222",
  forma_pago: null,
  plazo: null,
  notas: null,
  activo: true,
  orden: 1,
  updated_at: "2026-01-01T00:00:00.000Z",
};
const MATERIAL = {
  id: "m1",
  nombre: "Ladrillo común",
  proveedor_id: "p1",
  unidad: "unidad",
  precio: null,
  precio_actualizado: null,
  rubro: null,
  aplica: null,
  usd_ref: null,
  notas: null,
  cantidades: {},
  activo: true,
  orden: 1,
  updated_at: "2026-01-01T00:00:00.000Z",
};
const PRESUPUESTO = { id: "b1", tipo: "piscinas", cliente_nombre: "Familia García", created_at: "2026-01-15T12:00:00.000Z" };

const buscador = () => screen.getByRole("textbox", { name: /Buscar precios/ });

describe("Inicio", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    mocks.listarItemsCatalogo.mockResolvedValue({ items: [ITEM, AGOTADO], error: null });
    mocks.listarMateriales.mockResolvedValue({ items: [MATERIAL], error: null });
    mocks.listarProveedores.mockResolvedValue({ items: [PROVEEDOR], error: null });
    mocks.listarPresupuestosResumen.mockResolvedValue({ items: [PRESUPUESTO], error: null });
  });

  it("muestra una tarjeta por área, cada una a su pantalla", async () => {
    render(<InicioPage />);
    const areas = screen.getByRole("navigation", { name: "Áreas del portal" });
    const destino = (nombre: RegExp) => within(areas).getByRole("link", { name: nombre }).getAttribute("href");

    expect(destino(/^Presupuestos$/)).toBe("/dashboard/nuevo");
    expect(destino(/^Plano de piscina$/)).toBe("/dashboard/losetas");
    expect(destino(/^Precios$/)).toBe("/dashboard/catalogo");
    expect(destino(/^Stock Indusplast/)).toBe("/dashboard/stock");
    expect(destino(/^Compras$/)).toBe("/dashboard/catalogo/materiales");
  });

  it("la tarjeta de Stock resume lo que hay, y no hay textos explicativos", async () => {
    render(<InicioPage />);
    expect(await screen.findByText("3 unidades · 1 agotada")).toBeInTheDocument();
    expect(screen.queryByText(/Dibujar el plano/)).not.toBeInTheDocument();
  });

  it("no muestra datos de clientes hasta que se busca", async () => {
    render(<InicioPage />);
    await screen.findByText("3 unidades · 1 agotada"); // ya cargó todo
    expect(screen.queryByText(/Familia García/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Últimos presupuestos/ })).not.toBeInTheDocument();
  });

  it("buscar a un cliente lo muestra, con el botón de duplicar", async () => {
    render(<InicioPage />);
    await screen.findByText("3 unidades · 1 agotada");
    await userEvent.type(buscador(), "garcia");

    const grupo = await screen.findByRole("region", { name: "Presupuestos" });
    expect(within(grupo).getByRole("link", { name: /^Familia García/ })).toHaveAttribute("href", "/dashboard/piscinas?id=b1");
    expect(within(grupo).getByRole("link", { name: "Duplicar presupuesto de Familia García" })).toHaveAttribute(
      "href",
      "/dashboard/piscinas?duplicar=b1"
    );
    expect(screen.queryByRole("navigation", { name: "Áreas del portal" })).not.toBeInTheDocument();
  });

  it("busca sin importar tildes y lleva a la lista con la búsqueda hecha", async () => {
    render(<InicioPage />);
    await screen.findByText("3 unidades · 1 agotada");
    await userEvent.type(buscador(), "solarium");

    const grupo = await screen.findByRole("region", { name: "Precios de venta" });
    const fila = within(grupo).getByRole("link", { name: /Solárium seco/ });
    expect(fila).toHaveAttribute("href", "/dashboard/catalogo?buscar=Sol%C3%A1rium%20seco");
    expect(within(grupo).getByText("Stock 3")).toBeInTheDocument();
  });

  it("muestra el teléfono del proveedor con un botón para llamar, y sus materiales", async () => {
    render(<InicioPage />);
    await screen.findByText("3 unidades · 1 agotada");
    await userEvent.type(buscador(), "corralon");

    const proveedores = await screen.findByRole("region", { name: "Proveedores" });
    expect(within(proveedores).getByText("Ana 111")).toBeInTheDocument();
    expect(within(proveedores).getByRole("link", { name: "Llamar a Corralón Norte" })).toHaveAttribute("href", "tel:111");
    const materiales = screen.getByRole("region", { name: "Materiales" });
    expect(within(materiales).getByText("A confirmar")).toBeInTheDocument();
  });

  it("avisa cuando no hay coincidencias", async () => {
    render(<InicioPage />);
    await screen.findByText("3 unidades · 1 agotada");
    await userEvent.type(buscador(), "zzz");
    expect(await screen.findByText("Nada coincide con “zzz”.")).toBeInTheDocument();
  });

  it("agrupa de a seis y se pueden ver todos", async () => {
    mocks.listarMateriales.mockResolvedValue({
      items: Array.from({ length: 8 }, (_, i) => ({ ...MATERIAL, id: `m${i}`, nombre: `Ladrillo ${i}` })),
      error: null,
    });
    render(<InicioPage />);
    await screen.findByText("3 unidades · 1 agotada");
    await userEvent.type(buscador(), "ladrillo");

    const grupo = await screen.findByRole("region", { name: "Materiales" });
    expect(within(grupo).getAllByRole("listitem")).toHaveLength(6);
    await userEvent.click(within(grupo).getByRole("button", { name: "Ver los 8" }));
    expect(within(grupo).getAllByRole("listitem")).toHaveLength(8);
  });

  it("si una fuente falla, avisa y sigue buscando en las demás", async () => {
    mocks.listarMateriales.mockResolvedValue({ items: null, error: "falló" });
    render(<InicioPage />);
    expect(await screen.findByText(/No se pudo leer: materiales/)).toBeInTheDocument();
    await userEvent.type(buscador(), "solarium");
    expect(await screen.findByRole("region", { name: "Precios de venta" })).toBeInTheDocument();
  });
});
