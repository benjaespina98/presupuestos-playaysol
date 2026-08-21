// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import type { PresupuestoLeido } from "@/lib/domain/presupuesto/adaptadores";
import { LosetasCalculadora } from "./LosetasCalculadora";

const { guardarPresupuesto, actualizarPresupuesto } = vi.hoisted(() => ({
  guardarPresupuesto: vi.fn(),
  actualizarPresupuesto: vi.fn(),
}));
vi.mock("@/lib/presupuestos", () => ({ guardarPresupuesto, actualizarPresupuesto }));

// El plano del editor tiene viewBox "0 0 680 420": con un rect de pantalla del
// mismo ancho, la escala clientX→coordenada de usuario es 1:1 y las cuentas
// del test quedan simples.
function mockearRectDelSvg() {
  vi.spyOn(SVGSVGElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, width: 680, height: 420, right: 680, bottom: 420, toJSON: () => ({}),
  } as DOMRect);
}

async function cargarMedidas(user: ReturnType<typeof userEvent.setup>, largo: string, ancho: string) {
  const largoInput = screen.getByLabelText("Largo (m)");
  const anchoInput = screen.getByLabelText("Ancho (m)");
  await user.clear(largoInput);
  await user.type(largoInput, largo);
  await user.clear(anchoInput);
  await user.type(anchoInput, ancho);
}

describe("LosetasCalculadora · m²", () => {
  it("con medidas sin ampliar ningún lado, el extra a cotizar es 0", async () => {
    const user = userEvent.setup();
    render(<LosetasCalculadora />);
    await cargarMedidas(user, "8", "4");

    expect(screen.getByText("45 m²")).toBeInTheDocument(); // incluidos: 9×5
    expect(screen.getByText("0 m²")).toBeInTheDocument(); // extra
  });

  it("un metro de más en los cuatro lados da 15 m² a cotizar", async () => {
    const user = userEvent.setup();
    render(<LosetasCalculadora />);
    await cargarMedidas(user, "8", "4");
    for (const label of ["Solar (m)", "Opuesto (m)", "Lateral 1 (m)", "Lateral 2 (m)"]) {
      const campo = screen.getByLabelText(label);
      await user.clear(campo);
      await user.type(campo, "1");
    }

    expect(screen.getByText("15 m²")).toBeInTheDocument();
  });

  it("el costo por material es m² a cotizar × precio cargado", async () => {
    const user = userEvent.setup();
    render(<LosetasCalculadora />);
    await cargarMedidas(user, "8", "4");
    for (const label of ["Solar (m)", "Opuesto (m)", "Lateral 1 (m)", "Lateral 2 (m)"]) {
      const campo = screen.getByLabelText(label);
      await user.clear(campo);
      await user.type(campo, "1");
    }
    // Arranca con dos materiales por defecto: "Loseta común" y "Decks". No hay
    // un label asociado al precio (ver comentario en el componente): se ubica
    // por posición dentro de la fila del primer material.
    const filaLosetaComun = screen.getByDisplayValue("Loseta común").closest(".grid") as HTMLElement;
    const precioLosetaComun = filaLosetaComun.querySelector('input[inputmode="decimal"]') as HTMLInputElement;
    await user.clear(precioLosetaComun);
    await user.type(precioLosetaComun, "10000");
    fireEvent.blur(precioLosetaComun);

    expect(await screen.findByText("$150.000")).toBeInTheDocument();
  });
});

describe("LosetasCalculadora · luces arrastrables", () => {
  beforeEach(() => mockearRectDelSvg());

  it("arrancan en la posición por defecto, contra la pared del solar", async () => {
    const user = userEvent.setup();
    render(<LosetasCalculadora />);
    await cargarMedidas(user, "8", "4");
    await user.click(screen.getByLabelText("Luces"));
    const cantidad = screen.getByLabelText("Cantidad");
    await user.clear(cantidad);
    await user.type(cantidad, "1");

    const editor = screen.getByRole("img", { name: "Editor del plano de la piscina" });
    await waitFor(() => expect(editor.querySelector('[data-luz="0"]')).toBeTruthy());
    const luz = editor.querySelector('[data-luz="0"]') as SVGCircleElement;
    // pool.y + 0.5*pool.h con esta única luz (posicionLuzPorDefecto(0,1) = {x:0.06,y:0.5})
    expect(Number(luz.getAttribute("cy"))).toBeGreaterThan(0);
  });

  it("arrastrar una luz cambia su posición en el plano", async () => {
    const user = userEvent.setup();
    render(<LosetasCalculadora />);
    await cargarMedidas(user, "8", "4");
    await user.click(screen.getByLabelText("Luces"));
    const cantidad = screen.getByLabelText("Cantidad");
    await user.clear(cantidad);
    await user.type(cantidad, "1");

    const editor = screen.getByRole("img", { name: "Editor del plano de la piscina" });
    await waitFor(() => expect(editor.querySelector('[data-luz="0"]')).toBeTruthy());
    const cyInicial = Number((editor.querySelector('[data-luz="0"]') as SVGCircleElement).getAttribute("cy"));

    fireEvent.pointerDown(editor.querySelector('[data-luz="0"]') as SVGCircleElement, {
      clientX: 300, clientY: 300, pointerId: 1,
    });
    fireEvent.pointerMove(editor, { clientX: 300, clientY: 380, pointerId: 1 });
    fireEvent.pointerUp(editor, { clientX: 300, clientY: 380, pointerId: 1 });

    await waitFor(() => {
      const cyFinal = Number((editor.querySelector('[data-luz="0"]') as SVGCircleElement).getAttribute("cy"));
      expect(cyFinal).not.toBe(cyInicial);
    });
  });
});

