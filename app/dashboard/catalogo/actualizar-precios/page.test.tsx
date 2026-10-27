// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Material } from "@/lib/domain/abastecimiento/material";
import type { Proveedor } from "@/lib/domain/abastecimiento/proveedor";
import Pagina from "./page";

const nav = vi.hoisted(() => ({ que: "materiales", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace }),
  useSearchParams: () => new URLSearchParams({ que: nav.que }),
}));

const abast = vi.hoisted(() => ({ listarProveedores: vi.fn(), listarMateriales: vi.fn(), actualizarPreciosMateriales: vi.fn() }));
vi.mock("@/lib/abastecimiento", () => abast);
const cat = vi.hoisted(() => ({ listarItemsCatalogo: vi.fn(), actualizarPreciosItems: vi.fn() }));
vi.mock("@/lib/catalogo", () => cat);

const proveedor = (o: Partial<Proveedor>): Proveedor => ({
  id: "p1", nombre: "Ranco", rubro: null, contacto: null, telefono: null, forma_pago: null, plazo: null, notas: null, activo: true, orden: 1, updated_at: "", ...o,
});
const mat = (o: Partial<Material>): Material => ({
  id: "m1", nombre: "Cemento 25 kg", proveedor_id: "p1", unidad: "bolsa", precio: 1000, precio_actualizado: "2026-06-18", rubro: "Materiales",
  aplica: "Siempre", usd_ref: null, notas: null, cantidades: {}, activo: true, orden: 1, updated_at: "", ...o,
});

describe("Actualizar precios", () => {
  beforeEach(() => {
    Object.values(abast).forEach((m) => m.mockReset());
    Object.values(cat).forEach((m) => m.mockReset());
    nav.que = "materiales";
    abast.listarProveedores.mockResolvedValue({ items: [proveedor({})], error: null });
    abast.listarMateriales.mockResolvedValue({
      items: [mat({}), mat({ id: "m2", nombre: "Arena", precio: 2000 }), mat({ id: "m3", nombre: "Cable en dólares", precio: null, usd_ref: 50 })],
      error: null,
    });
    cat.listarItemsCatalogo.mockResolvedValue({ items: [], error: null });
  });

  it("sólo se guardan las filas con un precio nuevo y distinto; hay que confirmar y se manda el campo correcto (USD para los cotizados en dólares)", async () => {
    abast.actualizarPreciosMateriales.mockResolvedValue({ guardados: ["m1", "m3"], fallidos: [] });
    const user = userEvent.setup();
    render(<Pagina />);
    await user.type(await screen.findByLabelText("Precio nuevo de Cemento 25 kg"), "1.100");
    await user.type(screen.getByLabelText("Precio nuevo de Arena"), "2000"); // igual al actual: no cuenta
    await user.type(screen.getByLabelText("Precio nuevo de Cable en dólares"), "55");

    expect(screen.getByText((_, el) => el?.tagName === "P" && /^2 cambios sin guardar$/.test(el.textContent ?? ""))).toBeInTheDocument();
    expect(screen.getAllByText("+10 %")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(abast.actualizarPreciosMateriales).not.toHaveBeenCalled(); // falta confirmar
    await user.click(screen.getByRole("button", { name: /Confirmar 2 cambios/ }));

    await waitFor(() => expect(abast.actualizarPreciosMateriales).toHaveBeenCalledTimes(1));
    const enviado = abast.actualizarPreciosMateriales.mock.calls[0][0];
    expect(enviado).toHaveLength(2);
    expect(enviado).toEqual(
      expect.arrayContaining([
        { id: "m1", campo: "precio", valor: 1100 },
        { id: "m3", campo: "usd_ref", valor: 55 },
      ])
    );
    expect(await screen.findByText(/Se actualizaron 2 precios/)).toBeInTheDocument();
    expect(await screen.findByText("$ 1.100")).toBeInTheDocument();
  });

  it("un precio ilegible bloquea el guardado y se marca", async () => {
    const user = userEvent.setup();
    render(<Pagina />);
    await user.type(await screen.findByLabelText("Precio nuevo de Arena"), "abc");
    expect(screen.getByText("No se entiende")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
  });

  it("el porcentaje completa los precios de lo que se ve, sin guardar nada", async () => {
    const user = userEvent.setup();
    render(<Pagina />);
    await screen.findByLabelText("Precio nuevo de Arena");
    await user.type(screen.getByLabelText("Subir o bajar todo (%)"), "10");
    await user.click(screen.getByRole("button", { name: /Calcular en 3 precios/ }));
    expect(screen.getByLabelText("Precio nuevo de Cemento 25 kg")).toHaveValue("1100");
    expect(screen.getByLabelText("Precio nuevo de Arena")).toHaveValue("2200");
    expect(screen.getByLabelText("Precio nuevo de Cable en dólares")).toHaveValue("55");
    expect(abast.actualizarPreciosMateriales).not.toHaveBeenCalled();
  });

  it("si una fila falla, se avisa cuál y queda cargada para reintentar", async () => {
    abast.actualizarPreciosMateriales.mockResolvedValue({ guardados: [], fallidos: [{ id: "m2", error: "El material ya no existe." }] });
    const user = userEvent.setup();
    render(<Pagina />);
    await user.type(await screen.findByLabelText("Precio nuevo de Arena"), "2500");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await user.click(screen.getByRole("button", { name: /Confirmar 1 cambio/ }));
    expect(await screen.findByText(/Arena: El material ya no existe/)).toBeInTheDocument();
    expect(screen.getByLabelText("Precio nuevo de Arena")).toHaveValue("2500");
  });
  it("una lista pegada completa los precios que reconoce y avisa los que no", async () => {
    const user = userEvent.setup();
    render(<Pagina />);
    await screen.findByLabelText("Precio nuevo de Arena");
    await user.click(screen.getByText("Pegar una lista de precios"));
    await user.click(screen.getByLabelText("Lista de precios"));
    await user.paste("Cemento 25 kg — 1.250\nArena 2300\nZuipy 200 1500000");
    await user.click(screen.getByRole("button", { name: "Cargar la lista" }));
    expect(screen.getByLabelText("Precio nuevo de Cemento 25 kg")).toHaveValue("1.250");
    expect(screen.getByLabelText("Precio nuevo de Arena")).toHaveValue("2300");
    expect(screen.getByText(/Zuipy 200 \(no está en la lista\)/)).toBeInTheDocument();
    expect(abast.actualizarPreciosMateriales).not.toHaveBeenCalled();
  });
});
