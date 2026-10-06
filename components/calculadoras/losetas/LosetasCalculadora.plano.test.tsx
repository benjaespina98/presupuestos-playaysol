// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import { LosetasCalculadora } from "./LosetasCalculadora";

const { guardarPresupuesto, actualizarPresupuesto } = vi.hoisted(() => ({
  guardarPresupuesto: vi.fn(),
  actualizarPresupuesto: vi.fn(),
}));
vi.mock("@/lib/presupuestos", () => ({ guardarPresupuesto, actualizarPresupuesto }));

// La rasterización real no existe en jsdom (ver LosetasCalculadora.test.tsx).
vi.mock("@/lib/documentos/losetas/imagenCliente", () => ({
  generarImagenClientePlano: vi.fn(),
  generarPdfClientePlano: vi.fn(),
}));
vi.mock("@/lib/documentos/compartir", () => ({ compartirOdescargarArchivo: vi.fn() }));

async function cargarMedidas(user: ReturnType<typeof userEvent.setup>, largo: string, ancho: string) {
  const largoInput = screen.getByLabelText("Largo (m)");
  const anchoInput = screen.getByLabelText("Ancho (m)");
  await user.clear(largoInput);
  await user.type(largoInput, largo);
  await user.clear(anchoInput);
  await user.type(anchoInput, ancho);
}

const vista = () => screen.getByRole("img", { name: "Vista previa del plano para el cliente" });
const BOTON_AGREGAR_TRAMO = "+ Agregar tramo con otra profundidad";

describe("LosetasCalculadora · material alrededor de la pileta", () => {
  beforeEach(() => {
    guardarPresupuesto.mockReset();
    guardarPresupuesto.mockResolvedValue({ error: null });
  });

  it("ofrece losetas, decks y travertino; losetas por defecto", () => {
    render(<LosetasCalculadora />);
    const select = screen.getByLabelText("Material alrededor de la pileta") as HTMLSelectElement;
    expect(select.value).toBe("losetas");
    expect([...select.options].map((o) => o.textContent)).toEqual(["Losetas", "Decks", "Travertino"]);
  });

  it("elegir decks o travertino cambia el nombre en la leyenda del plano del cliente", async () => {
    const user = userEvent.setup();
    render(<LosetasCalculadora />);
    await cargarMedidas(user, "8", "4");

    expect(vista().textContent).toContain("Borde de loseta");
    await user.selectOptions(screen.getByLabelText("Material alrededor de la pileta"), "decks");
    await waitFor(() => expect(vista().textContent).toContain("Borde de deck"));
    await user.selectOptions(screen.getByLabelText("Material alrededor de la pileta"), "travertino");
    await waitFor(() => expect(vista().textContent).toContain("Borde de travertino"));
  });

  it("cambia el color de fábrica del borde con el material, pero respeta uno elegido a mano", async () => {
    const user = userEvent.setup();
    render(<LosetasCalculadora />);
    const color = () => (screen.getByLabelText(/Color del borde/) as HTMLInputElement).value.toLowerCase();

    expect(color()).toBe("#f7e6d3");
    await user.selectOptions(screen.getByLabelText("Material alrededor de la pileta"), "decks");
    await waitFor(() => expect(color()).toBe("#c9a27e"));

    fireEvent.input(screen.getByLabelText(/Color del borde/), { target: { value: "#123456" } });
    await user.selectOptions(screen.getByLabelText("Material alrededor de la pileta"), "travertino");
    expect(color()).toBe("#123456");
  });

  it("el material se guarda con el plano y se recupera al reabrirlo", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<LosetasCalculadora />);
    await cargarMedidas(user, "8", "4");
    await user.selectOptions(screen.getByLabelText("Material alrededor de la pileta"), "travertino");
    await user.click(screen.getAllByRole("button", { name: "Guardar en la nube" })[0]);

    await waitFor(() => expect(guardarPresupuesto).toHaveBeenCalled());
    const guardado = PresupuestoV1.parse(guardarPresupuesto.mock.calls[0][1]);
    expect(guardado.medidas).toMatchObject({ materialBorde: "travertino" });
    unmount();

    render(
      <LosetasCalculadora
        presupuestoId="x"
        presupuestoInicial={{ presupuesto: guardado, preciosCongelados: true, clavesIncluidas: [] }}
      />
    );
    expect((screen.getByLabelText("Material alrededor de la pileta") as HTMLSelectElement).value).toBe("travertino");
  });

  it("un plano guardado antes de poder elegir el material se abre como losetas", () => {
    render(
      <LosetasCalculadora
        presupuestoInicial={{
          presupuesto: PresupuestoV1.parse({
            v: 1,
            tipo: "losetas",
            fecha: "",
            cliente: { nombre: "Viejo" },
            medidas: { largo: 8, ancho: 4, solar: 1, opuesto: 1, lateral1: 1, lateral2: 1 },
            lineas: [],
            totales: [],
          }),
          preciosCongelados: true,
          clavesIncluidas: [],
        }}
      />
    );
    expect((screen.getByLabelText("Material alrededor de la pileta") as HTMLSelectElement).value).toBe("losetas");
  });
});