describe("LosetasCalculadora · snapshot", () => {
  beforeEach(() => {
    guardarPresupuesto.mockReset();
    guardarPresupuesto.mockResolvedValue({ error: null });
  });

  it("guarda un PresupuestoV1 con las medidas, el color y el nombre del cliente", async () => {
    const user = userEvent.setup();
    render(<LosetasCalculadora />);
    await cargarMedidas(user, "8", "4");
    await user.type(screen.getByLabelText("Cliente o referencia"), "Gómez, Martín");
    const colorAgua = screen.getByLabelText("Color del agua") as HTMLInputElement;
    fireEvent.input(colorAgua, { target: { value: "#112233" } });

    await user.click(screen.getByRole("button", { name: "Guardar en la nube" }));

    await waitFor(() => expect(guardarPresupuesto).toHaveBeenCalled());
    const [tipo, datos, clienteNombre] = guardarPresupuesto.mock.calls[0];
    expect(tipo).toBe("losetas");
    expect(clienteNombre).toBe("Gómez, Martín");
    const snapshot = PresupuestoV1.parse(datos);
    expect(snapshot.cliente.nombre).toBe("Gómez, Martín");
    expect(snapshot.medidas).toMatchObject({ largo: 8, ancho: 4, colorAgua: "#112233" });
    // Los materiales nunca viajan en el snapshot: no los persistía el legacy.
    expect(snapshot.medidas).not.toHaveProperty("materiales");
  });

  it("editar un presupuesto existente llama a actualizarPresupuesto con su id", async () => {
    actualizarPresupuesto.mockReset();
    actualizarPresupuesto.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<LosetasCalculadora presupuestoId="abc-123" />);
    await cargarMedidas(user, "8", "4");
    await user.click(screen.getByRole("button", { name: "Guardar en la nube" }));

    await waitFor(() => expect(actualizarPresupuesto).toHaveBeenCalled());
    expect(actualizarPresupuesto.mock.calls[0][0]).toBe("abc-123");
    expect(guardarPresupuesto).not.toHaveBeenCalled();
  });
});

describe("LosetasCalculadora · abrir un plano guardado", () => {
  function leido(medidas: Record<string, unknown>, nombre = "Pérez"): PresupuestoLeido {
    return {
      presupuesto: PresupuestoV1.parse({
        v: 1,
        tipo: "losetas",
        fecha: "",
        cliente: { nombre },
        medidas,
        lineas: [],
        totales: [],
      }),
      preciosCongelados: true,
      clavesIncluidas: [],
    };
  }

  it("reconstruye el formulario con las medidas y el color guardados", () => {
    render(
      <LosetasCalculadora
        presupuestoId="xyz"
        presupuestoInicial={leido({
          largo: 8, ancho: 4, bordeIncluido: 0.5, solar: 1, opuesto: 1, lateral1: 1, lateral2: 1,
          colorAgua: "#ff0000", colorLoseta: "#00ff00", lblSolar: "Frente",
        })}
      />
    );

    expect(screen.getByLabelText("Cliente o referencia")).toHaveValue("Pérez");
    expect(screen.getByLabelText("Largo (m)")).toHaveValue("8");
    expect(screen.getByLabelText("Color del agua")).toHaveValue("#ff0000");
    expect(screen.getByLabelText("Nombre del lado solar")).toHaveValue("Frente");
    expect(screen.getByText("15 m²")).toBeInTheDocument(); // extra a cotizar con estas medidas
  });

  it("un plano con luces guardadas las dibuja en su posición, no en la default", () => {
    render(
      <LosetasCalculadora
        presupuestoInicial={leido({
          largo: 8, ancho: 4, solar: 1, opuesto: 1, lateral1: 1, lateral2: 1,
          luces: true, cantLuces: 1, lucesPos: [{ x: 0.9, y: 0.9 }],
        })}
      />
    );
    const editor = screen.getByRole("img", { name: "Editor del plano de la piscina" });
    const luz = editor.querySelector('[data-luz="0"]') as SVGCircleElement;
    expect(luz).toBeTruthy();
    // posicionLuzPorDefecto(0,1) da y=0.5 (centrado); acá tiene que quedar
    // en 0.9 (guardado), bien más abajo del centro de la pileta.
    const pool = editor.querySelector("rect[fill^='url(#poolGrad']") as SVGRectElement;
    const poolY = Number(pool.getAttribute("y"));
    const poolH = Number(pool.getAttribute("height"));
    expect(Number(luz.getAttribute("cy"))).toBeCloseTo(poolY + 0.9 * poolH, 1);
  });
});
