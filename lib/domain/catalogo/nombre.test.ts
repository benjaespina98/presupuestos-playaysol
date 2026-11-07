import { describe, expect, it } from "vitest";
import { nombreYDetalle, sinTituloRepetido } from "./nombre";

describe("sinTituloRepetido", () => {
  it("saca el título repetido al comienzo, con cualquier separador", () => {
    expect(sinTituloRepetido("Revestimientos - Cerámico Simil Piedra Bali", "Revestimientos")).toBe("Cerámico Simil Piedra Bali");
    expect(sinTituloRepetido("Revestimientos: Venecitas Premium", "Revestimientos")).toBe("Venecitas Premium");
    expect(sinTituloRepetido("REVESTIMIENTOS · Venecitas", "Revestimientos")).toBe("Venecitas");
    expect(sinTituloRepetido("Revestimiento - Venecitas", "Revestimientos")).toBe("Venecitas");
  });

  it("no toca lo que no empieza con el título, ni lo deja vacío", () => {
    expect(sinTituloRepetido("Cerámico para revestimientos", "Revestimientos")).toBe("Cerámico para revestimientos");
    expect(sinTituloRepetido("Revestimientos", "Revestimientos")).toBe("Revestimientos");
    expect(sinTituloRepetido("Cerco perimetral", "Cercos")).toBe("Cerco perimetral");
    expect(sinTituloRepetido("Hormigón 5x3", "Revestimientos", null)).toBe("Hormigón 5x3");
  });
});

describe("nombreYDetalle", () => {
  const n = (descripcion: string, clave = "x") => nombreYDetalle({ clave, descripcion });

  it("saca lo de paréntesis y lo que sigue a una raya o coma como detalle", () => {
    expect(n("Lona premium (mayor gramaje / color a elección)")).toEqual({ nombre: "Lona premium", detalle: "Mayor gramaje / color a elección" });
    expect(n("Cerámico Bali Brasil (por m² instalado)")).toEqual({ nombre: "Cerámico Bali Brasil", detalle: "Por m² instalado" });
    expect(n("Solar seco — losetas atérmicas (por m² terminado)")).toEqual({ nombre: "Solar seco", detalle: "Losetas atérmicas (por m² terminado)" });
  });

  it("los textos largos de fábrica tienen un nombre corto y el texto completo queda como detalle", () => {
    const r = n("Cerco perimetral desmontable de aluminio y lona microperforada para seguridad de niños y mascotas, materiales y mano de obra, instalado (valor por metro lineal)");
    expect(r.nombre).toBe("Cerco perimetral desmontable");
    expect(r.detalle).toContain("lona microperforada");
  });

  it("un nombre ya corto no se toca y no tiene detalle; sin texto usa la clave", () => {
    expect(n("Precio por metro lineal con instalación")).toEqual({ nombre: "Precio por metro lineal con instalación", detalle: null });
    expect(nombreYDetalle({ clave: "luces", descripcion: null })).toEqual({ nombre: "luces", detalle: null });
  });

  it("un texto largo sin separadores se corta antes de 'para'", () => {
    const r = n("Protector térmico de aluminio reforzado y lona microperforada de alta resistencia para uso intensivo en verano");
    expect(r.nombre).toBe("Protector térmico de aluminio reforzado y lona microperforada de alta resistencia");
    expect(r.detalle).toBe("Para uso intensivo en verano");
  });
});
