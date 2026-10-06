import { lineaDeClave } from "./listas";

/**
 * Las secciones del catálogo, tal como se las consulta: lo que más se mira va
 * como acceso directo (piscinas de hormigón, piscinas de fibra Indusplast,
 * cobertores, cercos, climatización y revestimientos); todo lo demás cae en
 * "Otros". Cada ítem pertenece a UNA sola sección.
 *
 * Es una vista del catálogo, no un campo: no se guarda ni cambia ningún precio.
 */
export const SECCIONES = [
  { id: "hormigon", etiqueta: "Piscinas de hormigón" },
  { id: "indusplast", etiqueta: "Piscinas de fibra Indusplast" },
  { id: "cobertores", etiqueta: "Cobertores" },
  { id: "cercos", etiqueta: "Cercos" },
  { id: "climatizacion", etiqueta: "Climatización" },
  { id: "revestimientos", etiqueta: "Revestimientos" },
  { id: "otros", etiqueta: "Otros" },
] as const;

export type SeccionId = (typeof SECCIONES)[number]["id"];

export const ETIQUETA_SECCION: Record<SeccionId, string> = Object.fromEntries(SECCIONES.map((s) => [s.id, s.etiqueta])) as Record<SeccionId, string>;

interface ItemParaSeccion {
  tipo: string;
  clave: string;
  descripcion: string | null;
  categoria: string | null;
}

/** La sección de un ítem: las piscinas completas por su prefijo, y el resto por calculadora, clave o categoría. */
export function seccionDeItem(item: ItemParaSeccion): SeccionId {
  const lista = lineaDeClave(item.clave);
  if (lista) return lista;
  const texto = `${item.clave} ${item.descripcion ?? ""}`.toLowerCase();
  if (/climatiz/.test(texto)) return "climatizacion";
  if (item.tipo === "cobertores" || item.categoria === "Cobertores") return "cobertores";
  if (item.tipo === "cercos" || item.categoria === "Cercos" || /^cerco/.test(item.clave)) return "cercos";
  if (item.tipo === "revestimientos" || item.categoria === "Revestimientos" || /^(revestimiento|travertino)/.test(item.clave)) {
    return "revestimientos";
  }
  return "otros";
}
