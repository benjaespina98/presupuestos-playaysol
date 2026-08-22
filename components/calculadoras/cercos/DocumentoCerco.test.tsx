// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import { crearLinea } from "@/lib/domain/precios/tipos";
import { TEXTOS_POR_DEFECTO_CERCOS } from "@/lib/documentos/cercos/docx";
import { DocumentoCerco } from "./DocumentoCerco";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LOTE 2 — paridad DOCUMENTAL de cercos
 * ═══════════════════════════════════════════════════════════════════════════
 * `DocumentoCerco` es la misma fuente de datos que alimenta el .docx
 * (lib/documentos/cercos/docx.ts) — ambos leen `snapshot`/`textos` sin
 * recalcular nada. Verificar el contenido acá (fácil de inspeccionar con
 * RTL) es la prueba de paridad de contenido; el .docx en sí sólo necesita
 * generarse sin explotar (ver docx.test.ts) porque usa el mismo dato ya
 * probado.
 */

function snapshotBase(overrides: Partial<PresupuestoV1> = {}): PresupuestoV1 {
  return {
    v: 1,
    tipo: "cercos",
    fecha: "20/08/2026",
    validezDias: "7",
    cliente: {
      nombre: "Pérez, Juan",
      domicilio: "Av. Siempreviva 742",
      localidad: "Villa María",
      telefono: "353 400-0000",
      email: "juan@ejemplo.com",
    },
    medidas: { metrosLineales: 24 },
    lineas: [],
    preciosBase: { precioPorMlSinInstalacion: 63500, precioPorMlConInstalacion: 79500 },
    totales: [1524000, 1908000],
    detalle: "",
    variacionEncabezado: "teal",
    modoPrecio: "ambos",
    fotos: [],
    ...overrides,
  };
}

describe("DocumentoCerco · datos del cliente", () => {
  it("muestra fecha, cliente, domicilio, localidad, tel, email y metros", () => {
    render(<DocumentoCerco snapshot={snapshotBase()} textos={TEXTOS_POR_DEFECTO_CERCOS} fotos={[]} />);

    expect(screen.getByText("20/08/2026")).toBeInTheDocument();
    expect(screen.getByText("Pérez, Juan")).toBeInTheDocument();
    expect(screen.getByText("Av. Siempreviva 742")).toBeInTheDocument();
    expect(screen.getByText("Villa María")).toBeInTheDocument();
    expect(screen.getByText("353 400-0000")).toBeInTheDocument();
    expect(screen.getByText("juan@ejemplo.com")).toBeInTheDocument();
    expect(screen.getByText("24 ml")).toBeInTheDocument();
  });

  it("un campo vacío del cliente no deja un renglón fantasma", () => {
    render(
      <DocumentoCerco
        snapshot={snapshotBase({
          cliente: { nombre: "Solo nombre", domicilio: "", localidad: "", telefono: "", email: "" },
        })}
        textos={TEXTOS_POR_DEFECTO_CERCOS}
        fotos={[]}
      />
    );
    expect(screen.queryByText("Domicilio:")).not.toBeInTheDocument();
  });
});

describe("DocumentoCerco · adicionales y totales", () => {
  it("lista cada adicional con su precio", () => {
    const snapshot = snapshotBase({
      lineas: [
        crearLinea({
          clave: null,
          descripcion: "Traslado",
          unidad: null,
          cantidad: 1,
          precioUnitario: 350000,
          naturaleza: "cotiza",
          incluida: true,
          origen: "manual",
        }),
      ],
    });
    render(<DocumentoCerco snapshot={snapshot} textos={TEXTOS_POR_DEFECTO_CERCOS} fotos={[]} />);

    expect(screen.getByText("Traslado")).toBeInTheDocument();
    expect(screen.getByText("$ 350.000")).toBeInTheDocument();
  });

  it("las etiquetas de total son exactamente las del documento actual", () => {
    render(
      <DocumentoCerco
        snapshot={snapshotBase({ modoPrecio: "sin", totales: [1524000] })}
        textos={TEXTOS_POR_DEFECTO_CERCOS}
        fotos={[]}
      />
    );
    const totales = within(screen.getByTestId("totales"));
    expect(totales.getByText("TOTAL")).toBeInTheDocument();
    expect(totales.queryByText("TOTAL SIN INSTALACIÓN")).not.toBeInTheDocument();
  });
});

