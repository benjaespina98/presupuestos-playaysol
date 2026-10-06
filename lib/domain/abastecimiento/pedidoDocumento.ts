import { z } from "zod";
import type { BordePedido, ParametrosPedido, Pedido } from "./pedido";

/**
 * El pedido FORMAL: lo que se guarda (con su número) y lo que se imprime o se
 * manda al proveedor.
 *
 * Se guarda una FOTO del pedido (cada línea con su proveedor, cantidad y precio
 * del momento) y no una referencia al catálogo: si mañana cambia un precio o se
 * da de baja un material, el pedido de ayer sigue diciendo lo que se pidió.
 *
 * Todo puro (sin red ni DOM) para poder probarlo.
 */

export const ESTADOS_PEDIDO = ["borrador", "enviado", "recibido", "cancelado"] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

export const ETIQUETA_ESTADO: Record<EstadoPedido, string> = {
  borrador: "Borrador",
  enviado: "Enviado",
  recibido: "Recibido",
  cancelado: "Cancelado",
};

/** Una línea del pedido tal como quedó guardada. */
export const LineaGuardada = z.object({
  material_id: z.string(),
  nombre: z.string(),
  unidad: z.string().nullable(),
  cantidad: z.number(),
  /** null = precio a confirmar con el proveedor. */
  precio: z.number().nullable(),
  subtotal: z.number(),
  proveedor_id: z.string().nullable(),
  /** El nombre del proveedor en ese momento ("Sin proveedor" si no tenía). */
  proveedor: z.string(),
  contacto: z.string().nullable(),
  telefono: z.string().nullable(),
});
export type LineaGuardada = z.infer<typeof LineaGuardada>;

export const ParametrosGuardados = z.object({
  tamano: z.string(),
  obras: z.number(),
  borde: z.enum(["Losetas", "Deck"]),
  luces: z.number(),
  luzCamaAgua: z.boolean(),
  banoQuimico: z.boolean(),
});

