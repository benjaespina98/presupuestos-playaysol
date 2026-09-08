// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TextosCompartidos } from "@/lib/documentos/textosCompartidos";
import { EditorTextosCompartidos } from "./EditorTextosCompartidos";

const { guardarTextosCompartidos } = vi.hoisted(() => ({
  guardarTextosCompartidos: vi.fn(),
}));
vi.mock("@/lib/catalogo", () => ({ guardarTextosCompartidos }));

const TEXTOS: TextosCompartidos = {
  legal: "Texto legal original.",
  footer: {
    empresa: "PLAYA Y SOL S.A.S.",
    direccion: "Corrientes 1210, Villa María",
    telFijo: "0353-4531612",
    contactoNombre: "",
    contactoCel: "",
    whatsapp: "3534224605",
    email: "",
    web: "",
    facebook: "",
    facebookUrl: "",
    instagram: "",
    instagramUrl: "",
  },
};

/**
 * Antes de este componente, `guardarTextosCompartidos` (lib/catalogo.ts)
 * existía pero ningún botón de ninguna calculadora lo llamaba — el texto
 * legal/pie sólo se podía cambiar escribiendo directo en la base. Este test
 * cubre que el botón realmente arma las entradas `__legal`/`__footer_*` y
 * las manda con el `tipo` correcto — no la escritura real en Supabase (eso
 * ya lo prueba `lib/catalogo.test.ts`, acá se mockea).
 */
describe("EditorTextosCompartidos", () => {
  it("arranca colapsado con los textos actuales precargados", async () => {
    const user = userEvent.setup();
    render(<EditorTextosCompartidos tipo="cercos" textos={TEXTOS} onGuardado={vi.fn()} />);

    await user.click(screen.getByText("Texto legal y pie del presupuesto"));
    expect(screen.getByLabelText("Texto legal / condiciones")).toHaveValue("Texto legal original.");
    expect(screen.getByLabelText("Empresa")).toHaveValue("PLAYA Y SOL S.A.S.");
    expect(screen.getByLabelText("WhatsApp")).toHaveValue("3534224605");
  });

  it("al guardar, manda las claves __legal/__footer_* correctas con el tipo de la calculadora", async () => {
    guardarTextosCompartidos.mockReset();
    guardarTextosCompartidos.mockResolvedValue({ error: null });
    const onGuardado = vi.fn();
    const user = userEvent.setup();
    render(<EditorTextosCompartidos tipo="revestimientos" textos={TEXTOS} onGuardado={onGuardado} />);
    await user.click(screen.getByText("Texto legal y pie del presupuesto"));

    const legalInput = screen.getByLabelText("Texto legal / condiciones");
    await user.clear(legalInput);
    await user.type(legalInput, "Texto nuevo.");

    await user.click(screen.getByRole("button", { name: "Guardar como predeterminado para todos" }));

    await waitFor(() => expect(guardarTextosCompartidos).toHaveBeenCalledTimes(1));
    const [tipo, entradas] = guardarTextosCompartidos.mock.calls[0];
    expect(tipo).toBe("revestimientos");
    expect(entradas).toContainEqual({ clave: "__legal", descripcion: "Texto nuevo." });
    expect(entradas).toContainEqual({ clave: "__footer_empresa", descripcion: "PLAYA Y SOL S.A.S." });
    expect(entradas).toContainEqual({ clave: "__footer_whatsapp", descripcion: "3534224605" });

    expect(onGuardado).toHaveBeenCalledWith({ legal: "Texto nuevo.", footer: TEXTOS.footer });
    expect(await screen.findByText(/Guardado/)).toBeInTheDocument();
  });

  it("si falla el guardado, muestra el error y no llama a onGuardado", async () => {
    guardarTextosCompartidos.mockReset();
    guardarTextosCompartidos.mockResolvedValue({ error: { message: "sin conexión" } });
    const onGuardado = vi.fn();
    const user = userEvent.setup();
    render(<EditorTextosCompartidos tipo="cercos" textos={TEXTOS} onGuardado={onGuardado} />);
    await user.click(screen.getByText("Texto legal y pie del presupuesto"));

    await user.click(screen.getByRole("button", { name: "Guardar como predeterminado para todos" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar");
    expect(onGuardado).not.toHaveBeenCalled();
  });
});
