// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BarraHerramientas } from "./BarraHerramientas";

vi.mock("next/link", () => ({
  default: ({ href, children, ...resto }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...resto}>
      {children}
    </a>
  ),
}));

/** jsdom no trae matchMedia: se simula con el ancho que se pida. */
function conAncho(ancho: number) {
  window.matchMedia = ((consulta: string) => {
    const min = Number(/min-width:\s*(\d+)px/.exec(consulta)?.[1] ?? 0);
    return { matches: ancho >= min, media: consulta, addEventListener: () => {}, removeEventListener: () => {} } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
  Object.defineProperty(window, "innerWidth", { configurable: true, value: ancho });
}

function Caja({ alAgregar = vi.fn() }: { alAgregar?: () => void }) {
  const [busqueda, setBusqueda] = useState("");
  const [rubro, setRubro] = useState("");
  const [inactivos, setInactivos] = useState(false);
  const [orden, setOrden] = useState<"defecto" | "nombre-asc">("defecto");
  const hayFiltros = !!(busqueda || rubro || inactivos || orden !== "defecto");
  return (
    <BarraHerramientas
      buscador={{ valor: busqueda, onCambio: setBusqueda, placeholder: "Buscar material", etiqueta: "Buscar materiales" }}
      secciones={[
        {
          id: "rubro",
          titulo: "Rubro",
          opciones: [
            { id: "", etiqueta: "Todos", cantidad: 10 },
            { id: "PVC", etiqueta: "PVC", cantidad: 3 },
            { id: "Áridos", etiqueta: "Áridos", cantidad: 2 },
          ],
          valor: rubro,
          onCambio: setRubro,
        },
      ]}
      orden={{
        opciones: [
          { id: "defecto", etiqueta: "Orden actual" },
          { id: "nombre-asc", etiqueta: "Nombre (A a Z)" },
        ],
        valor: orden,
        onCambio: (v) => setOrden(v as "defecto" | "nombre-asc"),
      }}
      interruptores={[{ id: "inactivos", etiqueta: "Mostrar desactivados", valor: inactivos, onCambio: setInactivos }]}
      agregar={{ etiqueta: "Agregar material", onClick: alAgregar }}
      resultados={rubro === "PVC" ? 3 : 10}
      contador={`${rubro === "PVC" ? 3 : 10} materiales`}
      hayFiltros={hayFiltros}
      onLimpiar={() => {
        setBusqueda("");
        setRubro("");
        setInactivos(false);
        setOrden("defecto");
      }}
    />
  );
}

afterEach(() => document.documentElement.style.removeProperty("--catalogo-barra"));

describe("BarraHerramientas · celular", () => {
  beforeEach(() => conAncho(390));

  it("una sola fila: buscador, Filtros y el '+' de agregar (sin fila aparte ni combos sueltos)", async () => {
    const alAgregar = vi.fn();
    const user = userEvent.setup();
    render(<Caja alAgregar={alAgregar} />);
    expect(screen.getByLabelText("Buscar materiales")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filtros" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ordenar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Filtrar por rubro" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Agregar material" }));
    expect(alAgregar).toHaveBeenCalledTimes(1);
    expect(screen.getByText("10 materiales")).toBeInTheDocument();
  });

  it("todos los filtros viven en la hoja: se aplican en vivo, el botón cuenta los activos y 'Ver N resultados' la cierra", async () => {
    const user = userEvent.setup();
    render(<Caja />);
    await user.click(screen.getByRole("button", { name: "Filtros" }));
    const hoja = await screen.findByRole("dialog", { name: "Filtros" });
    expect(within(hoja).getByRole("button", { name: /Ver 10 resultados/ })).toBeInTheDocument();

    await user.click(within(hoja).getByRole("button", { name: /Rubro/ }));
    await user.click(within(hoja).getByRole("radio", { name: /PVC.*3/ }));
    // en vivo: el pie ya dice 3 resultados
    expect(within(hoja).getByRole("button", { name: /Ver 3 resultados/ })).toBeInTheDocument();
    await user.click(within(hoja).getByLabelText("Mostrar desactivados"));

    await user.click(within(hoja).getByRole("button", { name: /Ver 3 resultados/ }));
    expect(screen.queryByRole("dialog", { name: "Filtros" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filtros, 2 activos" })).toBeInTheDocument();
  });

  it("los filtros activos se ven como chips debajo de la barra, cada uno con su ×, y sólo si hay", async () => {
    const user = userEvent.setup();
    render(<Caja />);
    expect(screen.queryByRole("list", { name: "Filtros activos" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Filtros" }));
    const hoja = await screen.findByRole("dialog", { name: "Filtros" });
    await user.click(within(hoja).getByRole("button", { name: /Rubro/ }));
    await user.click(within(hoja).getByRole("radio", { name: /PVC/ }));
    await user.click(within(hoja).getByRole("button", { name: /Ver/ }));

    const chips = screen.getByRole("list", { name: "Filtros activos" });
    expect(within(chips).getByRole("button", { name: "Quitar filtro: Rubro: PVC" })).toBeInTheDocument();
    await user.click(within(chips).getByRole("button", { name: "Quitar filtro: Rubro: PVC" }));
    expect(screen.queryByRole("list", { name: "Filtros activos" })).not.toBeInTheDocument();
  });

  it("'Limpiar' deja todo como estaba", async () => {
    const user = userEvent.setup();
    render(<Caja />);
    await user.click(screen.getByRole("button", { name: "Filtros" }));
    const hoja = await screen.findByRole("dialog", { name: "Filtros" });
    expect(within(hoja).getByRole("button", { name: "Limpiar" })).toBeDisabled();
    await user.click(within(hoja).getByLabelText("Mostrar desactivados"));
    await user.click(within(hoja).getByRole("button", { name: "Limpiar" }));
    expect(within(hoja).getByLabelText("Mostrar desactivados")).not.toBeChecked();
  });

  it("publica su alto en --catalogo-barra y lo limpia al irse", () => {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, value: 56 });
    const { unmount } = render(<Caja />);
    expect(document.documentElement.style.getPropertyValue("--catalogo-barra")).toBe("56px");
    unmount();
    expect(document.documentElement.style.getPropertyValue("--catalogo-barra")).toBe("");
    if (original) Object.defineProperty(HTMLElement.prototype, "offsetHeight", original);
  });
});

describe("BarraHerramientas · escritorio", () => {
  beforeEach(() => conAncho(1366));

  it("una sola fila: buscador, un menú por filtro con contadores, orden, 'Más filtros' y 'Agregar'", async () => {
    const user = userEvent.setup();
    render(<Caja />);
    expect(screen.queryByRole("button", { name: "Filtros" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Filtrar por rubro" }));
    const lista = await screen.findByRole("radiogroup", { name: "Filtrar por rubro" });
    expect(within(lista).getByRole("radio", { name: /PVC.*3/ })).toBeInTheDocument();
    await user.click(within(lista).getByRole("radio", { name: /PVC/ }));
    expect(screen.getByRole("button", { name: "Filtrar por rubro" })).toHaveTextContent("Rubro: PVC");
    expect(screen.getByRole("button", { name: "Agregar material" })).toHaveTextContent("Agregar");
    expect(screen.getByRole("button", { name: "Ordenar" })).toBeInTheDocument();
  });

  it("'Más filtros' trae los interruptores y 'Limpiar filtros'", async () => {
    const user = userEvent.setup();
    render(<Caja />);
    await user.click(screen.getByRole("button", { name: "Más filtros" }));
    const panel = await screen.findByRole("dialog", { name: "Más filtros" });
    expect(within(panel).queryByRole("button", { name: "Limpiar filtros" })).not.toBeInTheDocument();
    await user.click(within(panel).getByLabelText("Mostrar desactivados"));
    await user.click(within(panel).getByRole("button", { name: "Limpiar filtros" }));
    expect(screen.queryByRole("dialog", { name: "Más filtros" })).not.toBeInTheDocument();
  });
});
