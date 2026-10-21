// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CatalogoRow } from "@/lib/catalogo";
import { PiscinaCalculadora } from "@/components/calculadoras/piscinas/PiscinaCalculadora";
import { CamposSoloLectura, ProveerAnulado, SoloSiNoAnulado } from "./Anulado";

vi.mock("@/lib/presupuestos", () => ({ guardarPresupuesto: vi.fn(), actualizarPresupuesto: vi.fn(), subirFotoPresupuesto: vi.fn() }));

const ANULADO = { motivo: "Se cargó dos veces", fecha: "2026-10-01T10:00:00Z" };
const CATALOGO: CatalogoRow[] = [{ clave: "luces", precio: 240000, descripcion: "Luces de acero inoxidable" }];

describe("CamposSoloLectura / SoloSiNoAnulado", () => {
  function formulario() {
    return (
      <form>
        <CamposSoloLectura>
          <input aria-label="Cliente" />
          <select aria-label="Tipo">
            <option>uno</option>
          </select>
          <textarea aria-label="Notas" />
          <button type="button">Agregar ítem</button>
        </CamposSoloLectura>
        <SoloSiNoAnulado>
          <button type="submit">Guardar en la nube</button>
        </SoloSiNoAnulado>
        <button type="button">Word</button>
      </form>
    );
  }

  it("sin anulación todo se puede editar y guardar", () => {
    render(<ProveerAnulado anulado={null}>{formulario()}</ProveerAnulado>);
    expect(screen.getByLabelText("Cliente")).toBeEnabled();
    expect(screen.getByLabelText("Tipo")).toBeEnabled();
    expect(screen.getByLabelText("Notas")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Agregar ítem" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Guardar en la nube" })).toBeInTheDocument();
  });

  it("anulado: los campos quedan deshabilitados, no hay Guardar, y exportar sigue disponible", () => {
    render(<ProveerAnulado anulado={ANULADO}>{formulario()}</ProveerAnulado>);
    expect(screen.getByLabelText("Cliente")).toBeDisabled();
    expect(screen.getByLabelText("Tipo")).toBeDisabled();
    expect(screen.getByLabelText("Notas")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Agregar ítem" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Guardar en la nube" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Word" })).toBeEnabled();
  });
});

describe("una calculadora real con un presupuesto anulado", () => {
  it("muestra sus campos deshabilitados, sin Guardar, y deja exportar", () => {
    render(
      <ProveerAnulado anulado={ANULADO}>
        <PiscinaCalculadora catalogo={CATALOGO} presupuestoId="p1" />
      </ProveerAnulado>
    );
    expect(screen.getByLabelText("Subtotal construcción piscina")).toBeDisabled();
    expect(screen.getByLabelText("Señor/Sra")).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Guardar en la nube/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Word" })[0]).toBeEnabled();
  });

  it("sin anulación los mismos campos se pueden editar y hay Guardar", () => {
    render(
      <ProveerAnulado anulado={null}>
        <PiscinaCalculadora catalogo={CATALOGO} presupuestoId="p1" />
      </ProveerAnulado>
    );
    expect(screen.getByLabelText("Subtotal construcción piscina")).toBeEnabled();
    expect(screen.getByLabelText("Señor/Sra")).toBeEnabled();
    expect(screen.getAllByRole("button", { name: /Guardar en la nube/ }).length).toBeGreaterThan(0);
  });
});
