import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { FOTOS_GENERALES, FOTOS_POR_CLAVE, fotosSeedDeOpcional } from "./fotosSeed";

const PUBLIC = path.join(__dirname, "..", "..", "..", "public");

function todasLasFotos(): { url: string; width: number; height: number }[] {
  return [...Object.values(FOTOS_POR_CLAVE).flat(), ...FOTOS_GENERALES];
}

describe("fotosSeed", () => {
  it("cada foto referenciada existe en public/seeds", () => {
    for (const foto of todasLasFotos()) {
      const ruta = path.join(PUBLIC, foto.url);
      expect(fs.existsSync(ruta), `${foto.url} no existe`).toBe(true);
    }
  });

  it("ancho y alto son positivos (hacen falta para no deformar la imagen en el docx)", () => {
    for (const foto of todasLasFotos()) {
      expect(foto.width, foto.url).toBeGreaterThan(0);
      expect(foto.height, foto.url).toBeGreaterThan(0);
    }
  });

  it("fotosSeedDeOpcional: clave conocida da sus fotos, clave desconocida da []", () => {
    expect(fotosSeedDeOpcional("cerco_perimetral")).toHaveLength(2);
    expect(fotosSeedDeOpcional("clave-que-no-existe")).toEqual([]);
    expect(fotosSeedDeOpcional(null)).toEqual([]);
  });

  it("travertino: las fotos cuelgan sólo del segundo opcional (pulido interior), para no repetirlas", () => {
    expect(fotosSeedDeOpcional("travertino_rustico_exterior")).toEqual([]);
    expect(fotosSeedDeOpcional("travertino_pulido_interior").length).toBeGreaterThan(0);
  });

  it("FOTOS_GENERALES tiene exactamente 3 fotos (2 modelos + 1 de obra)", () => {
    expect(FOTOS_GENERALES).toHaveLength(3);
  });
});
