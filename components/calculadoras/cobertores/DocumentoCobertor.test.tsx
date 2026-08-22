// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PresupuestoV1 } from "@/lib/domain/presupuesto/v1";
import { crearLinea } from "@/lib/domain/precios/tipos";
import { TEXTOS_POR_DEFECTO_COBERTORES } from "@/lib/documentos/cobertores/docx";
import { DocumentoCobertor } from "./DocumentoCobertor";

function snapshotBase(overrides: Partial<PresupuestoV1> = {}): PresupuestoV1 {
  return {
    v: 1,
    tipo: "cobertores",
    fecha: "20/08/2026",
    validezDias: "7",
    cliente: {
      nombre: "Gómez, Ana",
      domicilio: "Belgrano 100",
      localidad: "Villa María",
      telefono: "353 111-2222",
      email: "ana@ejemplo.com",
    },
    medidas: { largo: 8, ancho: 4, adicionalM2: 0 },
    lineas: [],
    preciosBase: { precioPorM2HastaUmbral: 10903, precioPorM2SobreUmbral: 9902, precioInstalacion: 100000 },
    totales: [316864, 416864],
    detalle: "",
    variacionEncabezado: "teal",
    modoPrecio: "ambos",
    fotos: [],
    ...overrides,
  };
}

describe("DocumentoCobertor · contenido", () => {
  it("muestra las medidas con el formato del legacy", () => {
    render(<DocumentoCobertor snapshot={snapshotBase()} textos={TEXTOS_POR_DEFECTO_COBERTORES} fotos={[]} />);
    expect(screen.getByText(/8 m largo × 4 m ancho = 32 m²/)).toBeInTheDocument();
    expect(screen.getByText(/= 32 m² a cubrir/)).toBeInTheDocument();
  });

  it("con adicional de m², agrega el renglón 'Adicional: X m²'", () => {
    render(
      <DocumentoCobertor
        snapshot={snapshotBase({ medidas: { largo: 3, ancho: 4.5, adicionalM2: 2 } })}
        textos={TEXTOS_POR_DEFECTO_COBERTORES}
        fotos={[]}
      />
    );
    expect(screen.getByText(/Adicional: 2 m²/)).toBeInTheDocument();
  });

  it("un opcional no incluido no aparece", () => {
    render(
      <DocumentoCobertor
        snapshot={snapshotBase({
          lineas: [
            crearLinea({
              clave: "funda_protectora_invierno",
              descripcion: "Funda protectora para guardado",
              unidad: null,
              cantidad: 1,
              precioUnitario: null,
              naturaleza: "informativa",
              incluida: false,
              origen: "catalogo",
            }),
          ],
        })}
        textos={TEXTOS_POR_DEFECTO_COBERTORES}
        fotos={[]}
      />
    );
    expect(screen.queryByText("Funda protectora para guardado")).not.toBeInTheDocument();
  });

  it("el título es el de cobertores, no el de cercos", () => {
    render(<DocumentoCobertor snapshot={snapshotBase()} textos={TEXTOS_POR_DEFECTO_COBERTORES} fotos={[]} />);
    expect(screen.getByText("Presupuesto de cobertor para piscina")).toBeInTheDocument();
  });
});

describe("DocumentoCobertor · fotos de referencia", () => {
  it("siempre muestra las 2 fotos de referencia del cobertor", () => {
    const { container } = render(<DocumentoCobertor snapshot={snapshotBase()} textos={TEXTOS_POR_DEFECTO_COBERTORES} fotos={[]} />);
    expect(screen.getByText("Fotos de referencia")).toBeInTheDocument();
    const imgs = [...container.querySelectorAll("img")].filter((img) => img.getAttribute("src")?.includes("/seeds/general-"));
    expect(imgs).toHaveLength(2);
  });
});
