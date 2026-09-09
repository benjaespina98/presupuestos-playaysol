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

// La rasterización real (Canvas/Image) no existe en jsdom — acá sólo importa
// que el botón llame a la función correcta con los datos correctos y que el
// resultado se mande a compartir/descargar; la imagen/PDF en sí se prueba a
// mano en un navegador real (ver comentario de tests/calculators.spec.ts).
const { generarImagenClientePlano, generarPdfClientePlano } = vi.hoisted(() => ({
  generarImagenClientePlano: vi.fn().mockResolvedValue(new Blob(["x"], { type: "image/png" })),
  generarPdfClientePlano: vi.fn().mockResolvedValue(new Blob(["x"], { type: "application/pdf" })),
}));
vi.mock("@/lib/documentos/losetas/imagenCliente", () => ({ generarImagenClientePlano, generarPdfClientePlano }));

const { compartirOdescargarArchivo } = vi.hoisted(() => ({
  compartirOdescargarArchivo: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/documentos/compartir", () => ({ compartirOdescargarArchivo }));

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

  it("con la escalera en modo 'ubicarla a mano', se puede arrastrar igual que una luz", async () => {
    const user = userEvent.setup();
    render(<LosetasCalculadora />);
    await cargarMedidas(user, "8", "4");
    await user.click(screen.getByLabelText("Escalera"));
    await user.click(screen.getByLabelText("Ubicarla a mano"));

    // Sin "movible", "Ubicación" desaparece — sólo queda el tamaño.
    expect(screen.queryByLabelText("Ubicación")).not.toBeInTheDocument();

    const editor = screen.getByRole("img", { name: "Editor del plano de la piscina" });
    await waitFor(() => expect(editor.querySelector("[data-escalera]")).toBeTruthy());
    const cyInicial = Number((editor.querySelector("[data-escalera]") as SVGCircleElement).getAttribute("cy"));

    fireEvent.pointerDown(editor.querySelector("[data-escalera]") as SVGCircleElement, {
      clientX: 300, clientY: 300, pointerId: 1,
    });
    fireEvent.pointerMove(editor, { clientX: 300, clientY: 380, pointerId: 1 });
    fireEvent.pointerUp(editor, { clientX: 300, clientY: 380, pointerId: 1 });

    await waitFor(() => {
      const cyFinal = Number((editor.querySelector("[data-escalera]") as SVGCircleElement).getAttribute("cy"));
      expect(cyFinal).not.toBe(cyInicial);
    });
  });

  it("en modo franja (sin 'ubicarla a mano'), la profundidad sale de escalones × medida del escalón", async () => {
    const user = userEvent.setup();
    render(<LosetasCalculadora />);
    await cargarMedidas(user, "8", "4");
    await user.click(screen.getByLabelText("Escalera"));

    const escalones = screen.getByLabelText("Escalones");
    const medida = screen.getByLabelText("Medida (m)");
    await user.clear(escalones);
    await user.type(escalones, "3");
    await user.clear(medida);
    await user.type(medida, "0,3");

    expect(await screen.findByText("Profundidad total: 0,9 m.")).toBeInTheDocument();
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

    await user.click(screen.getAllByRole("button", { name: "Guardar en la nube" })[0]);

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
    await user.click(screen.getAllByRole("button", { name: "Guardar en la nube" })[0]);

    await waitFor(() => expect(actualizarPresupuesto).toHaveBeenCalled());
    expect(actualizarPresupuesto.mock.calls[0][0]).toBe("abc-123");
    expect(guardarPresupuesto).not.toHaveBeenCalled();
  });
});

describe("LosetasCalculadora · exportar para el cliente", () => {
  beforeEach(() => {
    generarImagenClientePlano.mockClear();
    generarPdfClientePlano.mockClear();
    compartirOdescargarArchivo.mockClear();
  });

  it("el botón Imagen genera el PNG con el nombre del cliente y lo comparte/descarga", async () => {
    const user = userEvent.setup();
    render(<LosetasCalculadora />);
    await cargarMedidas(user, "8", "4");
    await user.type(screen.getByLabelText("Cliente o referencia"), "Gómez, Martín");

    await user.click(screen.getByRole("button", { name: "Imagen" }));

    await waitFor(() => expect(generarImagenClientePlano).toHaveBeenCalledTimes(1));
    expect(generarImagenClientePlano.mock.calls[0][0]).toMatchObject({
      nombreCliente: "Gómez, Martín",
    });
    expect(compartirOdescargarArchivo).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.stringContaining("_cliente"),
      "image/png"
    );
  });

  it("el botón PDF genera el PDF y lo comparte/descarga", async () => {
    const user = userEvent.setup();
    render(<LosetasCalculadora />);
    await cargarMedidas(user, "8", "4");

    await user.click(screen.getByRole("button", { name: "PDF" }));

    await waitFor(() => expect(generarPdfClientePlano).toHaveBeenCalledTimes(1));
    expect(compartirOdescargarArchivo).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.stringContaining("_cliente"),
      "application/pdf"
    );
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
