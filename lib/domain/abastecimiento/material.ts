import { z } from "zod";

/** Tamaños de pileta para los que se estima la cantidad a pedir. Es el orden de
 *  las columnas de la planilla de costos. */
export const TAMANOS = [
  "5x3",
  "6x3",
  "7x3",
  "7x3.50",
  "7x4",
  "8x3",
  "8x4",
  "9x3",
  "9x4",
  "10x4",
  "6.5x2.5",
] as const;
export type Tamano = (typeof TAMANOS)[number];

export const RUBROS_MATERIAL = [
  "Materiales",
  "Áridos",
  "Hidráulica",
  "PVC",
  "Eléctrico",
  "Luces",
  "Servicios",
] as const;

/** Cuándo entra un material en el pedido de una obra. */
export const APLICA = [
  "Siempre",
  "Losetas",
  "Deck",
  "Luz",
  "Luz (fija)",
  "Luz cama de agua",
  "Baño químico",
] as const;

export const UNIDADES_MATERIAL = ["unidad", "bolsa", "bolsita", "kg", "m³", "rollo", "kit", "servicio"] as const;

/** Cantidad por tamaño. Las claves son tamaños; un tamaño ausente = sin cargar. */
export const Cantidades = z.record(z.string(), z.number());
export type Cantidades = z.infer<typeof Cantidades>;

export const Material = z.object({
  id: z.string(),
  nombre: z.string(),
  proveedor_id: z.string().nullable(),
  unidad: z.string().nullable(),
  /** null = precio a confirmar con el proveedor. */
  precio: z.number().nullable(),
  /** Fecha ISO (YYYY-MM-DD) de la última actualización del precio. */
  precio_actualizado: z.string().nullable(),
  rubro: z.string().nullable(),
  aplica: z.string().nullable(),
  usd_ref: z.number().nullable(),
  notas: z.string().nullable(),
  cantidades: Cantidades,
  activo: z.boolean(),
  orden: z.number().nullable(),
  updated_at: z.string(),
});
export type Material = z.infer<typeof Material>;

/** Lo que se carga/edita desde el formulario (sin id ni fechas). */
export interface DatosMaterial {
  nombre: string;
  proveedor_id: string | null;
  unidad: string | null;
  precio: number | null;
  rubro: string | null;
  aplica: string | null;
  usd_ref: number | null;
  notas: string | null;
  cantidades: Cantidades;
  activo: boolean;
}

export interface FiltroMateriales {
  busqueda?: string;
  rubro?: string | null;
  proveedorId?: string | null;
  incluirInactivos?: boolean;
  /** Sólo los que no tienen precio cargado ("a confirmar"). */
  soloSinPrecio?: boolean;
}

export function filtrarMateriales(items: Material[], filtro: FiltroMateriales): Material[] {
  const q = filtro.busqueda?.trim().toLowerCase() ?? "";
  return items.filter((m) => {
    if (!filtro.incluirInactivos && !m.activo) return false;
    if (filtro.rubro && m.rubro !== filtro.rubro) return false;
    if (filtro.proveedorId && m.proveedor_id !== filtro.proveedorId) return false;
    if (filtro.soloSinPrecio && m.precio !== null) return false;
    if (q && !`${m.nombre} ${m.notas ?? ""}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Por rubro (en el orden de RUBROS_MATERIAL, "sin rubro" al final), después por
 *  `orden` manual y por último alfabético. */
export function ordenarMateriales(items: Material[]): Material[] {
  const posRubro = (r: string | null) => {
    const i = RUBROS_MATERIAL.findIndex((x) => x === r);
    return i === -1 ? RUBROS_MATERIAL.length : i;
  };
  return [...items].sort((a, b) => {
    const r = posRubro(a.rubro) - posRubro(b.rubro);
    if (r !== 0) return r;
    const oa = a.orden ?? Number.MAX_SAFE_INTEGER;
    const ob = b.orden ?? Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    return a.nombre.localeCompare(b.nombre, "es");
  });
}

/** Cuántos materiales hay por rubro, con el resto de los filtros aplicados
 *  (ignora el de rubro: son los contadores de los chips). */
export function contarMaterialesPorRubro(
  items: Material[],
  filtro: Omit<FiltroMateriales, "rubro">
): { total: number; porRubro: Record<string, number> } {
  const porRubro: Record<string, number> = {};
  const coincidentes = filtrarMateriales(items, { ...filtro, rubro: null });
  for (const m of coincidentes) {
    const r = m.rubro ?? "Sin rubro";
    porRubro[r] = (porRubro[r] ?? 0) + 1;
  }
  return { total: coincidentes.length, porRubro };
}

/** Cuántos materiales (activos o no) le compra la empresa a cada proveedor. */
export function materialesPorProveedor(items: Material[]): Record<string, number> {
  const conteo: Record<string, number> = {};
  for (const m of items) {
    if (m.proveedor_id) conteo[m.proveedor_id] = (conteo[m.proveedor_id] ?? 0) + 1;
  }
  return conteo;
}

/** Descarta del mapa de cantidades lo que no es un número finito ≥ 0 (un input
 *  vacío no es "0": es "sin cargar"). */
export function limpiarCantidades(c: Record<string, number | null | undefined>): Cantidades {
  const out: Cantidades = {};
  for (const [tamano, valor] of Object.entries(c)) {
    if (typeof valor === "number" && Number.isFinite(valor) && valor >= 0) out[tamano] = valor;
  }
  return out;
}