describe("DocumentoCerco · opcionales", () => {
  it("un opcional NO incluido no aparece en el documento en absoluto", () => {
    const snapshot = snapshotBase({
      lineas: [
        crearLinea({
          clave: "porton_reforzado",
          descripcion: "Portón de acceso reforzado",
          unidad: null,
          cantidad: 1,
          precioUnitario: null,
          naturaleza: "informativa",
          incluida: false,
          origen: "catalogo",
        }),
      ],
    });
    render(<DocumentoCerco snapshot={snapshot} textos={TEXTOS_POR_DEFECTO_CERCOS} fotos={[]} />);
    expect(screen.queryByText("Portón de acceso reforzado")).not.toBeInTheDocument();
  });

  it("un opcional incluido sin precio dice 'No incluye', no $0 ni vacío", () => {
    const snapshot = snapshotBase({
      lineas: [
        crearLinea({
          clave: "porton_reforzado",
          descripcion: "Portón de acceso reforzado",
          unidad: null,
          cantidad: 1,
          precioUnitario: null,
          naturaleza: "informativa",
          incluida: true,
          origen: "catalogo",
        }),
      ],
    });
    render(<DocumentoCerco snapshot={snapshot} textos={TEXTOS_POR_DEFECTO_CERCOS} fotos={[]} />);
    expect(screen.getByText("Portón de acceso reforzado")).toBeInTheDocument();
    expect(screen.getByText("No incluye")).toBeInTheDocument();
  });

  it("un opcional incluido CON precio muestra el importe formateado", () => {
    const snapshot = snapshotBase({
      lineas: [
        crearLinea({
          clave: "lona_premium",
          descripcion: "Lona premium",
          unidad: null,
          cantidad: 1,
          precioUnitario: 45000,
          naturaleza: "informativa",
          incluida: true,
          origen: "catalogo",
        }),
      ],
    });
    render(<DocumentoCerco snapshot={snapshot} textos={TEXTOS_POR_DEFECTO_CERCOS} fotos={[]} />);
    expect(screen.getByText("$ 45.000")).toBeInTheDocument();
  });
});

describe("DocumentoCerco · detalle del recorrido", () => {
  it("sin detalle, no muestra la sección", () => {
    render(<DocumentoCerco snapshot={snapshotBase({ detalle: "" })} textos={TEXTOS_POR_DEFECTO_CERCOS} fotos={[]} />);
    expect(screen.queryByText("Detalle del recorrido")).not.toBeInTheDocument();
  });

  it("divide el texto en renglones por punto seguido de mayúscula, como el legacy", () => {
    render(
      <DocumentoCerco
        snapshot={snapshotBase({ detalle: "Perímetro completo. Incluye tramo lateral." })}
        textos={TEXTOS_POR_DEFECTO_CERCOS}
        fotos={[]}
      />
    );
    expect(screen.getByText("Perímetro completo.")).toBeInTheDocument();
    expect(screen.getByText("Incluye tramo lateral.")).toBeInTheDocument();
  });
});

describe("DocumentoCerco · validez, texto legal y pie", () => {
  it("el texto de validez usa los días del snapshot", () => {
    render(
      <DocumentoCerco snapshot={snapshotBase({ validezDias: "15" })} textos={TEXTOS_POR_DEFECTO_CERCOS} fotos={[]} />
    );
    expect(
      screen.getByText("El presente presupuesto tiene una validez de 15 días.")
    ).toBeInTheDocument();
  });

  it("usa el texto legal/pie del catálogo compartido cuando se lo pasan, no el default fijo", () => {
    render(
      <DocumentoCerco
        snapshot={snapshotBase()}
        textos={{
          legal: "Texto legal reemplazado por el equipo.",
          footer: { ...TEXTOS_POR_DEFECTO_CERCOS.footer, whatsapp: "3530000000" },
        }}
        fotos={[]}
      />
    );
    expect(screen.getByText("Texto legal reemplazado por el equipo.")).toBeInTheDocument();
    expect(screen.getByText("WhatsApp: 3530000000")).toBeInTheDocument();
  });

  it("el pie por defecto trae la empresa/contacto reales", () => {
    render(<DocumentoCerco snapshot={snapshotBase()} textos={TEXTOS_POR_DEFECTO_CERCOS} fotos={[]} />);
    expect(screen.getByText("PLAYA Y SOL S.A.S.")).toBeInTheDocument();
  });
});

describe("DocumentoCerco · fotos", () => {
  it("sin fotos, no muestra la sección de galería", () => {
    render(<DocumentoCerco snapshot={snapshotBase()} textos={TEXTOS_POR_DEFECTO_CERCOS} fotos={[]} />);
    expect(screen.queryByText("Fotos ilustrativas")).not.toBeInTheDocument();
  });

  it("con fotos, muestra el título de galería y el pie de cada una", () => {
    render(
      <DocumentoCerco
        snapshot={snapshotBase()}
        textos={TEXTOS_POR_DEFECTO_CERCOS}
        fotos={[{ id: "f1", url: "blob:x", caption: "Frente de la propiedad" }]}
      />
    );
    expect(screen.getByText("Fotos ilustrativas")).toBeInTheDocument();
    expect(screen.getByText("Frente de la propiedad")).toBeInTheDocument();
  });
});

describe("DocumentoCerco · fotos de referencia", () => {
  it("siempre muestra las 2 fotos de referencia del cerco perimetral", () => {
    const { container } = render(<DocumentoCerco snapshot={snapshotBase()} textos={TEXTOS_POR_DEFECTO_CERCOS} fotos={[]} />);
    expect(screen.getByText("Fotos de referencia")).toBeInTheDocument();
    const imgs = [...container.querySelectorAll("img")].filter((img) => img.getAttribute("src")?.includes("cerco_perimetral"));
    expect(imgs).toHaveLength(2);
  });
});
