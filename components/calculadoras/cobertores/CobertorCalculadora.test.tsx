// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { CatalogoRow } from "@/lib/catalogo";
import { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import { CobertorCalculadora } from "./CobertorCalculadora";

const { guardarPresupuesto } = vi.hoisted(() => ({ guardarPresupuesto: vi.fn() }));
vi.mock("@/lib/presupuestos", () => ({ guardarPresupuesto }));

/** Paridad contra tests/oracle/fixtures/cobertores.json (Lote 2), a través
 *  del formulario real — mismo criterio que CercosCalculadora.test.tsx. */
const CATALOGO_ORACULO: CatalogoRow[] = [
  { clave: "precioMenos15", precio: 10903, descripcion: "Precio por m² para piletas de hasta 15 m²" },
  { clave: "precioMas15", precio: 9902, descripcion: "Precio por m² para piletas de más de 15 m²" },
  { clave: "precioInstalacion", precio: 100000, descripcion: "Costo fijo de instalación" },
];

function totales() {
  return within(screen.getByTestId("totales"));
}

async function cargarMedidas(user: ReturnType<typeof userEvent.setup>, largo: string, ancho: string, adicional = "0") {
  const campoLargo = screen.getByLabelText("Largo pileta (m)");
  await user.clear(campoLargo);
  if (largo !== "") await user.type(campoLargo, largo);
  const campoAncho = screen.getByLabelText("Ancho pileta (m)");
  await user.clear(campoAncho);
  if (ancho !== "") await user.type(campoAncho, ancho);
  const campoAdicional = screen.getByLabelText("Adicional (m²)");
  await user.clear(campoAdicional);
  if (adicional !== "0") await user.type(campoAdicional, adicional);
}

describe("CobertorCalculadora · paridad con el oráculo", () => {
  beforeEach(() => guardarPresupuesto.mockReset());

  it("borde: exactamente 15 m² (3 × 5) paga el precio caro (regla > 15, no >= 15)", async () => {
    const user = userEvent.setup();
    render(<CobertorCalculadora catalogo={CATALOGO_ORACULO} />);
    await cargarMedidas(user, "3", "5");

    expect(totales().getByText("$ 163.545")).toBeInTheDocument();
    expect(totales().getByText("$ 263.545")).toBeInTheDocument();
  });

  it("borde: apenas encima de 15 m² (3 × 5,1) ya paga el precio barato", async () => {
    const user = userEvent.setup();
    render(<CobertorCalculadora catalogo={CATALOGO_ORACULO} />);
    await cargarMedidas(user, "3", "5.1");

    expect(totales().getByText("$ 151.500,6")).toBeInTheDocument();
  });

  it("pileta grande 8 × 4", async () => {
    const user = userEvent.setup();
    render(<CobertorCalculadora catalogo={CATALOGO_ORACULO} />);
    await cargarMedidas(user, "8", "4");

    expect(totales().getByText("$ 316.864")).toBeInTheDocument();
    expect(totales().getByText("$ 416.864")).toBeInTheDocument();
  });

  it("borde: apenas debajo de 15 m² (3 × 4,9)", async () => {
    const user = userEvent.setup();
    render(<CobertorCalculadora catalogo={CATALOGO_ORACULO} />);
    await cargarMedidas(user, "3", "4.9");

    expect(totales().getByText("$ 160.274,1")).toBeInTheDocument();
  });

  it("el adicional de m² cruza el umbral (3 × 4,5 = 13,5 + 2 = 15,5)", async () => {
    const user = userEvent.setup();
    render(<CobertorCalculadora catalogo={CATALOGO_ORACULO} />);
    await cargarMedidas(user, "3", "4.5", "2");

    expect(totales().getByText("$ 153.481")).toBeInTheDocument();
  });

  it("el adicional de m² NO alcanza a cruzarlo (13,5 + 1 = 14,5)", async () => {
    const user = userEvent.setup();
    render(<CobertorCalculadora catalogo={CATALOGO_ORACULO} />);
    await cargarMedidas(user, "3", "4.5", "1");

    expect(totales().getByText("$ 158.093,5")).toBeInTheDocument();
  });

  it("sin medidas: sin instalación es $0, con instalación es sólo el costo fijo", async () => {
    render(<CobertorCalculadora catalogo={CATALOGO_ORACULO} />);
    expect(totales().getByText("$ 0")).toBeInTheDocument();
    expect(totales().getByText("$ 100.000")).toBeInTheDocument();
  });
});

describe("CobertorCalculadora · snapshot", () => {
  beforeEach(() => {
    guardarPresupuesto.mockReset();
    guardarPresupuesto.mockResolvedValue({ error: null });
  });

  it("guarda un PresupuestoV1 válido con las medidas y precios congelados", async () => {
    const user = userEvent.setup();
    render(<CobertorCalculadora catalogo={CATALOGO_ORACULO} />);
    await cargarMedidas(user, "8", "4");
    await user.type(screen.getByLabelText("Señor/Sra"), "Gómez, Ana");
    await user.click(screen.getAllByRole("button", { name: "Guardar en la nube" })[0]);

    await waitFor(() => expect(guardarPresupuesto).toHaveBeenCalled());
    const [tipo, datos] = guardarPresupuesto.mock.calls[0];
    expect(tipo).toBe("cobertores");
    const snapshot = PresupuestoV1.parse(datos);
    expect(snapshot.totales).toEqual([316864, 416864]);
    expect(snapshot.medidas).toEqual({ largo: 8, ancho: 4, adicionalM2: 0 });
    expect(snapshot.preciosBase).toEqual({
      precioPorM2HastaUmbral: 10903,
      precioPorM2SobreUmbral: 9902,
      precioInstalacion: 100000,
    });
  });
});

describe("Fixture completa: todos los nombres de caso están cubiertos por algún test", () => {
  it("no queda ningún caso de tests/oracle/fixtures/cobertores.json sin ejercitar acá", () => {
    const fixture = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "..", "..", "..", "tests", "oracle", "fixtures", "cobertores.json"),
        "utf8"
      )
    ) as { casos: { nombre: string }[] };
    expect(fixture.casos.map((c) => c.nombre)).toEqual([
      "borde: exactamente 15 m² (3 × 5)",
      "borde: apenas debajo de 15 m² (3 × 4,9)",
      "borde: apenas encima de 15 m² (3 × 5,1)",
      "pileta grande 8 × 4",
      "el adicional de m² cruza el umbral (3 × 4,5 = 13,5 + 2 = 15,5)",
      "el adicional de m² NO alcanza a cruzarlo (13,5 + 1 = 14,5)",
      "sin medidas",
    ]);
  });
});