export const PedidoGuardado = z.object({
  id: z.string(),
  /** Correlativo: 1, 2, 3... Se muestra como PED-0001. */
  numero: z.number(),
  obra: z.string(),
  solicitante: z.string(),
  parametros: ParametrosGuardados,
  lineas: z.array(LineaGuardada),
  costo: z.number(),
  estado: z.enum(ESTADOS_PEDIDO),
  notas: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type PedidoGuardado = z.infer<typeof PedidoGuardado>;

/** "PED-0007"; sin número (todavía no se guardó) es "BORRADOR". */
export function numeroFormateado(numero: number | null | undefined): string {
  return typeof numero === "number" && Number.isFinite(numero) ? `PED-${String(numero).padStart(4, "0")}` : "BORRADOR";
}

const redondear = (n: number) => Math.round(n * 100) / 100;

/** Las líneas de un pedido calculado, aplanadas y con los datos del proveedor adentro. */
export function lineasDePedido(pedido: Pedido): LineaGuardada[] {
  return pedido.grupos.flatMap((g) =>
    g.lineas.map((l) => ({
      material_id: l.material.id,
      nombre: l.material.nombre,
      unidad: l.material.unidad,
      cantidad: l.cantidad,
      precio: l.precio,
      subtotal: l.subtotal,
      proveedor_id: g.proveedor?.id ?? null,
      proveedor: g.nombre,
      contacto: g.proveedor?.contacto ?? null,
      telefono: g.telefono,
    }))
  );
}

// ── El documento ────────────────────────────────────────────────────────────────

export interface LineaDocumento {
  descripcion: string;
  cantidad: number;
  unidad: string;
  /** null = a confirmar. */
  precio: number | null;
  /** null = a confirmar. */
  subtotal: number | null;
}

export interface SeccionProveedor {
  nombre: string;
  contacto: string;
  telefono: string;
  lineas: LineaDocumento[];
  /** Suma de lo que tiene precio. */
  subtotal: number;
  /** Cuántas líneas todavía no tienen precio. */
  sinPrecio: number;
}

export interface DocumentoPedido {
  /** "PED-0007" o "BORRADOR". */
  numero: string;
  /** dd/mm/aaaa */
  fecha: string;
  obra: string;
  solicitante: string;
  /** Las condiciones de la obra en renglones: "Pileta 8x4", "Borde: Losetas"... */
  condiciones: string[];
  proveedores: SeccionProveedor[];
  total: number;
  articulos: number;
  sinPrecio: number;
  observaciones: string;
}

export interface DatosDocumento {
  numero: number | null;
  fecha: Date;
  obra: string;
  solicitante: string;
  parametros: ParametrosPedido | z.infer<typeof ParametrosGuardados>;
  observaciones?: string;
}

/** "5 de octubre" no: el formato de siempre en los documentos de la empresa, dd/mm/aaaa. */
export function fechaDocumento(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

const coma = (n: number) => String(redondear(n)).replace(".", ",");

/** Las condiciones de la obra, listas para imprimir. */
export function condicionesDeObra(p: ParametrosPedido | z.infer<typeof ParametrosGuardados>): string[] {
  const borde: BordePedido = p.borde;
  return [
    `Pileta ${p.tamano}${p.obras > 1 ? ` · ${coma(p.obras)} obras` : ""}`,
    `Borde: ${borde}`,
    ...(p.luces > 0 ? [`Luces: ${coma(p.luces)}`] : []),
    ...(p.luzCamaAgua ? ["Luz en la cama de agua"] : []),
    ...(p.banoQuimico ? ["Baño químico"] : []),
  ];
}

/** Agrupa las líneas por proveedor en el orden en que aparecen. */
export function armarDocumento(lineas: readonly LineaGuardada[], datos: DatosDocumento): DocumentoPedido {
  const secciones: SeccionProveedor[] = [];
  const porClave = new Map<string, SeccionProveedor>();

  for (const l of lineas) {
    const clave = l.proveedor_id ?? `sin:${l.proveedor}`;
    let s = porClave.get(clave);
    if (!s) {
      s = { nombre: l.proveedor, contacto: l.contacto ?? "", telefono: l.telefono ?? "", lineas: [], subtotal: 0, sinPrecio: 0 };
      porClave.set(clave, s);
      secciones.push(s);
    }
    s.lineas.push({
      descripcion: l.nombre,
      cantidad: l.cantidad,
      unidad: l.unidad ?? "",
      precio: l.precio,
      subtotal: l.precio === null ? null : l.subtotal,
    });
    if (l.precio === null) s.sinPrecio += 1;
    else s.subtotal = redondear(s.subtotal + l.subtotal);
  }

  return {
    numero: numeroFormateado(datos.numero),
    fecha: fechaDocumento(datos.fecha),
    obra: datos.obra.trim(),
    solicitante: datos.solicitante.trim(),
    condiciones: condicionesDeObra(datos.parametros),
    proveedores: secciones,
    total: redondear(secciones.reduce((s, x) => s + x.subtotal, 0)),
    articulos: lineas.length,
    sinPrecio: secciones.reduce((s, x) => s + x.sinPrecio, 0),
    observaciones: (datos.observaciones ?? "").trim(),
  };
}

/** Un documento por proveedor: lo que se le manda a cada uno por separado. */
export function separarPorProveedor(doc: DocumentoPedido): DocumentoPedido[] {
  return doc.proveedores.map((s) => ({
    ...doc,
    proveedores: [s],
    total: s.subtotal,
    articulos: s.lineas.length,
    sinPrecio: s.sinPrecio,
  }));
}

/** Un texto apto para nombre de archivo: sin tildes ni caracteres que Windows no acepta. */
export function paraArchivo(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

/**
 * El nombre del archivo: `Pedido_PED-0007_Familia_Perez.pdf` para el pedido
 * completo y `Pedido_PED-0007_Ranco_Materiales.pdf` para el de un proveedor.
 */
export function nombreArchivoPedido(doc: DocumentoPedido, extension: string, proveedor?: string): string {
  const partes = [
    "Pedido",
    doc.numero,
    proveedor ? paraArchivo(proveedor) : paraArchivo(doc.obra),
  ].filter(Boolean);
  return `${partes.join("_")}.${extension}`;
}
