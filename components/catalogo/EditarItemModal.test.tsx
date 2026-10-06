// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ItemCatalogo } from "@/lib/domain/catalogo/item";
import { EditarItemModal } from "./EditarItemModal";

const { actualizarItemCatalogo, eliminarItemCatalogo } = vi.hoisted(() => ({
  actualizarItemCatalogo: vi.fn(),
  eliminarItemCatalogo: vi.fn(),
}));
vi.mock("@/lib/catalogo", () => ({ actualizarItemCatalogo, eliminarItemCatalogo }));

function item(overrides: Partial<ItemCatalogo> = {}): ItemCatalogo {
  return {
    id: "id-1",
    tipo: "piscinas",
    clave: "luces",
    descripcion: "Luces LED",
    precio: 240000,
    categoria: "Iluminación",
    unidad: "unidad",
    activo: true,
    orden: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("EditarItemModal", () => {
  beforeEach(() => {
    actualizarItemCatalogo.mockReset();
    eliminarItemCatalogo.mockReset();
  });

  it("precarga los valores actuales del ítem", () => {
    render(<EditarItemModal item={item()} onClose={vi.fn()} onGuardado={vi.fn()} onEliminado={vi.fn()} />);

    expect(screen.getByLabelText("Descripción")).toHaveValue("Luces LED");
    expect(screen.getByLabelText("Precio")).toHaveValue("$ 240.000");
    expect(screen.getByLabelText("Categoría")).toHaveValue("Iluminación");
    expect(screen.getByLabelText("Activo")).toBeChecked();
  });

  it("un ítem con precio null (a cotizar) precarga el campo vacío, no en $0", () => {
    render(<EditarItemModal item={item({ precio: null })} onClose={vi.fn()} onGuardado={vi.fn()} onEliminado={vi.fn()} />);
    expect(screen.getByLabelText("Precio")).toHaveValue("");
  });

  it("guarda una edición válida y llama onGuardado con el ítem actualizado", async () => {
    actualizarItemCatalogo.mockResolvedValue({ error: null });
    const onGuardado = vi.fn();
    const user = userEvent.setup();
    render(<EditarItemModal item={item()} onClose={vi.fn()} onGuardado={onGuardado} onEliminado={vi.fn()} />);

    await user.clear(screen.getByLabelText("Precio"));
    await user.type(screen.getByLabelText("Precio"), "300000");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await vi.waitFor(() => expect(onGuardado).toHaveBeenCalled());
    expect(actualizarItemCatalogo).toHaveBeenCalledWith(
      "id-1",
      expect.objectContaining({ precio: 300000 })
    );
    expect(onGuardado.mock.calls[0][0].precio).toBe(300000);
  });

  it("vaciar el precio lo guarda como null ('a cotizar'), no como 0", async () => {
    actualizarItemCatalogo.mockResolvedValue({ error: null });
    const onGuardado = vi.fn();
    const user = userEvent.setup();
    render(<EditarItemModal item={item()} onClose={vi.fn()} onGuardado={onGuardado} onEliminado={vi.fn()} />);

    await user.clear(screen.getByLabelText("Precio"));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await vi.waitFor(() => expect(actualizarItemCatalogo).toHaveBeenCalled());
    expect(actualizarItemCatalogo).toHaveBeenCalledWith("id-1", expect.objectContaining({ precio: null }));
  });

  it("poner el precio en 0 lo guarda como 0, no como null", async () => {
    actualizarItemCatalogo.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<EditarItemModal item={item()} onClose={vi.fn()} onGuardado={vi.fn()} onEliminado={vi.fn()} />);

    await user.clear(screen.getByLabelText("Precio"));
    await user.type(screen.getByLabelText("Precio"), "0");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await vi.waitFor(() => expect(actualizarItemCatalogo).toHaveBeenCalled());
    expect(actualizarItemCatalogo).toHaveBeenCalledWith("id-1", expect.objectContaining({ precio: 0 }));
  });

  it("un precio negativo se rechaza en el cliente y no llega a persistirse", async () => {
    const onGuardado = vi.fn();
    const user = userEvent.setup();
    render(<EditarItemModal item={item()} onClose={vi.fn()} onGuardado={onGuardado} onEliminado={vi.fn()} />);

    await user.clear(screen.getByLabelText("Precio"));
    await user.type(screen.getByLabelText("Precio"), "-100");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("El precio no puede ser negativo")).toBeInTheDocument();
    expect(actualizarItemCatalogo).not.toHaveBeenCalled();
    expect(onGuardado).not.toHaveBeenCalled();
  });

  it("muestra el error de guardado y no cierra el modal", async () => {
    actualizarItemCatalogo.mockResolvedValue({ error: "No se pudo guardar: motivo tal." });
    const onGuardado = vi.fn();
    const user = userEvent.setup();
    render(<EditarItemModal item={item()} onClose={vi.fn()} onGuardado={onGuardado} onEliminado={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("No se pudo guardar: motivo tal.")).toBeInTheDocument();
    expect(onGuardado).not.toHaveBeenCalled();
  });

  it("cancelar cierra sin guardar", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<EditarItemModal item={item()} onClose={onClose} onGuardado={vi.fn()} onEliminado={vi.fn()} />);

    await user.clear(screen.getByLabelText("Descripción"));
    await user.type(screen.getByLabelText("Descripción"), "Otra cosa");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onClose).toHaveBeenCalled();
    expect(actualizarItemCatalogo).not.toHaveBeenCalled();
  });

  it("cambiar categoría a 'Sin clasificar' guarda null", async () => {
    actualizarItemCatalogo.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<EditarItemModal item={item()} onClose={vi.fn()} onGuardado={vi.fn()} onEliminado={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText("Categoría"), "Sin clasificar");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await vi.waitFor(() => expect(actualizarItemCatalogo).toHaveBeenCalled());
    expect(actualizarItemCatalogo).toHaveBeenCalledWith("id-1", expect.objectContaining({ categoria: null }));
  });

  it("destildar Activo lo guarda en false", async () => {
    actualizarItemCatalogo.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<EditarItemModal item={item()} onClose={vi.fn()} onGuardado={vi.fn()} onEliminado={vi.fn()} />);

    await user.click(screen.getByLabelText("Activo"));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await vi.waitFor(() => expect(actualizarItemCatalogo).toHaveBeenCalled());
    expect(actualizarItemCatalogo).toHaveBeenCalledWith("id-1", expect.objectContaining({ activo: false }));
  });
});

