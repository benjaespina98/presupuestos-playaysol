/**
 * Orden elegido en las listas (Catálogo, Materiales, Proveedores, Pedidos, Historial). Sólo reordena lo que ya
 * se está mostrando: no toca los datos. `defecto` = el orden que cada pantalla ya traía.
 */
export type CampoOrden = "defecto" | "nombre" | "precio" | "stock" | "actualizado";
export type DireccionOrden = "asc" | "desc";
/** "defecto" o "<campo>-<asc|desc>". */
export type ClaveOrden = "defecto" | `${Exclude<CampoOrden, "defecto">}-${DireccionOrden}`;

export const ETIQUETAS_CAMPO: Record<Exclude<CampoOrden, "defecto">, { asc: string; desc: string }> = {
  nombre: { asc: "Nombre (A a Z)", desc: "Nombre (Z a A)" },
  precio: { asc: "Precio (menor a mayor)", desc: "Precio (mayor a menor)" },
  stock: { asc: "Stock (menor a mayor)", desc: "Stock (mayor a menor)" },
  actualizado: { asc: "Actualizado (más viejo primero)", desc: "Actualizado (más reciente primero)" },
};

/** Las opciones del selector de orden para los campos que tiene una pantalla (siempre empieza por "Orden actual"). */
export function opcionesDeOrden(campos: readonly Exclude<CampoOrden, "defecto">[]): { id: ClaveOrden; etiqueta: string }[] {
  return [
    { id: "defecto", etiqueta: "Orden actual" },
    ...campos.flatMap((c) => [
      { id: `${c}-asc` as ClaveOrden, etiqueta: ETIQUETAS_CAMPO[c].asc },
      { id: `${c}-desc` as ClaveOrden, etiqueta: ETIQUETAS_CAMPO[c].desc },
    ]),
  ];
}

/** Texto corto del botón del selector: "Orden", "Nombre ↑", "Precio ↓". */
export function etiquetaCortaDeOrden(clave: ClaveOrden): string {
  if (clave === "defecto") return "Orden";
  const [campo, dir] = clave.split("-") as [Exclude<CampoOrden, "defecto">, DireccionOrden];
  const nombre = campo === "actualizado" ? "Actualizado" : campo.charAt(0).toUpperCase() + campo.slice(1);
  return `${nombre} ${dir === "asc" ? "↑" : "↓"}`;
}

type Valor = string | number | null | undefined;

/**
 * Devuelve una copia ordenada. Con "defecto" devuelve la lista tal cual. Los valores vacíos (sin precio, sin
 * stock) van siempre al final, sin importar la dirección. El orden es estable: empates, como venían.
 */
export function ordenarPor<T>(items: readonly T[], clave: ClaveOrden, valores: Partial<Record<Exclude<CampoOrden, "defecto">, (item: T) => Valor>>): T[] {
  if (clave === "defecto") return [...items];
  const [campo, dir] = clave.split("-") as [Exclude<CampoOrden, "defecto">, DireccionOrden];
  const leer = valores[campo];
  if (!leer) return [...items];
  const signo = dir === "asc" ? 1 : -1;
  return items
    .map((item, i) => ({ item, i, v: leer(item) }))
    .sort((a, b) => {
      const av = a.v === null || a.v === undefined || a.v === "";
      const bv = b.v === null || b.v === undefined || b.v === "";
      if (av || bv) return av === bv ? a.i - b.i : av ? 1 : -1;
      const c =
        typeof a.v === "number" && typeof b.v === "number"
          ? a.v - b.v
          : String(a.v).localeCompare(String(b.v), "es", { sensitivity: "base", numeric: true });
      return c !== 0 ? c * signo : a.i - b.i;
    })
    .map((x) => x.item);
}
