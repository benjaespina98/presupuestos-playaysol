// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Proveedor } from "@/lib/domain/abastecimiento/proveedor";
import type { Material } from "@/lib/domain/abastecimiento/material";
import ProveedoresPage from "./page";

const mocks = vi.hoisted(() => ({
  listarProveedores: vi.fn(),
  listarMateriales: vi.fn(),
  guardarProveedor: vi.fn(),
  eliminarProveedor: vi.fn(),
}));
vi.mock("@/lib/abastecimiento", () => mocks);

function prov(o: Partial<Proveedor> = {}): Proveedor {
  return {
    id: "p1",
    nombre: "Ranco",
    rubro: "Corralón",
    contacto: "Juan",
    telefono: "+54 9 3534 00-0000",
    forma_pago: null,
    plazo: null,
    notas: null,
    activo: true,
    orden: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    ...o,
  };
}
const mat = (o: Partial<Material>): Material => ({
  id: "m1",
  nombre: "Cemento",
  proveedor_id: "p1",
  unidad: "bolsa",
  precio: 1,
  precio_actualizado: null,
  rubro: "Materiales",
  aplica: "Siempre",
  usd_ref: null,
  notas: null,
  cantidades: {},
  activo: true,
  orden: null,
  updated_at: "2026-01-01T00:00:00.000Z",
  ...o,
});

describe("Proveedores", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset());
    mocks.listarMateriales.mockResolvedValue({ items: [mat({}), mat({ id: "m2", nombre: "Hierro" })], error: null });
  });

  it("lista los proveedores con su contador de materiales y avisa cuando falta el teléfono", async () => {
    mocks.listarProveedores.mockResolvedValue({
      items: [prov(), prov({ id: "p2", nombre: "Vulcano", telefono: null })],
      error: null,
    });
    render(<ProveedoresPage />);

    expect(await screen.findByText("Ranco")).toBeInTheDocument();
    expect(screen.getByText("2 materiales")).toBeInTheDocument();
    expect(screen.getByText("Sin materiales")).toBeInTheDocument();
    expect(screen.getByText("Falta teléfono")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+54 9 3534 00-0000" })).toHaveAttribute("href", "tel:+5493534000000");
  });

  it("el chip 'Sin teléfono' deja sólo los que no lo tienen, y 'Limpiar filtros' lo deshace", async () => {
    mocks.listarProveedores.mockResolvedValue({
      items: [prov(), prov({ id: "p2", nombre: "Vulcano", telefono: null })],
      error: null,
    });
    const user = userEvent.setup();
    render(<ProveedoresPage />);
    await screen.findByText("Ranco");

    await user.click(screen.getByRole("button", { name: /Sin teléfono/ }));
    expect(screen.queryByText("Ranco")).not.toBeInTheDocument();
    expect(screen.getByText("Vulcano")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(screen.getByText("Ranco")).toBeInTheDocument();
  });

  it("muestra el error claro si todavía no se corrió la migración", async () => {
    mocks.listarProveedores.mockResolvedValue({
      items: null,
      error: "Falta correr supabase/migration_proveedores_materiales.sql",
    });
    render(<ProveedoresPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/migration_proveedores_materiales/);
  });

  it("agrega un proveedor", async () => {
    mocks.listarProveedores.mockResolvedValue({ items: [], error: null });
    mocks.guardarProveedor.mockResolvedValue({ item: prov({ id: "nuevo", nombre: "Poligar" }), error: null });
    const user = userEvent.setup();
    render(<ProveedoresPage />);
    await screen.findByText("Todavía no hay proveedores cargados.");

    await user.click(screen.getByRole("button", { name: "Agregar proveedor" }));
    const dialogo = await screen.findByRole("dialog");
    await user.type(within(dialogo).getByLabelText(/Nombre/), "Poligar");
    await user.click(within(dialogo).getByRole("button", { name: "Agregar proveedor" }));

    await waitFor(() =>
      expect(mocks.guardarProveedor).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ nombre: "Poligar", rubro: null, activo: true })
      )
    );
    expect(await screen.findByText('Se agregó "Poligar".')).toBeInTheDocument();
  });

  it("exige el nombre", async () => {
    mocks.listarProveedores.mockResolvedValue({ items: [], error: null });
    const user = userEvent.setup();
    render(<ProveedoresPage />);
    await screen.findByText("Todavía no hay proveedores cargados.");

    await user.click(screen.getByRole("button", { name: "Agregar proveedor" }));
    const dialogo = await screen.findByRole("dialog");
    await user.click(within(dialogo).getByRole("button", { name: "Agregar proveedor" }));

    expect(await screen.findByText("El nombre es obligatorio")).toBeInTheDocument();
    expect(mocks.guardarProveedor).not.toHaveBeenCalled();
  });

  it("dar de baja es apagar 'Activo' en la edición", async () => {
    mocks.listarProveedores.mockResolvedValue({ items: [prov()], error: null });
    mocks.guardarProveedor.mockResolvedValue({ item: prov({ activo: false }), error: null });
    const user = userEvent.setup();
    render(<ProveedoresPage />);
    await screen.findByText("Ranco");

    await user.click(screen.getByRole("button", { name: "Editar Ranco" }));
    await user.click(await screen.findByLabelText("Activo"));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(mocks.guardarProveedor).toHaveBeenCalledWith("p1", expect.objectContaining({ activo: false }))
    );
    expect(await screen.findByText('Se guardó "Ranco".')).toBeInTheDocument();
  });

  it("eliminar avisa cuántos materiales quedan sin proveedor y pide confirmación", async () => {
    mocks.listarProveedores.mockResolvedValue({ items: [prov()], error: null });
    mocks.eliminarProveedor.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<ProveedoresPage />);
    await screen.findByText("Ranco");

    await user.click(screen.getByRole("button", { name: "Editar Ranco" }));
    await user.click(await screen.findByRole("button", { name: "Eliminar proveedor" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent(/2 materiales quedan sin proveedor/);
    expect(mocks.eliminarProveedor).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Sí, eliminar" }));
    await waitFor(() => expect(mocks.eliminarProveedor).toHaveBeenCalledWith("p1"));
    expect(await screen.findByText('Se eliminó "Ranco".')).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar Ranco" })).not.toBeInTheDocument();
  });
});
