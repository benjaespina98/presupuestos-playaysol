import { createHash } from "node:crypto";
import { TAMANOS, type Material } from "@/lib/domain/abastecimiento/material";
import type { Proveedor } from "@/lib/domain/abastecimiento/proveedor";

/**
 * Lo que el catálogo web le entrega a la planilla de costos (Google Sheets).
 *
 * El catálogo es la fuente de verdad; la planilla se actualiza desde acá. Para
 * que el script de la planilla sea lo más simple posible, esto ya sale con la
 * forma exacta de las filas de cada hoja:
 *
 *   Proveedores: A Proveedor · B Rubro · C Contacto · D Teléfono · E Forma de
 *                pago · F Plazo · G Qué se le compra / notas
 *   Artículos:   A Artículo · B Proveedor · C Unidad · D Precio ARS ·
 *                E Actualizado · F Rubro · G Aplica · H..R cantidad por tamaño ·
 *                S USD ref. · T Notas
 *
 * Es puro (sin red ni base de datos) para poder probarlo.
 */

export interface ItemPrecio {
  tipo: string;
  clave: string;
  precio: number | null;
  activo?: boolean;
}

export interface EntradaExportacion {
  proveedores: Proveedor[];
  materiales: Material[];
  items: ItemPrecio[];
}

export type Celda = string | number | null;

export interface ArticuloFila {
  /** Las 20 columnas A..T. `D` (precio) va en null si hay USD de referencia:
   *  en la planilla ese precio es una fórmula (USD × tipo de cambio). */
  fila: Celda[];
  /** true = el precio de la planilla es USD ref. × tipo de cambio. */
  usd: boolean;
}

export interface Exportacion {
  /** Cambia sólo si cambia el contenido: el script la usa para no reescribir la
   *  planilla cuando no hay nada nuevo. */
  version: string;
  generado: string;
  proveedores: Celda[][];
  articulos: ArticuloFila[];
  /** "tipo:clave" → precio de venta (null = a cotizar). Sólo ítems activos. */
  precios: Record<string, number | null>;
  tamanos: readonly string[];
}

const texto = (v: string | null | undefined): string => v ?? "";

/** "2026-06-18" → "18/06/2026" (como se escribe en la planilla). */
export function fechaParaPlanilla(iso: string | null): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** El orden de la planilla: el `orden` manual (el de la planilla original) y
 *  después, para lo nuevo, alfabético. */
function porOrden<T extends { orden: number | null; nombre: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const oa = a.orden ?? Number.MAX_SAFE_INTEGER;
    const ob = b.orden ?? Number.MAX_SAFE_INTEGER;
    return oa !== ob ? oa - ob : a.nombre.localeCompare(b.nombre, "es");
  });
}

export function armarExportacion(entrada: EntradaExportacion, ahora: Date = new Date()): Exportacion {
  const nombreProveedor = new Map(entrada.proveedores.map((p) => [p.id, p.nombre]));

  // Dados de baja no van a la planilla: es lo que "dar de baja" significa.
  const proveedores: Celda[][] = porOrden(entrada.proveedores.filter((p) => p.activo)).map((p) => [
    p.nombre,
    texto(p.rubro),
    texto(p.contacto),
    texto(p.telefono),
    texto(p.forma_pago),
    texto(p.plazo),
    texto(p.notas),
  ]);

  const articulos: ArticuloFila[] = porOrden(entrada.materiales.filter((m) => m.activo)).map((m) => {
    const usd = m.usd_ref !== null;
    return {
      usd,
      fila: [
        m.nombre,
        m.proveedor_id ? texto(nombreProveedor.get(m.proveedor_id)) : "",
        texto(m.unidad),
        usd ? null : m.precio,
        fechaParaPlanilla(m.precio_actualizado),
        texto(m.rubro),
        texto(m.aplica),
        ...TAMANOS.map((t) => (typeof m.cantidades[t] === "number" ? m.cantidades[t] : "")),
        m.usd_ref,
        texto(m.notas),
      ],
    };
  });

  const precios: Record<string, number | null> = {};
  for (const i of entrada.items) {
    if (i.clave.startsWith("__") || i.activo === false) continue;
    precios[`${i.tipo}:${i.clave}`] = i.precio;
  }

  const contenido = { proveedores, articulos, precios };
  const version = createHash("sha1").update(JSON.stringify(contenido)).digest("hex").slice(0, 16);

  return { version, generado: ahora.toISOString(), ...contenido, tamanos: TAMANOS };
}
