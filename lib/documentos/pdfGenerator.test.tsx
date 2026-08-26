import { describe, expect, it } from "vitest";
import type { BloqueDocumento } from "./modelo";
import { generarPdfPresupuesto } from "./pdfGenerator";

/**
 * Smoke test del "PDF Generator": confirma que el pipeline
 * bloques → react-pdf produce un PDF real (no vacío, con la firma correcta),
 * sin depender de un navegador — corre bajo Node, igual que el resto de
 * vitest (ver vitest.config.mts). No reemplaza la validación visual manual
 * (comparar contra el presupuesto real) que pide el punto de verificación
 * del plan, pero sí protege contra que el pipeline se rompa en silencio
 * (bloque nuevo sin mapear, import roto, etc.).
 */
describe("generarPdfPresupuesto", () => {
  it("genera un PDF válido y no vacío a partir de un set de bloques representativo", async () => {
    const bloques: BloqueDocumento[] = [
      { tipo: "encabezado", color: "#00829C", logoUrl: "/header-teal.png" },
      { tipo: "titulo", texto: "Presupuesto de construcción piscina" },
      { tipo: "meta", pares: [{ label: "Señor/Sra:", value: "Pérez, Juan" }] },
      { tipo: "listaDetalle", titulo: "Dimensión piscina", lineas: ["8 mts largo por 4 mts ancho."], siempreVisible: true },
      {
        tipo: "seccionPrecios",
        variante: "totales",
        renglones: [{ descripcion: "SUBTOTAL", monto: "$ 18.500.000", grande: true, destacado: true }],
      },
      { tipo: "tituloSeccion", texto: "Opcionales" },
      { tipo: "tarjetaOpcional", descripcion: "Luces de acero inoxidable", monto: "$ 240.000", fotos: [] },
      { tipo: "tarjetaOpcional", descripcion: "Baño químico", monto: null, fotos: [] },
      { tipo: "validez", dias: "7" },
      { tipo: "textoLegal", texto: "Texto legal.\nSegunda línea." },
      {
        tipo: "pie",
        footer: {
          empresa: "PLAYA Y SOL S.A.S.",
          direccion: "Corrientes 1210, Villa María, Córdoba",
          telFijo: "0353-4531612",
          contactoNombre: "Cr. Francisco Espina",
          contactoCel: "3535668994",
          whatsapp: "3534224605",
          email: "piscinas@playaysol.com.ar",
          web: "www.playaysol.com.ar",
          facebook: "Playa y Sol Piscinas",
          facebookUrl: "",
          instagram: "@playaysol.piscinas",
          instagramUrl: "https://www.instagram.com/playaysol.piscinas/",
        },
      },
    ];

    const blob = await generarPdfPresupuesto(bloques, "Presupuesto_Piscina_Perez_2026-08-20");
    expect(blob.size).toBeGreaterThan(1000);
    const bytes = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
    // Un PDF válido arranca con la firma "%PDF-".
    expect(String.fromCharCode(...bytes)).toBe("%PDF-");
  });
});
