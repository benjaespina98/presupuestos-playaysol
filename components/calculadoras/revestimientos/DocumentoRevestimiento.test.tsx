// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import { crearLinea } from "@/lib/domain/precios/tipos";
import { TEXTOS_POR_DEFECTO_REVESTIMIENTOS } from "@/lib/documentos/revestimientos/docx";
import { DocumentoRevestimiento } from "./DocumentoRevestimiento";

function snapshotBase(overrides: Partial<PresupuestoV1> = {}): PresupuestoV1 {
  return {
    v: 1,
    tipo: "revestimientos",
    fecha: "20/08/2026",
    validezDias: "7",
    cliente: { nombre: "Gómez", domicilio: "", localidad: "", telefono: "", email: "" },
    medidas: { largo: 8, ancho: 4, profMin: 1.5, profMax: 0, escalera: 0, desperdicio: 0, adicionalesM2: [] },
    lineas: [],
    preciosBase: {},
    totales: [0],
    detalle: "",
    variacionEncabezado: "teal",
    modoPrecio: "ambos",
    fotos: [],
    ...overrides,
  };
}

function material(overrides: Record<string, unknown> = {}) {
  return crearLinea({
    clave: "revestimiento_ceramico_bali",
    descripcion: "Cerámico Bali Brasil (por m² instalado)",
    unidad: "m²",
    cantidad: 1,
    precioUnitario: 112000,
    total: 7616000,
    naturaleza: "alternativa",
    incluida: true,
    origen: "catalogo",
    ...overrides,
  });
}

describe("DocumentoRevestimiento · la regla alternativa", () => {
  it("con dos materiales incluidos, dos líneas de total, no una suma", () => {
    render(
      <DocumentoRevestimiento
        snapshot={snapshotBase({
          totales: [7616000, 9520000],
          lineas: [
            material(),
            material({
              clave: "venecitas_premium_espana",
              descripcion: "Venecitas Premium España (por m² instalado)",
              precioUnitario: 140000,
              total: 9520000,
            }),
          ],
        })}
        textos={TEXTOS_POR_DEFECTO_REVESTIMIENTOS}
        fotos={[]}
      />
    );
    const totales = within(screen.getByTestId("totales"));
    expect(totales.getByText("TOTAL revestimiento con Cerámico Bali Brasil")).toBeInTheDocument();
    expect(totales.getByText("TOTAL revestimiento con Venecitas Premium España")).toBeInTheDocument();
    expect(totales.queryByText("TOTAL REVESTIMIENTO")).not.toBeInTheDocument();
    expect(totales.queryByText("$ 17.136.000")).not.toBeInTheDocument();
  });

  it("con un solo material, una sola línea TOTAL REVESTIMIENTO (no lleva el nombre del material)", () => {
    render(
      <DocumentoRevestimiento
        snapshot={snapshotBase({ totales: [7616000], lineas: [material()] })}
        textos={TEXTOS_POR_DEFECTO_REVESTIMIENTOS}
        fotos={[]}
      />
    );
    const totales = within(screen.getByTestId("totales"));
    expect(totales.getByText("TOTAL REVESTIMIENTO")).toBeInTheDocument();
    expect(totales.queryByText(/TOTAL revestimiento con/)).not.toBeInTheDocument();
  });

  it("un material NO incluido no aparece en 'Revestimiento cotizado'", () => {
    render(
      <DocumentoRevestimiento
        snapshot={snapshotBase({ lineas: [material({ incluida: false, total: null })] })}
        textos={TEXTOS_POR_DEFECTO_REVESTIMIENTOS}
        fotos={[]}
      />
    );
    expect(screen.queryByText("Cerámico Bali Brasil (por m² instalado)")).not.toBeInTheDocument();
  });

  it("un material incluido pero sin precio da 'No incluye' y no cuenta para el umbral de 2", () => {
    render(
      <DocumentoRevestimiento
        snapshot={snapshotBase({
          totales: [7616000],
          lineas: [material(), material({ clave: "sin_precio", precioUnitario: null, total: null })],
        })}
        textos={TEXTOS_POR_DEFECTO_REVESTIMIENTOS}
        fotos={[]}
      />
    );
    expect(screen.getByText("No incluye")).toBeInTheDocument();
    // Sigue siendo un solo total, porque el segundo material no tiene precio.
    expect(within(screen.getByTestId("totales")).getByText("TOTAL REVESTIMIENTO")).toBeInTheDocument();
  });

  it("la línea 'por m² × total' sólo aparece cuando el material está cotizado", () => {
    render(
      <DocumentoRevestimiento
        snapshot={snapshotBase({ lineas: [material()] })}
        textos={TEXTOS_POR_DEFECTO_REVESTIMIENTOS}
        fotos={[]}
      />
    );
    expect(screen.getByText(/\$ 112\.000 por m² × 68 m²/)).toBeInTheDocument();
  });
});

describe("DocumentoRevestimiento · fotos de referencia por material", () => {
  it("un material tildado con clave conocida (cerámico Bali) muestra sus fotos — mismas que en Piscinas", () => {
    const snapshot = snapshotBase({
      lineas: [
        crearLinea({
          clave: "revestimiento_ceramico_bali",
          descripcion: "Cerámico Bali Brasil (por m² instalado)",
          unidad: "m²",
          cantidad: 1,
          precioUnitario: 112000,
          naturaleza: "alternativa",
          incluida: true,
          origen: "catalogo",
        }),
      ],
      totales: [7616000],
    });
    const { container } = render(
      <DocumentoRevestimiento snapshot={snapshot} textos={TEXTOS_POR_DEFECTO_REVESTIMIENTOS} fotos={[]} />
    );
    const imgs = [...container.querySelectorAll("img")].filter((img) =>
      img.getAttribute("src")?.includes("revestimiento_ceramico_bali")
    );
    expect(imgs).toHaveLength(4);
  });

  it("un material sin fotos asociadas no agrega ninguna imagen", () => {
    const snapshot = snapshotBase({
      lineas: [
        crearLinea({
          clave: "venecitas_premium_espana",
          descripcion: "Venecitas Premium España (por m² instalado)",
          unidad: "m²",
          cantidad: 1,
          precioUnitario: 140000,
          naturaleza: "alternativa",
          incluida: true,
          origen: "catalogo",
        }),
      ],
      totales: [9520000],
    });
    const { container } = render(
      <DocumentoRevestimiento snapshot={snapshot} textos={TEXTOS_POR_DEFECTO_REVESTIMIENTOS} fotos={[]} />
    );
    expect(container.querySelectorAll("img")).toHaveLength(1); // sólo el logo del header
  });
});
