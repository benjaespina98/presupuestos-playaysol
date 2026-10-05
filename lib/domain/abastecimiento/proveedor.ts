import { z } from "zod";

/**
 * Proveedor: a quién se le compra. Vive en el catálogo web (pestaña
 * Proveedores) y de ahí se vuelca a la planilla de costos.
 *
 * Los textos opcionales llegan de Supabase como `null`. En el formulario viajan
 * como string (un <input> no puede valer null): `aFormularioProveedor` /
 * `aProveedorNuevo` son la única traducción entre las dos formas.
 */
export const Proveedor = z.object({
  id: z.string(),
  nombre: z.string(),
  rubro: z.string().nullable(),
  contacto: z.string().nullable(),
  telefono: z.string().nullable(),
  forma_pago: z.string().nullable(),
  plazo: z.string().nullable(),
  notas: z.string().nullable(),
  activo: z.boolean(),
  orden: z.number().nullable(),
  updated_at: z.string(),
});
export type Proveedor = z.infer<typeof Proveedor>;

/** Lo que se carga/edita desde el formulario (sin id ni fechas). */
export interface DatosProveedor {
  nombre: string;
  rubro: string | null;
  contacto: string | null;
  telefono: string | null;
  forma_pago: string | null;
  plazo: string | null;
  notas: string | null;
  activo: boolean;
}

/** "Falta el teléfono": en la planilla era la celda amarilla. */
export function sinTelefono(p: Pick<Proveedor, "telefono">): boolean {
  const t = p.telefono?.trim() ?? "";
  // La planilla usa "—" para "no tiene / no aplica".
  return t === "" || t === "—" || t === "-";
}

export interface FiltroProveedores {
  busqueda?: string;
  incluirInactivos?: boolean;
  /** Sólo los que no tienen teléfono cargado. */
  soloSinTelefono?: boolean;
}

export function filtrarProveedores(items: Proveedor[], filtro: FiltroProveedores): Proveedor[] {
  const q = filtro.busqueda?.trim().toLowerCase() ?? "";
  return items.filter((p) => {
    if (!filtro.incluirInactivos && !p.activo) return false;
    if (filtro.soloSinTelefono && !sinTelefono(p)) return false;
    if (q) {
      const texto = [p.nombre, p.rubro, p.contacto, p.telefono, p.notas].join(" ").toLowerCase();
      if (!texto.includes(q)) return false;
    }
    return true;
  });
}

/** `orden` manual primero (el de la planilla: es el orden del pedido), y
 *  después alfabético. */
export function ordenarProveedores(items: Proveedor[]): Proveedor[] {
  return [...items].sort((a, b) => {
    const oa = a.orden ?? Number.MAX_SAFE_INTEGER;
    const ob = b.orden ?? Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    return a.nombre.localeCompare(b.nombre, "es");
  });
}
