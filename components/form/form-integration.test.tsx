// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { useZodForm } from "@/lib/forms/useZodForm";
import { MoneyField } from "./MoneyField";
import { TextField } from "./TextField";

/**
 * Este test no es sobre un formulario de negocio (esos no existen todavía:
 * son la Fase 4) — es sobre la INFRAESTRUCTURA: que useZodForm + MoneyField +
 * TextField efectivamente hablan entre sí, que un error de Zod aparece en
 * pantalla y que el submit solo dispara con datos válidos.
 */
const schema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  precio: z.number({ error: "El precio es obligatorio" }).positive("El precio tiene que ser mayor a 0"),
});
type Datos = z.infer<typeof schema>;

function Formulario({ onSubmit }: { onSubmit: (datos: Datos) => void }) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useZodForm(schema, { defaultValues: { nombre: "", precio: null as unknown as number } });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <TextField register={register} errors={errors} name="nombre" label="Nombre" />
      <MoneyField control={control} name="precio" label="Precio" />
      <button type="submit">Guardar</button>
    </form>
  );
}

describe("React Hook Form + Zod · integración", () => {
  it("no llama onSubmit si falta un campo obligatorio, y muestra el error", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Formulario onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText("El nombre es obligatorio")).toBeInTheDocument();
  });

  it("rechaza un precio en 0 con el mensaje del schema", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Formulario onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Nombre"), "Cerco perimetral");
    await user.type(screen.getByLabelText("Precio"), "0");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText("El precio tiene que ser mayor a 0")).toBeInTheDocument();
  });

  it("llama onSubmit con los datos ya tipados (precio como número) cuando todo es válido", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Formulario onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Nombre"), "Cerco perimetral");
    await user.type(screen.getByLabelText("Precio"), "1500000");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onSubmit).toHaveBeenCalledWith(
      { nombre: "Cerco perimetral", precio: 1500000 },
      expect.anything()
    );
  });

  it("el input de precio queda con aria-invalid cuando hay error", async () => {
    const user = userEvent.setup();
    render(<Formulario onSubmit={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    const precio = await screen.findByLabelText("Precio");
    expect(precio).toHaveAttribute("aria-invalid", "true");
  });
});
