import { z } from "zod";
import { formatARS } from "@/lib/format/ars";
import { ETIQUETA_TIPO, cantidadConSigno } from "@/lib/domain/stock/movimientos";
import { quienHizo, type MovimientoConItem } from "@/lib/domain/stock/resumen";
import { nombreYDetalle } from "@/lib/domain/catalogo/nombre";

/**
 * La actividad del portal en castellano: quién hizo qué y cuándo, juntando el registro de auditoría (precios,
 * materiales, proveedores, pedidos, presupuestos) con el de movimientos de stock. Lo que no hizo una persona
 * (carga directa en la base, procesos) figura como "Sistema". Nunca muestra datos sensibles: la auditoría ya no los
 * guarda (sólo dice QUÉ campo cambió, no su valor) y acá se repite ese criterio.
 */

export type AreaActividad = "precios" | "stock" | "presupuestos" | "pedidos" | "compras";

export const ETIQUETA_AREA: Record<AreaActividad, string> = {
  precios: "Precios",
  stock: "Stock",
  presupuestos: "Presupuestos",
  pedidos: "Pedidos",
  compras: "Compras",
};

export const SISTEMA = "Sistema";

export const FilaAuditoria = z.object({
  id: z.number(),
  tabla: z.string(),
  registro_id: z.string(),
  accion: z.enum(["INSERT", "UPDATE", "DELETE"]),
  usuario_id: z.string().nullable(),
  fecha: z.string(),
  columnas_cambiadas: z.array(z.string()).default([]),
  valores: z
    .object({ antes: z.record(z.string(), z.unknown()).optional(), despues: z.record(z.string(), z.unknown()).optional() })
    .nullable()
    .default(null),
});
export type FilaAuditoria = z.infer<typeof FilaAuditoria>;

export interface EventoActividad {
  id: string;
  fecha: string;
  area: AreaActividad;
  titulo: string;
  detalle: string | null;
  quien: string;
  /** true = no lo hizo una persona. */
  sistema: boolean;
}

/** Los nombres de cada campo tal como se dicen, y los campos internos que no le dicen nada a nadie. */
const CAMPO: Record<string, string> = {
  descripcion: "el nombre",
  nombre: "el nombre",
  precio: "el precio",
  categoria: "la categoría",
  unidad: "la unidad",
  orden: "el orden",
  activo: "si está activo",
  rubro: "el rubro",
  contacto: "el contacto",
  telefono: "el teléfono",
  forma_pago: "la forma de pago",
  plazo: "el plazo",
  notas: "las notas",
  usd_ref: "el precio en USD",
  proveedor_id: "el proveedor",
  aplica: "a qué se aplica",
  cantidades: "las cantidades",
  precio_actualizado: "la fecha del precio",
  estado: "el estado",
  obra: "la obra",
  solicitante: "quién lo pide",
  lineas: "los artículos",
  costo: "el costo",
  parametros: "los datos del pedido",
  datos: "los datos",
  cliente_nombre: "el cliente",
  anulado_at: "la anulación",
  anulado_motivo: "el motivo de la anulación",
};
const CAMPOS_INTERNOS = new Set(["id", "updated_by", "created_by", "created_at", "desactivado_at", "desactivado_por", "anulado_por", "stock", "numero"]);

const ESTADO_PEDIDO: Record<string, string> = { borrador: "Borrador", enviado: "Enviado", recibido: "Recibido", cancelado: "Cancelado" };
const TIPO_PRESUPUESTO: Record<string, string> = { piscinas: "piscinas", revestimientos: "revestimientos", cobertores: "cobertores", cercos: "cercos", losetas: "plano de piscina" };

const AREA_DE_TABLA: Record<string, AreaActividad> = {
  catalogo_items: "precios",
  materiales: "compras",
  proveedores: "compras",
  pedidos: "pedidos",
  presupuestos: "presupuestos",
};

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const precio = (v: unknown): string => (typeof v === "number" ? formatARS(v) : "a cotizar");
const lista = (xs: string[]): string => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);

function camposCambiados(f: FilaAuditoria): string[] {
  return f.columnas_cambiadas.filter((c) => !CAMPOS_INTERNOS.has(c)).map((c) => CAMPO[c]).filter((x): x is string => !!x);
}

/** Cómo se llama el registro: lo que dice el propio evento y, si no, el nombre actual que se buscó en la base. */
export type BuscarNombre = (tabla: string, id: string) => string | null;

function nombreDelRegistro(f: FilaAuditoria, buscar: BuscarNombre): string | null {
  const fuente = { ...(f.valores?.antes ?? {}), ...(f.valores?.despues ?? {}) };
  const propio = texto(fuente.descripcion) ?? texto(fuente.nombre);
  if (propio) return nombreYDetalle({ clave: "", descripcion: propio }).nombre;
  const actual = buscar(f.tabla, f.registro_id);
  return actual ? nombreYDetalle({ clave: "", descripcion: actual }).nombre : null;
}

