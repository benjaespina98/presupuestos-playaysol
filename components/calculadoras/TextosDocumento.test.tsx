// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TextosCompartidos } from "@/lib/documentos/textosCompartidos";
import { TextoLegal, PieDocumento } from "./TextosDocumento";

/**
 * `TextoLegal`/`PieDocumento` son el texto legal y el pie compartidos por
 * las 4 calculadoras tradicionales (antes copiados y pegados en cada
 * Documento*.tsx) — ver el comentario de TextosDocumento.tsx. Este test
 * cubre el tamaño de letra (el bug reportado: "casi no se ve") y que cada
 * campo del pie se muestre sólo cuando tiene valor, no la paridad de
 * contenido con cada documento en particular (eso lo cubre cada
 * Documento*.test.tsx).
 */

const TEXTOS: TextosCompartidos = {
  legal: "Texto legal de prueba.\nSegunda línea.",
  footer: {
    empresa: "PLAYA Y SOL S.A.S.",
    direccion: "Corrientes 1210, Villa María",
    telFijo: "0353-4531612",
    contactoNombre: "Cr. Francisco Espina",
    contactoCel: "3535668994",
    whatsapp: "3534224605",
    email: "piscinas@playaysol.com.ar",
    web: "playaysol.com.ar",
    facebook: "Playa y Sol Piscinas",
    facebookUrl: "",
    instagram: "@playaysol.piscinas",
    instagramUrl: "",
  },
};

describe("TextoLegal", () => {
  it("muestra el texto tal cual, en un tamaño legible (no la nota al pie de antes)", () => {
    const { container } = render(<TextoLegal texto={TEXTOS.legal} />);
    const parrafo = container.querySelector("p")!;
    expect(parrafo).toHaveTextContent("Texto legal de prueba.");
    expect(parrafo.className).toContain("text-sm");
    expect(parrafo.className).not.toContain("text-xs");
  });
});

describe("PieDocumento", () => {
  it("muestra la empresa y todos los campos de contacto cargados", () => {
    render(<PieDocumento textos={TEXTOS} />);
    expect(screen.getByText("PLAYA Y SOL S.A.S.")).toBeInTheDocument();
    expect(screen.getByText(/Corrientes 1210, Villa María/)).toBeInTheDocument();
    expect(screen.getByText("Tel: 0353-4531612")).toBeInTheDocument();
    expect(screen.getByText(/Cr\. Francisco Espina - Cel\. 3535668994/)).toBeInTheDocument();
    expect(screen.getByText("WhatsApp: 3534224605")).toBeInTheDocument();
    expect(screen.getByText("E-mail: piscinas@playaysol.com.ar")).toBeInTheDocument();
    expect(screen.getByText("Web: playaysol.com.ar")).toBeInTheDocument();
    expect(screen.getByText("Facebook: Playa y Sol Piscinas")).toBeInTheDocument();
    expect(screen.getByText("Instagram: @playaysol.piscinas")).toBeInTheDocument();
  });

  it("un campo de contacto vacío no deja una línea vacía", () => {
    render(<PieDocumento textos={{ ...TEXTOS, footer: { ...TEXTOS.footer, web: "", facebook: "", instagram: "" } }} />);
    expect(screen.queryByText(/^Web:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Facebook:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Instagram:/)).not.toBeInTheDocument();
  });
});
