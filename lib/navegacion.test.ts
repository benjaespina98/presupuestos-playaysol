import { describe, expect, it } from "vitest";
import { seccionDeRuta } from "./navegacion";

describe("seccionDeRuta", () => {
  it.each([
    ["/dashboard", null],
    ["/dashboard/nuevo", "presupuestos"],
    ["/dashboard/historial", "presupuestos"],
    ["/dashboard/piscinas", "presupuestos"],
    ["/dashboard/losetas", null],
    ["/dashboard/actividad", null],
    ["/dashboard/stock", "stock"],
    ["/dashboard/catalogo", "precios"],
    ["/dashboard/catalogo/actualizar-precios", "precios"],
    ["/dashboard/catalogo/materiales", "compras"],
    ["/dashboard/catalogo/proveedores", "compras"],
    ["/dashboard/catalogo/pedido", "compras"],
    ["/dashboard/catalogo/pedidos", "compras"],
  ])("%s → %s", (ruta, seccion) => {
    expect(seccionDeRuta(ruta)).toBe(seccion);
  });
});
