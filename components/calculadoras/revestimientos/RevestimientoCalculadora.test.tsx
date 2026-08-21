// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { CatalogoRow } from "@/lib/catalogo";
import { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import { RevestimientoCalculadora } from "./RevestimientoCalculadora";

const { guardarPresupuesto } = vi.hoisted(() => ({ guardarPresupuesto: vi.fn() }));
vi.mock("@/lib/presupuestos", () => ({ guardarPresupuesto }));

const CATALOGO_ORACULO: CatalogoRow[] = [
  { clave: "revestimiento_ceramico_bali", precio: 112000, descripcion: "Cerámico Bali Brasil (por m² instalado)" },
  { clave: "venecitas_premium_espana", precio: 140000, descripcion: "Venecitas Premium España (por m² instalado)" },
];

function totales() {
  return within(screen.getByTestId("totales"));
}

async function cargarMedidas(user: ReturnType<typeof userEvent.setup>, largo: string, ancho: string, profMin: string, profMax = "") {
  const setCampo = async (label: string, valor: string) => {
    const campo = screen.getByLabelText(label);
    await user.clear(campo);
    if (valor !== "" && valor !== "0") await user.type(campo, valor);
  };
  await setCampo("Largo pileta (m)", largo);
  await setCampo("Ancho pileta (m)", ancho);
  await setCampo("Profundidad desde (m)", profMin);
  if (profMax) await setCampo("Profundidad hasta (m)", profMax);
}

describe("RevestimientoCalculadora · paridad con el oráculo", () => {
  beforeEach(() => guardarPresupuesto.mockReset());

  it("sin ningún material tildado: TOTAL REVESTIMIENTO $0", async () => {
    const user = userEvent.setup();
    render(<RevestimientoCalculadora catalogo={CATALOGO_ORACULO} />);
    await cargarMedidas(user, "8", "4", "1.5");

    expect(totales().getByText("TOTAL REVESTIMIENTO")).toBeInTheDocument();
    expect(totales().getByText("$ 0")).toBeInTheDocument();
  });

  it("profundidad de menor a mayor usa el promedio (68 m² con prof pareja, 63,2 con 1→1,6)", async () => {
    const user = userEvent.setup();
    render(<RevestimientoCalculadora catalogo={CATALOGO_ORACULO} />);
    await cargarMedidas(user, "8", "4", "1", "1.6");

    expect(screen.getByText(/total 63,2 m² a revestir/)).toBeInTheDocument();
  });

  it("con escalera y desperdicio: se suman directo al total de m² (68 + 3 + 2 = 73)", async () => {
    const user = userEvent.setup();
    render(<RevestimientoCalculadora catalogo={CATALOGO_ORACULO} />);
    await cargarMedidas(user, "8", "4", "1.5");
    await user.type(screen.getByLabelText("Escalera (m²)"), "3");
    await user.type(screen.getByLabelText("Desperdicio (m²)"), "2");

    expect(screen.getByText(/total 73 m² a revestir/)).toBeInTheDocument();
  });

  it("un revestimiento incluido, cobrado por m² (68 m² × $112.000)", async () => {
    const user = userEvent.setup();
    render(<RevestimientoCalculadora catalogo={CATALOGO_ORACULO} />);
    await cargarMedidas(user, "8", "4", "1.5");
    await user.click(screen.getByLabelText("Cerámico Bali Brasil (por m² instalado) — $ 112.000/m²"));

    expect(totales().getByText("TOTAL REVESTIMIENTO")).toBeInTheDocument();
    expect(totales().getByText("$ 7.616.000")).toBeInTheDocument();
  });

  it("dos revestimientos incluidos: una línea de total por cada uno, no la suma", async () => {
    const user = userEvent.setup();
    render(<RevestimientoCalculadora catalogo={CATALOGO_ORACULO} />);
    await cargarMedidas(user, "8", "4", "1.5");
    await user.click(screen.getByLabelText("Cerámico Bali Brasil (por m² instalado) — $ 112.000/m²"));
    await user.click(screen.getByLabelText("Venecitas Premium España (por m² instalado) — $ 140.000/m²"));

    expect(totales().getByText("TOTAL revestimiento con Cerámico Bali Brasil")).toBeInTheDocument();
    expect(totales().getByText("$ 7.616.000")).toBeInTheDocument();
    expect(totales().getByText("TOTAL revestimiento con Venecitas Premium España")).toBeInTheDocument();
    expect(totales().getByText("$ 9.520.000")).toBeInTheDocument();
    expect(totales().queryByText("TOTAL REVESTIMIENTO")).not.toBeInTheDocument();
  });

  it("sin medidas: 0 m², total $0", async () => {
    render(<RevestimientoCalculadora catalogo={CATALOGO_ORACULO} />);
    expect(totales().getByText("$ 0")).toBeInTheDocument();
  });
});

describe("RevestimientoCalculadora · snapshot", () => {
  beforeEach(() => {
    guardarPresupuesto.mockReset();
    guardarPresupuesto.mockResolvedValue({ error: null });
  });

  it("guarda un PresupuestoV1 válido con las medidas y dos alternativas", async () => {
    const user = userEvent.setup();
    render(<RevestimientoCalculadora catalogo={CATALOGO_ORACULO} />);
    await cargarMedidas(user, "8", "4", "1.5");
    await user.click(screen.getByLabelText("Cerámico Bali Brasil (por m² instalado) — $ 112.000/m²"));
    await user.click(screen.getByLabelText("Venecitas Premium España (por m² instalado) — $ 140.000/m²"));
    await user.type(screen.getByLabelText("Señor/Sra"), "Gómez");
    await user.click(screen.getAllByRole("button", { name: "Guardar en la nube" })[0]);

    await waitFor(() => expect(guardarPresupuesto).toHaveBeenCalled());
    const [tipo, datos] = guardarPresupuesto.mock.calls[0];
    expect(tipo).toBe("revestimientos");
    const snapshot = PresupuestoV1.parse(datos);
    expect(snapshot.totales).toEqual([7616000, 9520000]);
    const alternativas = snapshot.lineas.filter((l) => l.naturaleza === "alternativa" && l.incluida);
    expect(alternativas).toHaveLength(2);
  });
});

describe("Fixture completa", () => {
  it("no queda ningún caso de tests/oracle/fixtures/revestimientos.json sin cubrir por nombre", () => {
    const fixture = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "..", "..", "tests", "oracle", "fixtures", "revestimientos.json"), "utf8")
    ) as { casos: { nombre: string }[] };
    expect(fixture.casos.map((c) => c.nombre)).toEqual([
      "profundidad pareja (solo desde)",
      "profundidad de menor a mayor (usa el promedio)",
      "con escalera y desperdicio",
      "un revestimiento incluido, cobrado por m²",
      "dos revestimientos incluidos",
      "sin medidas",
    ]);
  });
});
