// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { VistaPreviaMovil } from "./VistaPreviaMovil";

/**
 * jsdom no aplica CSS real: las clases `hidden`/`block`/`lg:block` no
 * esconden nada por sí solas. Lo que sí se puede (y debe) probar acá es la
 * PARTE que si se rompe, se nota en cualquier tamaño de pantalla: que el
 * estado de la pestaña realmente cambia qué clase lleva cada columna
 * (`hidden` vs `block`) y que el botón activo lo indica con
 * `aria-pressed`. Que a partir de `lg:` las dos siempre se vean es una
 * garantía de Tailwind (la clase `lg:block` está siempre presente), no
 * algo que este test necesite reproducir.
 */
describe("VistaPreviaMovil", () => {
  it("arranca en 'Editar': el formulario está en pantalla, el documento no", () => {
    render(<VistaPreviaMovil formulario={<div data-testid="form">Formulario</div>} documento={<div data-testid="doc">Documento</div>} />);
    expect(screen.getByTestId("form").parentElement?.className).toContain("block");
    expect(screen.getByTestId("form").parentElement?.className).not.toContain("hidden");
    expect(screen.getByTestId("doc").parentElement?.parentElement?.className).toContain("hidden");
    expect(screen.getByRole("button", { name: "Editar" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Vista previa" })).toHaveAttribute("aria-pressed", "false");
  });

  it("al tocar 'Vista previa' se muestra el documento y se oculta el formulario", async () => {
    const user = userEvent.setup();
    render(<VistaPreviaMovil formulario={<div data-testid="form">Formulario</div>} documento={<div data-testid="doc">Documento</div>} />);

    await user.click(screen.getByRole("button", { name: "Vista previa" }));

    expect(screen.getByTestId("doc").parentElement?.parentElement?.className).toContain("block");
    expect(screen.getByTestId("doc").parentElement?.parentElement?.className).not.toContain("hidden");
    expect(screen.getByTestId("form").parentElement?.className).toContain("hidden");
    expect(screen.getByRole("button", { name: "Vista previa" })).toHaveAttribute("aria-pressed", "true");
  });

  it("el contenido del formulario y del documento sigue montado en el DOM en las dos pestañas (no se pierde estado)", () => {
    // Las dos columnas están siempre en el DOM (se ocultan con clases, no
    // con un `if`) — así el estado de React Hook Form dentro del
    // formulario no se resetea al ir y volver de "Vista previa".
    render(<VistaPreviaMovil formulario={<div data-testid="form">Formulario</div>} documento={<div data-testid="doc">Documento</div>} />);
    expect(screen.getByTestId("form")).toBeInTheDocument();
    expect(screen.getByTestId("doc")).toBeInTheDocument();
  });
});