describe("LosetasCalculadora · profundidad", () => {
  beforeEach(() => {
    guardarPresupuesto.mockReset();
    guardarPresupuesto.mockResolvedValue({ error: null });
  });

  it("una profundidad general sale en el título del plano", async () => {
    const user = userEvent.setup();
    render(<LosetasCalculadora />);
    await cargarMedidas(user, "8", "4");

    await user.type(screen.getByLabelText("Profundidad de toda la pileta (m)"), "1,15");

    await waitFor(() => expect(vista().textContent).toContain("Prof. 1,15 m"));
  });

  it("'de 0 a 3 m, 1,00; el resto, 1,10': se agrega un tramo y el plano lo dibuja", async () => {
    const user = userEvent.setup();
    render(<LosetasCalculadora />);
    await cargarMedidas(user, "8", "4");
    await user.type(screen.getByLabelText("Profundidad de toda la pileta (m)"), "1,10");

    await user.click(screen.getByRole("button", { name: BOTON_AGREGAR_TRAMO }));
    // Con un tramo, la profundidad general pasa a ser la del "resto".
    expect(screen.getByLabelText("Profundidad del resto de la pileta (m)")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Hasta (m)"), "3");
    await user.type(screen.getByLabelText("Profundidad (m)"), "1");

    await waitFor(() => {
      expect(vista().textContent).toContain("Prof. 1,00 a 1,10 m");
      expect(vista().textContent).toContain("0 a 3 m");
      expect(vista().textContent).toContain("3 a 8 m");
    });
  });

  it("avisa si un tramo se pasa del largo de la pileta", async () => {
    const user = userEvent.setup();
    render(<LosetasCalculadora />);
    await cargarMedidas(user, "8", "4");
    await user.click(screen.getByRole("button", { name: BOTON_AGREGAR_TRAMO }));
    await user.type(screen.getByLabelText("Hasta (m)"), "12");
    await user.type(screen.getByLabelText("Profundidad (m)"), "1");

    expect(await screen.findByText(/se pasa del largo/)).toBeInTheDocument();
  });

  it("se puede quitar un tramo", async () => {
    const user = userEvent.setup();
    render(<LosetasCalculadora />);
    await user.click(screen.getByRole("button", { name: BOTON_AGREGAR_TRAMO }));
    expect(screen.getByLabelText("Hasta (m)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Quitar el tramo 1" }));

    expect(screen.queryByLabelText("Hasta (m)")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Profundidad de toda la pileta (m)")).toBeInTheDocument();
  });

  it("la profundidad y los tramos se guardan con el plano y se recuperan al reabrirlo", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<LosetasCalculadora />);
    await cargarMedidas(user, "8", "4");
    await user.type(screen.getByLabelText("Profundidad de toda la pileta (m)"), "1,10");
    await user.click(screen.getByRole("button", { name: BOTON_AGREGAR_TRAMO }));
    await user.type(screen.getByLabelText("Hasta (m)"), "3");
    await user.type(screen.getByLabelText("Profundidad (m)"), "1");
    await user.click(screen.getAllByRole("button", { name: "Guardar en la nube" })[0]);

    await waitFor(() => expect(guardarPresupuesto).toHaveBeenCalled());
    const guardado = PresupuestoV1.parse(guardarPresupuesto.mock.calls[0][1]);
    expect(guardado.medidas).toMatchObject({ profundidad: 1.1, tramosProfundidad: [{ desde: 0, hasta: 3, prof: 1 }] });
    unmount();

    render(
      <LosetasCalculadora
        presupuestoId="x"
        presupuestoInicial={{ presupuesto: guardado, preciosCongelados: true, clavesIncluidas: [] }}
      />
    );
    expect(screen.getByLabelText("Hasta (m)")).toHaveValue("3");
    await waitFor(() => expect(vista().textContent).toContain("Prof. 1,00 a 1,10 m"));
  });
});
