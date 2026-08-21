// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { CatalogoRow } from "@/lib/catalogo";
import { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import { CercosCalculadora } from "./CercosCalculadora";

const { guardarPresupuesto } = vi.hoisted(() => ({ guardarPresupuesto: vi.fn() }));
vi.mock("@/lib/presupuestos", () => ({ guardarPresupuesto }));

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LOTE 2 — PARIDAD contra el oráculo
 * ═══════════════════════════════════════════════════════════════════════════
 * Los mismos casos que tests/oracle/fixtures/cercos.json y
 * lib/domain/precios/contra-oraculo.test.ts, pero ejercitados a través del
 * FORMULARIO REACT en vez de llamar a calcularCerco() directo — es la prueba
 * de que la UI nueva reproduce el legacy, no sólo el motor.
 */

const CATALOGO_ORACULO: CatalogoRow[] = [
  { clave: "precioSin", precio: 63500, descripcion: "Precio por metro lineal sin instalación" },
  { clave: "precioCon", precio: 79500, descripcion: "Precio por metro lineal con instalación" },
  { clave: "porton_reforzado", precio: null, descripcion: "Portón de acceso reforzado" },
];

async function cargarMetros(user: ReturnType<typeof userEvent.setup>, metros: string) {
  const input = screen.getByLabelText("Metros lineales a cercar (ml)");
  await user.clear(input);
  if (metros !== "") await user.type(input, metros);
}

/** El panel de "Resultado" repite el mismo importe que la base cuando no hay
 *  adicionales (base === total) — por eso todas las aserciones de totales
 *  quedan acotadas a este bloque en vez de buscar el texto en toda la
 *  pantalla. */
function totales() {
  return within(screen.getByTestId("totales"));
}

describe("CercosCalculadora · paridad con el oráculo", () => {
  beforeEach(() => {
    guardarPresupuesto.mockReset();
  });

  it("24 ml, ambos precios", async () => {
    const user = userEvent.setup();
    render(<CercosCalculadora catalogo={CATALOGO_ORACULO} />);
    await cargarMetros(user, "24");

    expect(totales().getByText("TOTAL SIN INSTALACIÓN")).toBeInTheDocument();
    expect(totales().getByText("$ 1.524.000")).toBeInTheDocument();
    expect(totales().getByText("TOTAL CON INSTALACIÓN")).toBeInTheDocument();
    expect(totales().getByText("$ 1.908.000")).toBeInTheDocument();
  });

  it("24 ml, solo sin instalación", async () => {
    const user = userEvent.setup();
    render(<CercosCalculadora catalogo={CATALOGO_ORACULO} />);
    await cargarMetros(user, "24");
    await user.selectOptions(screen.getByLabelText("¿Qué mostrar en el presupuesto?"), "sin");

    expect(totales().getByText("TOTAL")).toBeInTheDocument();
    expect(totales().getByText("$ 1.524.000")).toBeInTheDocument();
    expect(totales().queryByText("TOTAL CON INSTALACIÓN")).not.toBeInTheDocument();
  });

  it("24 ml, solo con instalación", async () => {
    const user = userEvent.setup();
    render(<CercosCalculadora catalogo={CATALOGO_ORACULO} />);
    await cargarMetros(user, "24");
    await user.selectOptions(screen.getByLabelText("¿Qué mostrar en el presupuesto?"), "con");

    expect(totales().getByText("TOTAL (incluye instalación)")).toBeInTheDocument();
    expect(totales().getByText("$ 1.908.000")).toBeInTheDocument();
  });

  it("cero metros", async () => {
    const user = userEvent.setup();
    render(<CercosCalculadora catalogo={CATALOGO_ORACULO} />);
    await cargarMetros(user, "");

    expect(totales().getAllByText("$ 0")).toHaveLength(2);
  });

  it("metros con decimales (18,5)", async () => {
    const user = userEvent.setup();
    render(<CercosCalculadora catalogo={CATALOGO_ORACULO} />);
    await cargarMetros(user, "18.5");

    expect(totales().getByText("$ 1.174.750")).toBeInTheDocument();
    expect(totales().getByText("$ 1.470.750")).toBeInTheDocument();
  });

  it("24 ml con un opcional incluido: el opcional NO suma al total", async () => {
    const user = userEvent.setup();
    render(<CercosCalculadora catalogo={CATALOGO_ORACULO} />);
    await cargarMetros(user, "24");

    await user.click(screen.getByLabelText("Portón de acceso reforzado — a cotizar"));

    // Mismos totales que el caso base sin ningún opcional tildado.
    expect(totales().getByText("$ 1.524.000")).toBeInTheDocument();
    expect(totales().getByText("$ 1.908.000")).toBeInTheDocument();
  });
});

describe("CercosCalculadora · Lote 3, snapshot autosuficiente", () => {
  beforeEach(() => {
    guardarPresupuesto.mockReset();
    guardarPresupuesto.mockResolvedValue({ error: null });
  });

  it("guarda un PresupuestoV1 válido con los totales y precios ya congelados", async () => {
    const user = userEvent.setup();
    render(<CercosCalculadora catalogo={CATALOGO_ORACULO} />);

    await cargarMetros(user, "24");
    await user.type(screen.getByLabelText("Señor/Sra"), "Pérez, Juan");
    await user.click(screen.getByRole("button", { name: "Guardar en la nube" }));

    await waitFor(() => expect(guardarPresupuesto).toHaveBeenCalled());
    const [tipo, datos, clienteNombre] = guardarPresupuesto.mock.calls[0];
    expect(tipo).toBe("cercos");
    expect(clienteNombre).toBe("Pérez, Juan");

    // El snapshot completo tiene que ser un PresupuestoV1 válido: si algo
    // faltara (o sobrara con un tipo raro), esto explota antes que el test.
    const snapshot = PresupuestoV1.parse(datos);
    expect(snapshot.v).toBe(1);
    expect(snapshot.totales).toEqual([1524000, 1908000]);
    expect(snapshot.preciosBase).toEqual({
      precioPorMlSinInstalacion: 63500,
      precioPorMlConInstalacion: 79500,
    });
    expect(snapshot.medidas).toEqual({ metrosLineales: 24 });
  });

  it("el snapshot es autosuficiente: no queda ninguna referencia al array de catálogo original", async () => {
    const user = userEvent.setup();
    const catalogoMutable = CATALOGO_ORACULO.map((r) => ({ ...r }));
    render(<CercosCalculadora catalogo={catalogoMutable} />);
    await cargarMetros(user, "24");
    await user.click(screen.getByRole("button", { name: "Guardar en la nube" }));

    await waitFor(() => expect(guardarPresupuesto).toHaveBeenCalled());
    const datos = guardarPresupuesto.mock.calls[0][1] as unknown as { preciosBase: Record<string, number> };

    // Cambiar el catálogo "en producción" después de guardar no puede mover
    // un número que ya viajó en el snapshot — porque no es el mismo objeto.
    catalogoMutable[0].precio = 999999;
    expect(datos.preciosBase.precioPorMlSinInstalacion).toBe(63500);
  });

  it("un opcional incluido queda congelado en `lineas` como informativa, sin sumar al total", async () => {
    const user = userEvent.setup();
    render(<CercosCalculadora catalogo={CATALOGO_ORACULO} />);
    await cargarMetros(user, "24");
    await user.click(screen.getByLabelText("Portón de acceso reforzado — a cotizar"));
    await user.click(screen.getByRole("button", { name: "Guardar en la nube" }));

    await waitFor(() => expect(guardarPresupuesto).toHaveBeenCalled());
    const snapshot = PresupuestoV1.parse(guardarPresupuesto.mock.calls[0][1]);
    const linea = snapshot.lineas.find((l) => l.clave === "porton_reforzado");
    expect(linea?.naturaleza).toBe("informativa");
    expect(linea?.incluida).toBe(true);
    expect(linea?.precioUnitario).toBeNull();
    // El total impreso sigue siendo el mismo que sin ningún opcional.
    expect(snapshot.totales).toEqual([1524000, 1908000]);
  });
});

describe("Fixture completa: todos los nombres de caso están cubiertos", () => {
  it("no queda ningún caso de tests/oracle/fixtures/cercos.json sin un test acá arriba", () => {
    const fixture = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "..", "..", "..", "tests", "oracle", "fixtures", "cercos.json"),
        "utf8"
      )
    ) as { casos: { nombre: string }[] };
    const nombres = fixture.casos.map((c) => c.nombre);
    expect(nombres).toEqual([
      "24 ml, ambos precios",
      "24 ml, solo sin instalación",
      "24 ml, solo con instalación",
      "cero metros",
      "metros con decimales (18,5)",
      "24 ml con un opcional incluido",
    ]);
  });
});
