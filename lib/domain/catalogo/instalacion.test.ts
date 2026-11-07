import { describe, expect, it } from "vitest";
import { condicionInstalacion } from "./instalacion";

const item = (clave: string, descripcion: string | null = null) => ({ clave, descripcion });

describe("condicionInstalacion", () => {
  it("los precios base de cercos y cobertores se leen por clave", () => {
    expect(condicionInstalacion(item("precioSin"))).toBe("Sin instalación");
    expect(condicionInstalacion(item("precioCon"))).toBe("Con instalación");
    expect(condicionInstalacion(item("precioMenos15"))).toBe("Sin instalación");
    expect(condicionInstalacion(item("precioMas15"))).toBe("Sin instalación");
    expect(condicionInstalacion(item("precioInstalacion"))).toBe("Se suma al total con instalación");
  });

  it("el resto, por lo que dice el nombre", () => {
    expect(condicionInstalacion(item("x", "Cerco perimetral desmontable, materiales y mano de obra, instalado (valor por metro lineal)"))).toBe("Con instalación");
    expect(condicionInstalacion(item("x", "Precio por metro lineal sin instalación"))).toBe("Sin instalación");
    expect(condicionInstalacion(item("x", "Cerámico Bali Brasil (por m² instalado)"))).toBe("Con instalación");
  });

  it("si no habla de instalación, no inventa nada", () => {
    expect(condicionInstalacion(item("luces", "Luces de acero inoxidable — precio por unidad"))).toBeNull();
    expect(condicionInstalacion(item("x", null))).toBeNull();
  });
});
