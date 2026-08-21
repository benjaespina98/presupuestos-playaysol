// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { CatalogoRow } from "@/lib/catalogo";
import { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import { PiscinaCalculadora } from "./PiscinaCalculadora";

const { guardarPresupuesto } = vi.hoisted(() => ({ guardarPresupuesto: vi.fn() }));
vi.mock("@/lib/presupuestos", () => ({ guardarPresupuesto }));

const CATALOGO_ORACULO: CatalogoRow[] = [
  { clave: "luces", precio: 240000, descripcion: "Luces de acero inoxidable" },
  { clave: "bano_quimico", precio: null, descripcion: "Baño químico" },
];

function totales() {
  return within(screen.getByTestId("totales"));
}

async function cargarSubtotal(user: ReturnType<typeof userEvent.setup>, valor: string) {
  const campo = screen.getByLabelText("Subtotal construcción piscina");
  await user.clear(campo);
  if (valor !== "0") await user.type(campo, valor);
}

describe("PiscinaCalculadora · paridad con el oráculo", () => {
  beforeEach(() => guardarPresupuesto.mockReset());

  it("subtotal a mano, sin opcionales: sólo SUBTOTAL, sin línea TOTAL", async () => {
    const user = userEvent.setup();
    render(<PiscinaCalculadora catalogo={CATALOGO_ORACULO} />);
    await cargarSubtotal(user, "18500000");

    expect(totales().getByText("SUBTOTAL")).toBeInTheDocument();
    expect(totales().getByText("$ 18.500.000")).toBeInTheDocument();
    expect(totales().queryByText("TOTAL")).not.toBeInTheDocument();
  });

  it("sin subtotal cargado: SUBTOTAL $0", async () => {
    render(<PiscinaCalculadora catalogo={CATALOGO_ORACULO} />);
    expect(totales().getByText("$ 0")).toBeInTheDocument();
  });

  it("subtotal + un adicional: aparece la línea TOTAL", async () => {
    const user = userEvent.setup();
    render(<PiscinaCalculadora catalogo={CATALOGO_ORACULO} />);
    await cargarSubtotal(user, "18500000");
    await user.click(screen.getByRole("button", { name: "+ Agregar ítem" }));
    await user.type(screen.getByLabelText("Descripción"), "Traslado de equipos");
    await user.type(screen.getByLabelText("Precio"), "350000");

    expect(totales().getByText("TOTAL")).toBeInTheDocument();
    expect(totales().getByText("$ 18.850.000")).toBeInTheDocument();
  });

  it("subtotal + dos adicionales", async () => {
    const user = userEvent.setup();
    render(<PiscinaCalculadora catalogo={CATALOGO_ORACULO} />);
    await cargarSubtotal(user, "18500000");
    await user.click(screen.getByRole("button", { name: "+ Agregar ítem" }));
    await user.click(screen.getByRole("button", { name: "+ Agregar ítem" }));
    const descripciones = screen.getAllByLabelText("Descripción");
    const precios = screen.getAllByLabelText("Precio");
    await user.type(descripciones[0], "Traslado de equipos");
    await user.type(precios[0], "350000");
    await user.type(descripciones[1], "Retiro de tierra");
    await user.type(precios[1], "420000");

    expect(totales().getByText("$ 19.270.000")).toBeInTheDocument();
  });

  it("un opcional tildado no cambia el total (nunca suma)", async () => {
    const user = userEvent.setup();
    render(<PiscinaCalculadora catalogo={CATALOGO_ORACULO} />);
    await cargarSubtotal(user, "18500000");
    await user.click(screen.getByLabelText("Luces de acero inoxidable — $ 240.000"));

    expect(totales().getByText("$ 18.500.000")).toBeInTheDocument();
    expect(totales().queryByText("TOTAL")).not.toBeInTheDocument();
  });
});

describe("PiscinaCalculadora · snapshot", () => {
  beforeEach(() => {
    guardarPresupuesto.mockReset();
    guardarPresupuesto.mockResolvedValue({ error: null });
  });

  it("guarda un PresupuestoV1 válido", async () => {
    const user = userEvent.setup();
    render(<PiscinaCalculadora catalogo={CATALOGO_ORACULO} />);
    await cargarSubtotal(user, "18500000");
    await user.type(screen.getByLabelText("Señor/Sra"), "Pérez, Juan");
    await user.click(screen.getAllByRole("button", { name: "Guardar en la nube" })[0]);

    await waitFor(() => expect(guardarPresupuesto).toHaveBeenCalled());
    const [tipo, datos] = guardarPresupuesto.mock.calls[0];
    expect(tipo).toBe("piscinas");
    const snapshot = PresupuestoV1.parse(datos);
    expect(snapshot.totales).toEqual([18500000]);
  });

  it("largo/ancho son informativos: se guardan en medidas pero no alteran el subtotal", async () => {
    const user = userEvent.setup();
    render(<PiscinaCalculadora catalogo={CATALOGO_ORACULO} />);
    await cargarSubtotal(user, "18500000");
    await user.type(screen.getByLabelText("Largo (m)"), "8");
    await user.type(screen.getByLabelText("Ancho (m)"), "4");
    await user.click(screen.getAllByRole("button", { name: "Guardar en la nube" })[0]);

    await waitFor(() => expect(guardarPresupuesto).toHaveBeenCalled());
    const [, datos] = guardarPresupuesto.mock.calls[0];
    const snapshot = PresupuestoV1.parse(datos);
    expect(snapshot.medidas).toEqual({ largo: 8, ancho: 4 });
    expect(snapshot.totales).toEqual([18500000]); // el subtotal manual no se movió
  });
});

describe("PiscinaCalculadora · autocompletar Dimensión piscina", () => {
  it("carga Largo/Ancho y completa sola la Dimensión", async () => {
    const user = userEvent.setup();
    render(<PiscinaCalculadora catalogo={CATALOGO_ORACULO} />);

    await user.type(screen.getByLabelText("Largo (m)"), "8");
    await user.type(screen.getByLabelText("Ancho (m)"), "4");

    expect(screen.getByLabelText("Dimensión piscina")).toHaveValue("8 mts largo por 4 mts ancho");
  });

  it("si el vendedor edita la Dimensión a mano, un cambio posterior de medida no se la pisa", async () => {
    const user = userEvent.setup();
    render(<PiscinaCalculadora catalogo={CATALOGO_ORACULO} />);

    await user.type(screen.getByLabelText("Largo (m)"), "8");
    await user.type(screen.getByLabelText("Ancho (m)"), "4");
    const dimension = screen.getByLabelText("Dimensión piscina");
    await user.clear(dimension);
    await user.type(dimension, "Pileta con forma de riñón, profundidad variable");

    await user.clear(screen.getByLabelText("Ancho (m)"));
    await user.type(screen.getByLabelText("Ancho (m)"), "5");

    expect(dimension).toHaveValue("Pileta con forma de riñón, profundidad variable");
  });

  it("números con decimales se ven sin ceros de más (8.5, no 8.50)", async () => {
    const user = userEvent.setup();
    render(<PiscinaCalculadora catalogo={CATALOGO_ORACULO} />);

    await user.type(screen.getByLabelText("Largo (m)"), "8,5");
    await user.type(screen.getByLabelText("Ancho (m)"), "4");

    expect(screen.getByLabelText("Dimensión piscina")).toHaveValue("8,5 mts largo por 4 mts ancho");
  });
});

describe("Fixture completa", () => {
  it("no queda ningún caso de tests/oracle/fixtures/piscinas.json sin cubrir por nombre", () => {
    const fixture = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "..", "..", "tests", "oracle", "fixtures", "piscinas.json"), "utf8")
    ) as { casos: { nombre: string }[] };
    expect(fixture.casos.map((c) => c.nombre)).toEqual([
      "subtotal a mano, sin opcionales",
      "subtotal con un opcional tildado",
      "subtotal con tres opcionales tildados",
      "sin subtotal cargado",
      "subtotal + un adicional (aparece la línea TOTAL)",
      "subtotal + dos adicionales",
    ]);
  });
});
