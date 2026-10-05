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
  it("carga Largo/Ancho y completa sola la Dimensión con el párrafo base completo (como Pettenon)", async () => {
    const user = userEvent.setup();
    render(<PiscinaCalculadora catalogo={CATALOGO_ORACULO} />);

    await user.type(screen.getByLabelText("Largo (m)"), "8");
    await user.type(screen.getByLabelText("Ancho (m)"), "4");

    expect(screen.getByLabelText("Dimensión piscina")).toHaveValue(
      "8 mts largo por 4 mts ancho y de [profundidad mínima] mts a [profundidad máxima] mts de " +
        "profundidad, incluye cama de agua de [largo cama de agua] mts largo por 4 mts de ancho, " +
        "con escalera de tres escalones de 0.30 mts huella y [ancho escalera] mts de ancho para " +
        "ingreso a piscina.\n" +
        "Losetas Atérmicas Antideslizantes para el borde perimetral de la piscina 0.50 mts."
    );
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

    const texto = (screen.getByLabelText("Dimensión piscina") as HTMLTextAreaElement).value;
    expect(texto).toContain("8,5 mts largo por 4 mts ancho y de");
  });

  it("lo que varía obra por obra queda como placeholder entre corchetes, no un número inventado", async () => {
    const user = userEvent.setup();
    render(<PiscinaCalculadora catalogo={CATALOGO_ORACULO} />);

    await user.type(screen.getByLabelText("Largo (m)"), "8");
    await user.type(screen.getByLabelText("Ancho (m)"), "4");

    const texto = (screen.getByLabelText("Dimensión piscina") as HTMLTextAreaElement).value;
    expect(texto).toContain("[profundidad mínima]");
    expect(texto).toContain("[profundidad máxima]");
    expect(texto).toContain("[largo cama de agua]");
    expect(texto).toContain("[ancho escalera]");
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

describe("PiscinaCalculadora · precio de lista", () => {
  const CATALOGO_CON_LISTAS: CatalogoRow[] = [
    ...CATALOGO_ORACULO,
    { clave: "lista_hormigon_8x4", precio: 15390000, descripcion: "Piscina de hormigón 8x4" },
    { clave: "indusplast_caribe_550", precio: 8810000, descripcion: "Indusplast Caribe 550" },
    { clave: "lista_hormigon_6_5x2_5", precio: null, descripcion: "Piscina de hormigón 6.5x2.5" },
    { clave: "indusplast_spa_240", precio: 4715000, descripcion: "Indusplast Spa 240", activo: false },
  ];

  it("elegir una lista completa el subtotal, que sigue editable", async () => {
    const user = userEvent.setup();
    render(<PiscinaCalculadora catalogo={CATALOGO_CON_LISTAS} />);

    await user.selectOptions(screen.getByLabelText(/Precio de lista/), "lista_hormigon_8x4");

    expect(totales().getByText("$ 15.390.000")).toBeInTheDocument();
    await cargarSubtotal(user, "14000000");
    expect(totales().getByText("$ 14.000.000")).toBeInTheDocument();
  });

  it("las listas no aparecen como opcionales, y las dadas de baja o sin precio no se ofrecen", () => {
    render(<PiscinaCalculadora catalogo={CATALOGO_CON_LISTAS} />);

    expect(screen.queryByLabelText(/Piscina de hormigón 8x4 — \$/)).not.toBeInTheDocument();
    const select = screen.getByLabelText(/Precio de lista/);
    const opciones = within(select).getAllByRole("option").map((o) => o.textContent);
    expect(opciones.join("|")).toContain("Indusplast Caribe 550");
    expect(opciones.join("|")).not.toContain("Spa 240");
    expect(opciones.join("|")).not.toContain("6.5x2.5");
  });

  it("un ítem dado de baja no se ofrece como opcional en un presupuesto nuevo", () => {
    render(
      <PiscinaCalculadora
        catalogo={[...CATALOGO_ORACULO, { clave: "kit_limpieza", precio: 109000, descripcion: "Kit de limpieza", activo: false }]}
      />
    );
    expect(screen.queryByLabelText(/Kit de limpieza/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Luces de acero inoxidable/)).toBeInTheDocument();
  });
});
