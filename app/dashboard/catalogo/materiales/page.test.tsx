// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Proveedor } from "@/lib/domain/abastecimiento/proveedor";
import type { Material } from "@/lib/domain/abastecimiento/material";
import MaterialesPage from "./page";

const mocks = vi.hoisted(() => ({
  listarProveedores: vi.fn(),
  listarMateriales: vi.fn(),
  guardarMaterial: vi.fn(),
  eliminarMaterial: vi.fn(),
}));
vi.mock("@/lib/abastecimiento", () => mocks);

const base = {
  rubro: null,
  contacto: null,
  forma_pago: null,
  plazo: null,
  notas: null,
  activo: true,
  updated_at: "2026-01-01T00:00:00.000Z",
};
const PROVEEDORES: Proveedor[] = [
  { ...base, id: "p1", nombre: "Ranco", telefono: "1", orden: 1 },
  { ...base, id: "p2", nombre: "Vulcano", telefono: "2", orden: 2 },
];

function mat(o: Partial<Material> = {}): Material {
  return {
    id: "m1",
    nombre: "Cemento 25 kg",
    proveedor_id: "p1",
    unidad: "bolsa",
    precio: 6461,
    precio_actualizado: "2026-06-18",
    rubro: "Materiales",
    aplica: "Siempre",
    usd_ref: null,
    notas: null,
    cantidades: { "5x3": 110 },
    activo: true,
    orden: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    ...o,
  };
}

describe("Materiales", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset());
    mocks.listarProveedores.mockResolvedValue({ items: PROVEEDORES, error: null });
  });

  it("lista con proveedor y precio sin cortes, y 'A confirmar' cuando no hay precio", async () => {
    mocks.listarMateriales.mockResolvedValue({
      items: [mat(), mat({ id: "m2", nombre: "Filtro VC30", proveedor_id: "p2", precio: null, rubro: "Hidráulica" })],
      error: null,
    });
    render(<MaterialesPage />);

    expect(await screen.findByText("Cemento 25 kg")).toBeInTheDocument();
    expect(screen.getAllByText("Ranco").length).toBeGreaterThan(0);
    const precio = screen.getByText(/\$\s*6\.461/);
    expect(precio.className).toContain("whitespace-nowrap");
    expect(screen.getByText("A confirmar", { selector: "span.rounded-full" })).toBeInTheDocument();
  });

  it("filtra por rubro con chips (con contador) y por proveedor", async () => {
    mocks.listarMateriales.mockResolvedValue({
      items: [mat(), mat({ id: "m2", nombre: "Filtro VC30", proveedor_id: "p2", rubro: "Hidráulica" })],
      error: null,
    });
    const user = userEvent.setup();
    render(<MaterialesPage />);
    await screen.findByText("Cemento 25 kg");

    const grupo = screen.getByRole("group", { name: "Filtrar por rubro" });
    expect(within(grupo).getByRole("button", { name: /^Todos\s*2$/ })).toBeInTheDocument();
    await user.click(within(grupo).getByRole("button", { name: /^Hidráulica/ }));
    expect(screen.queryByText("Cemento 25 kg")).not.toBeInTheDocument();
    expect(screen.getByText("Filtro VC30")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    await user.selectOptions(screen.getByLabelText("Filtrar por proveedor"), "p1");
    expect(screen.queryByText("Filtro VC30")).not.toBeInTheDocument();
    expect(screen.getByText("Cemento 25 kg")).toBeInTheDocument();
  });

  it("el chip 'A confirmar' deja sólo los que no tienen precio", async () => {
    mocks.listarMateriales.mockResolvedValue({
      items: [mat(), mat({ id: "m2", nombre: "Sin precio", precio: null })],
      error: null,
    });
    const user = userEvent.setup();
    render(<MaterialesPage />);
    await screen.findByText("Cemento 25 kg");

    await user.click(screen.getByRole("button", { name: /^A confirmar/ }));
    expect(screen.queryByText("Cemento 25 kg")).not.toBeInTheDocument();
    expect(screen.getByText("Sin precio")).toBeInTheDocument();
  });

  it("muestra el error claro si todavía no se corrió la migración", async () => {
    mocks.listarMateriales.mockResolvedValue({
      items: null,
      error: "Falta correr supabase/migration_proveedores_materiales.sql",
    });
    render(<MaterialesPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/migration_proveedores_materiales/);
  });

  it("agrega un material con precio y cantidades por tamaño", async () => {
    mocks.listarMateriales.mockResolvedValue({ items: [], error: null });
    mocks.guardarMaterial.mockResolvedValue({ item: mat({ id: "nuevo", nombre: "Hierro del 6" }), error: null });
    const user = userEvent.setup();
    render(<MaterialesPage />);
    await screen.findByText("Todavía no hay materiales cargados.");

    await user.click(screen.getByRole("button", { name: "Agregar material" }));
    const dialogo = await screen.findByRole("dialog");
    await user.type(within(dialogo).getByLabelText(/Nombre/), "Hierro del 6");
    await user.selectOptions(within(dialogo).getByLabelText("Proveedor"), "p1");
    await user.type(within(dialogo).getByLabelText("Precio"), "5339");
    await user.type(within(dialogo).getByLabelText("5x3"), "50");
    await user.click(within(dialogo).getByRole("button", { name: "Agregar material" }));

    await waitFor(() => expect(mocks.guardarMaterial).toHaveBeenCalled());
    const [id, datos, anterior] = mocks.guardarMaterial.mock.calls[0];
    expect(id).toBeNull();
    expect(anterior).toBeUndefined();
    expect(datos).toMatchObject({ nombre: "Hierro del 6", proveedor_id: "p1", precio: 5339, cantidades: { "5x3": 50 } });
    expect(await screen.findByText('Se agregó "Hierro del 6".')).toBeInTheDocument();
  });

  it("al editar manda el precio anterior (para refrescar la fecha sólo si cambió)", async () => {
    mocks.listarMateriales.mockResolvedValue({ items: [mat()], error: null });
    mocks.guardarMaterial.mockResolvedValue({ item: mat({ precio: 7000 }), error: null });
    const user = userEvent.setup();
    render(<MaterialesPage />);
    await screen.findByText("Cemento 25 kg");

    await user.click(screen.getByRole("button", { name: "Editar Cemento 25 kg" }));
    const campo = await screen.findByLabelText("Precio");
    await user.clear(campo);
    await user.type(campo, "7000");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(mocks.guardarMaterial).toHaveBeenCalled());
    const [id, datos, anterior] = mocks.guardarMaterial.mock.calls[0];
    expect(id).toBe("m1");
    expect(anterior).toBe(6461);
    expect(datos.precio).toBe(7000);
    expect(datos.cantidades).toEqual({ "5x3": 110 });
  });

  it("eliminar pide confirmación y lo saca del listado", async () => {
    mocks.listarMateriales.mockResolvedValue({ items: [mat()], error: null });
    mocks.eliminarMaterial.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<MaterialesPage />);
    await screen.findByText("Cemento 25 kg");

    await user.click(screen.getByRole("button", { name: "Editar Cemento 25 kg" }));
    await user.click(await screen.findByRole("button", { name: "Eliminar material" }));
    await user.click(screen.getByRole("button", { name: "Sí, eliminar" }));

    await waitFor(() => expect(mocks.eliminarMaterial).toHaveBeenCalledWith("m1"));
    expect(await screen.findByText('Se eliminó "Cemento 25 kg".')).toBeInTheDocument();
  });
});
