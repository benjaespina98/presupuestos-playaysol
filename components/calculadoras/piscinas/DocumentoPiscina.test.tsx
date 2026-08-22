// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import { crearLinea } from "@/lib/domain/precios/tipos";
import { TEXTOS_POR_DEFECTO_PISCINAS } from "@/lib/documentos/piscinas/docx";
import { DocumentoPiscina } from "./DocumentoPiscina";

function snapshotBase(overrides: Partial<PresupuestoV1> = {}): PresupuestoV1 {
  return {
    v: 1,
    tipo: "piscinas",
    fecha: "20/08/2026",
    validezDias: "7",
    cliente: { nombre: "Pérez, Juan", domicilio: "", localidad: "", telefono: "", email: "" },
    medidas: {},
    lineas: [],
    preciosBase: {},
    totales: [18500000],
    detalle: "",
    variacionEncabezado: "teal",
    modoPrecio: "ambos",
    fotos: [],
    ...overrides,
  };
}

describe("DocumentoPiscina · reglas propias", () => {
  it("el heading 'Dimensión piscina' aparece incluso sin contenido (particularidad preservada del legacy)", () => {
    render(<DocumentoPiscina snapshot={snapshotBase({ detalle: "" })} textos={TEXTOS_POR_DEFECTO_PISCINAS} fotos={[]} />);
    expect(screen.getByText("Dimensión piscina")).toBeInTheDocument();
  });

  it("sin adicionales, no hay línea TOTAL", () => {
    render(<DocumentoPiscina snapshot={snapshotBase()} textos={TEXTOS_POR_DEFECTO_PISCINAS} fotos={[]} />);
    expect(screen.queryByText("TOTAL")).not.toBeInTheDocument();
  });

  it("un opcional NO tildado igual aparece, como 'No incluye'", () => {
    const snapshot = snapshotBase({
      lineas: [
        crearLinea({
          clave: "bano_quimico",
          descripcion: "Baño químico",
          unidad: null,
          cantidad: 1,
          precioUnitario: null,
          naturaleza: "informativa",
          incluida: false,
          origen: "catalogo",
        }),
      ],
    });
    render(<DocumentoPiscina snapshot={snapshot} textos={TEXTOS_POR_DEFECTO_PISCINAS} fotos={[]} />);
    expect(screen.getByText("Baño químico")).toBeInTheDocument();
    expect(screen.getByText("No incluye")).toBeInTheDocument();
  });

  it("un opcional tildado pero SIN precio cargado también da 'No incluye'", () => {
    const snapshot = snapshotBase({
      lineas: [
        crearLinea({
          clave: "bano_quimico",
          descripcion: "Baño químico",
          unidad: null,
          cantidad: 1,
          precioUnitario: null,
          naturaleza: "informativa",
          incluida: true,
          origen: "catalogo",
        }),
      ],
    });
    render(<DocumentoPiscina snapshot={snapshot} textos={TEXTOS_POR_DEFECTO_PISCINAS} fotos={[]} />);
    expect(screen.getByText("No incluye")).toBeInTheDocument();
  });

  it("un opcional tildado CON precio muestra el importe", () => {
    const snapshot = snapshotBase({
      lineas: [
        crearLinea({
          clave: "luces",
          descripcion: "Luces de acero inoxidable",
          unidad: null,
          cantidad: 1,
          precioUnitario: 240000,
          naturaleza: "informativa",
          incluida: true,
          origen: "catalogo",
        }),
      ],
    });
    render(<DocumentoPiscina snapshot={snapshot} textos={TEXTOS_POR_DEFECTO_PISCINAS} fotos={[]} />);
    expect(screen.getByText("$ 240.000")).toBeInTheDocument();
  });

  it("el título es el de piscinas", () => {
    render(<DocumentoPiscina snapshot={snapshotBase()} textos={TEXTOS_POR_DEFECTO_PISCINAS} fotos={[]} />);
    expect(screen.getByText("Presupuesto de construcción piscina")).toBeInTheDocument();
  });
});

describe("DocumentoPiscina · fotos de referencia por opcional", () => {
  it("un opcional con fotos asociadas (cerco perimetral) las muestra, tildado o no", () => {
    const snapshot = snapshotBase({
      lineas: [
        crearLinea({
          clave: "cerco_perimetral",
          descripcion: "Cerco perimetral",
          unidad: "ml",
          cantidad: 1,
          precioUnitario: 79500,
          naturaleza: "informativa",
          incluida: false,
          origen: "catalogo",
        }),
      ],
    });
    const { container } = render(<DocumentoPiscina snapshot={snapshot} textos={TEXTOS_POR_DEFECTO_PISCINAS} fotos={[]} />);
    const imgs = [...container.querySelectorAll("img")].filter((img) => img.getAttribute("src")?.includes("cerco_perimetral"));
    expect(imgs).toHaveLength(2);
  });

  it("un opcional sin fotos asociadas (baño químico) no agrega ninguna imagen", () => {
    const snapshot = snapshotBase({
      lineas: [
        crearLinea({
          clave: "bano_quimico",
          descripcion: "Baño químico",
          unidad: null,
          cantidad: 1,
          precioUnitario: null,
          naturaleza: "informativa",
          incluida: false,
          origen: "catalogo",
        }),
      ],
    });
    const { container } = render(<DocumentoPiscina snapshot={snapshot} textos={TEXTOS_POR_DEFECTO_PISCINAS} fotos={[]} />);
    // El logo del header + las 3 "Modelos de referencia", siempre presentes.
    expect(container.querySelectorAll("img")).toHaveLength(4);
  });

  it("'Modelos de referencia' (3 fotos) aparece siempre, sin depender de ningún opcional", () => {
    const { container } = render(<DocumentoPiscina snapshot={snapshotBase()} textos={TEXTOS_POR_DEFECTO_PISCINAS} fotos={[]} />);
    expect(screen.getByText("Modelos de referencia")).toBeInTheDocument();
    const imgs = [...container.querySelectorAll("img")].filter((img) => img.getAttribute("src")?.includes("/seeds/general-"));
    expect(imgs).toHaveLength(3);
  });

  it("travertino: las fotos aparecen una sola vez, no repetidas en los dos opcionales", () => {
    const opcionTravertino = (clave: string, descripcion: string) =>
      crearLinea({
        clave,
        descripcion,
        unidad: null,
        cantidad: 1,
        precioUnitario: null,
        naturaleza: "informativa" as const,
        incluida: false,
        origen: "catalogo" as const,
      });
    const snapshot = snapshotBase({
      lineas: [
        opcionTravertino("travertino_rustico_exterior", "Travertino rústico exterior"),
        opcionTravertino("travertino_pulido_interior", "Travertino pulido interior"),
      ],
    });
    const { container } = render(<DocumentoPiscina snapshot={snapshot} textos={TEXTOS_POR_DEFECTO_PISCINAS} fotos={[]} />);
    const imgs = [...container.querySelectorAll("img")].filter((img) => img.getAttribute("src")?.includes("travertino"));
    expect(imgs).toHaveLength(3); // el set completo una sola vez, no 3+3
  });
});