describe("EditarItemModal · dar de baja y eliminar", () => {
  beforeEach(() => {
    actualizarItemCatalogo.mockReset();
    eliminarItemCatalogo.mockReset();
  });

  it("dar de baja es apagar 'Activo' y guardar, sin tocar el resto", async () => {
    actualizarItemCatalogo.mockResolvedValue({ error: null });
    const onGuardado = vi.fn();
    const user = userEvent.setup();
    render(<EditarItemModal item={item()} onClose={vi.fn()} onGuardado={onGuardado} onEliminado={vi.fn()} />);

    await user.click(screen.getByLabelText("Activo"));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await vi.waitFor(() => expect(onGuardado).toHaveBeenCalled());
    expect(actualizarItemCatalogo).toHaveBeenCalledWith(
      "id-1",
      expect.objectContaining({ activo: false, precio: 240000, descripcion: "Luces LED" })
    );
  });

  it("eliminar pide confirmación y no borra nada hasta confirmar", async () => {
    const user = userEvent.setup();
    render(<EditarItemModal item={item()} onClose={vi.fn()} onGuardado={vi.fn()} onEliminado={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Eliminar ítem" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "No, conservarlo" }));

    expect(eliminarItemCatalogo).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("confirmar elimina la fila y avisa con onEliminado", async () => {
    eliminarItemCatalogo.mockResolvedValue({ error: null });
    const onEliminado = vi.fn();
    const user = userEvent.setup();
    render(<EditarItemModal item={item()} onClose={vi.fn()} onGuardado={vi.fn()} onEliminado={onEliminado} />);

    await user.click(screen.getByRole("button", { name: "Eliminar ítem" }));
    await user.click(screen.getByRole("button", { name: "Sí, eliminar" }));

    await vi.waitFor(() => expect(onEliminado).toHaveBeenCalledWith(expect.objectContaining({ id: "id-1" })));
    expect(eliminarItemCatalogo).toHaveBeenCalledWith("id-1");
  });

  it("si falla el borrado muestra el error y no avisa onEliminado", async () => {
    eliminarItemCatalogo.mockResolvedValue({ error: "No se pudo eliminar: sin permiso" });
    const onEliminado = vi.fn();
    const user = userEvent.setup();
    render(<EditarItemModal item={item()} onClose={vi.fn()} onGuardado={vi.fn()} onEliminado={onEliminado} />);

    await user.click(screen.getByRole("button", { name: "Eliminar ítem" }));
    await user.click(screen.getByRole("button", { name: "Sí, eliminar" }));

    expect(await screen.findByText("No se pudo eliminar: sin permiso")).toBeInTheDocument();
    expect(onEliminado).not.toHaveBeenCalled();
  });

  it("un precio base de la calculadora se puede editar pero no eliminar", () => {
    render(
      <EditarItemModal
        item={item({ tipo: "cercos", clave: "precioSin", descripcion: "Precio por ml sin instalación" })}
        onClose={vi.fn()}
        onGuardado={vi.fn()}
        onEliminado={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: "Eliminar ítem" })).not.toBeInTheDocument();
    expect(screen.getByText(/no eliminar/)).toBeInTheDocument();
  });
});
