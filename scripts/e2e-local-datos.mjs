// Datos que comparten el armado de la base local (scripts/e2e-local.mjs) y la
// prueba (tests/local/cierre.spec.ts). Todo inventado: el repo es público.

/** Un ítem de fibra, un cliente y una obra POR VIEWPORT, para que celular y escritorio no se pisen. */
export const POR_PROYECTO = {
  movil: { piscina: "Caribe 550", claveItem: "indusplast_caribe_550", cliente: "Cliente E2E Movil" },
  escritorio: { piscina: "Caribe 650", claveItem: "indusplast_caribe_650", cliente: "Cliente E2E Escritorio" },
};

/** Un ítem del catálogo que NO lleva stock (se pide a pedido). */
export const ITEM_SIN_STOCK = { clave: "luces", texto: "Luces de acero inoxidable" };

export const PROVEEDOR_DESACTIVADO = "Proveedor Viejo E2E";
export const MATERIAL_DE_ESE_PROVEEDOR = "Material de Proveedor Viejo E2E";

export const STOCK_INICIAL = 5;