/** Una fila de la auditoría dicha en una frase. `quien` ya viene resuelto (nombre, mail o "Sistema"). */
export function describirAuditoria(f: FilaAuditoria, quien: string, buscar: BuscarNombre = () => null): EventoActividad | null {
  const area = AREA_DE_TABLA[f.tabla];
  if (!area) return null;
  const base = { id: `a${f.id}`, fecha: f.fecha, area, quien, sistema: f.usuario_id === null };
  const nombre = nombreDelRegistro(f, buscar);
  const antes = f.valores?.antes ?? {};
  const despues = f.valores?.despues ?? {};
  const cambios = camposCambiados(f);
  const comillas = nombre ? `«${nombre}»` : "";

  if (f.tabla === "catalogo_items" || f.tabla === "materiales") {
    const que = f.tabla === "materiales" ? "material" : "ítem";
    const donde = f.tabla === "materiales" ? "a Materiales" : "a Precios";
    if (f.accion === "INSERT") return { ...base, titulo: `Agregó ${comillas || `un ${que}`} ${donde}`, detalle: "precio" in despues ? `Precio: ${precio(despues.precio)}` : null };
    if (f.accion === "DELETE") return { ...base, titulo: `Eliminó ${comillas || `un ${que}`}`, detalle: null };
    if ("activo" in despues && despues.activo !== antes.activo) {
      return { ...base, titulo: `${despues.activo === false ? "Desactivó" : "Activó"} ${comillas || `un ${que}`}`, detalle: despues.activo === false ? "Deja de ofrecerse en presupuestos y pedidos nuevos." : null };
    }
    if ("precio" in despues) {
      const otros = cambios.filter((c) => c !== "el precio");
      return {
        ...base,
        titulo: `Cambió el precio de ${comillas || `un ${que}`}`,
        detalle: `${precio(antes.precio)} → ${precio(despues.precio)}${otros.length ? ` · también cambió ${lista(otros)}` : ""}`,
      };
    }
    return { ...base, titulo: `Editó ${comillas || `un ${que}`}`, detalle: cambios.length ? `Cambió ${lista(cambios)}` : null };
  }

  if (f.tabla === "proveedores") {
    if (f.accion === "INSERT") return { ...base, titulo: `Agregó el proveedor ${comillas}`.trim(), detalle: null };
    if (f.accion === "DELETE") return { ...base, titulo: `Eliminó el proveedor ${comillas}`.trim(), detalle: null };
    if ("activo" in despues && despues.activo !== antes.activo) return { ...base, titulo: `${despues.activo === false ? "Desactivó" : "Activó"} el proveedor ${comillas}`.trim(), detalle: null };
    return { ...base, titulo: `Editó el proveedor ${comillas}`.trim(), detalle: cambios.length ? `Cambió ${lista(cambios)}` : null };
  }

  if (f.tabla === "pedidos") {
    const numero = typeof despues.numero === "number" ? despues.numero : typeof antes.numero === "number" ? antes.numero : null;
    const pedido = numero !== null ? `el pedido PED-${String(numero).padStart(4, "0")}` : "un pedido";
    if (f.accion === "INSERT") return { ...base, titulo: `Creó ${pedido}`, detalle: null };
    if (f.accion === "DELETE") return { ...base, titulo: `Eliminó ${pedido}`, detalle: null };
    if (typeof despues.estado === "string" && despues.estado !== antes.estado) {
      return { ...base, titulo: `Pasó ${pedido} a ${ESTADO_PEDIDO[despues.estado] ?? despues.estado}`, detalle: null };
    }
    if (f.columnas_cambiadas.includes("anulado_at")) return { ...base, titulo: `Anuló ${pedido}`, detalle: null };
    return { ...base, titulo: `Editó ${pedido}`, detalle: cambios.length ? `Cambió ${lista(cambios)}` : null };
  }

  // presupuestos
  const tipo = texto(despues.tipo) ?? texto(antes.tipo) ?? buscar("presupuestos", f.registro_id);
  const presupuesto = `un presupuesto${tipo ? ` de ${TIPO_PRESUPUESTO[tipo] ?? tipo}` : ""}`;
  if (f.accion === "INSERT") return { ...base, titulo: `Guardó ${presupuesto}`, detalle: null };
  if (f.accion === "DELETE") return { ...base, titulo: `Eliminó ${presupuesto}`, detalle: null };
  if (f.columnas_cambiadas.includes("anulado_at")) return { ...base, titulo: `Anuló ${presupuesto}`, detalle: null };
  return { ...base, titulo: `Modificó ${presupuesto}`, detalle: cambios.length ? `Cambió ${lista(cambios)}` : null };
}

/** Un movimiento de stock dicho en una frase. */
export function describirMovimiento(m: MovimientoConItem): EventoActividad {
  const quien = quienHizo(m);
  const detalle = [`Quedó en ${m.stock_resultante}`, m.motivo, m.referencia].filter(Boolean).join(" · ");
  const accion =
    m.tipo === "venta" ? "Vendió" : m.tipo === "ingreso" ? "Ingresó" : m.tipo === "ajuste" ? "Ajustó el conteo de" : m.tipo === "anulacion" ? "Anuló un movimiento de" : "Abrió el stock de";
  return {
    id: `m${m.id}`,
    fecha: m.creado_at,
    area: "stock",
    titulo: `${accion} ${m.itemNombre} (${cantidadConSigno(m.cantidad)})`,
    detalle: `${ETIQUETA_TIPO[m.tipo]}${m.anulado ? " · anulado" : ""} · ${detalle}`,
    quien,
    sistema: m.creado_por === null,
  };
}

/** Todos los eventos juntos, del más nuevo al más viejo. */
export function ordenarEventos(eventos: readonly EventoActividad[]): EventoActividad[] {
  return [...eventos].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export type FiltroQuien = "todos" | "personas" | "sistema";

export function filtrarEventos(eventos: readonly EventoActividad[], filtro: { area: AreaActividad | ""; quien: FiltroQuien }): EventoActividad[] {
  return eventos.filter((e) => (!filtro.area || e.area === filtro.area) && (filtro.quien === "todos" || (filtro.quien === "sistema") === e.sistema));
}
