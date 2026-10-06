import { TAMANOS, type Material } from "./material";
import { ordenarProveedores, sinTelefono, type Proveedor } from "./proveedor";

/**
 * Pedido de materiales de una obra: qué hay que comprar, cuánto y a quién.
 *
 * Es la misma cuenta que hacía la planilla de costos (pestaña Pedido): para el
 * tamaño de pileta elegido se toma la cantidad estimada de cada material y se
 * multiplica por un factor que depende de CUÁNDO SE PIDE ese material (columna
 * "Aplica"), y por la cantidad de obras. Después se agrupa por proveedor.
 *
 * Todo puro (sin red ni DOM) para poder probarlo.
 */

export type BordePedido = "Losetas" | "Deck";

export interface ParametrosPedido {
  /** Uno de TAMANOS ("8x4"). */
  tamano: string;
  /** Cuántas obras iguales se piden juntas (mínimo 1). */
  obras: number;
  /** Terminación del borde: define si entran los materiales de losetas o los de deck. */
  borde: BordePedido;
  /** Cantidad de luces por pileta. */
  luces: number;
  /** Luz extra en la cama de agua. */
  luzCamaAgua: boolean;
  /** Baño químico para el personal de obra. */
  banoQuimico: boolean;
}

export const PARAMETROS_POR_DEFECTO: ParametrosPedido = {
  tamano: "8x4",
  obras: 1,
  borde: "Losetas",
  luces: 0,
  luzCamaAgua: false,
  banoQuimico: false,
};

/**
 * Por cuánto se multiplica la cantidad base de un material, según su "Aplica":
 *
 *   Siempre (y cualquier otro valor)  → 1: va en todas las obras
 *   Losetas / Deck                    → 1 si el borde elegido es ese, si no 0
 *   Luz                               → la cantidad de luces (una por cada luz)
 *   Luz (fija)                        → 1 si hay al menos una luz
 *   Luz cama de agua                  → 1 si se eligió esa luz
 *   Baño químico                      → 1 si se eligió
 */
export function factorDeAplica(aplica: string | null, p: ParametrosPedido): number {
  switch (aplica) {
    case "Losetas":
      return p.borde === "Losetas" ? 1 : 0;
    case "Deck":
      return p.borde === "Deck" ? 1 : 0;
    case "Baño químico":
      return p.banoQuimico ? 1 : 0;
    case "Luz":
      return Math.max(0, Number.isFinite(p.luces) ? p.luces : 0);
    case "Luz (fija)":
      return p.luces > 0 ? 1 : 0;
    case "Luz cama de agua":
      return p.luzCamaAgua ? 1 : 0;
    default:
      return 1;
  }
}

const redondear = (n: number) => Math.round(n * 100) / 100;

/** La cantidad a pedir de un material para estos parámetros (0 = no va en este pedido). */
export function cantidadDePedido(m: Pick<Material, "cantidades" | "aplica">, p: ParametrosPedido): number {
  if (!(TAMANOS as readonly string[]).includes(p.tamano)) return 0;
  const base = m.cantidades[p.tamano];
  if (typeof base !== "number" || !Number.isFinite(base) || base <= 0) return 0;
  const obras = Math.max(1, Number.isFinite(p.obras) ? p.obras : 1);
  return redondear(base * factorDeAplica(m.aplica, p) * obras);
}

/** Ajustes manuales sobre una línea del pedido (por id de material). */
export interface AjusteLinea {
  /** Reemplaza la cantidad calculada. */
  cantidad?: number;
  /** true = sacar este material del pedido. */
  excluido?: boolean;
}

export interface LineaPedido {
  material: Material;
  /** La cantidad que se pide (la calculada, o la ajustada a mano). */
  cantidad: number;
  /** La que salió de la cuenta, antes de cualquier ajuste. */
  calculada: number;
  /** null = precio a confirmar. */
  precio: number | null;
  /** cantidad × precio; 0 si el precio está a confirmar. */
  subtotal: number;
}

export interface GrupoPedido {
  proveedor: Proveedor | null;
  nombre: string;
  telefono: string | null;
  lineas: LineaPedido[];
  subtotal: number;
}

export interface Pedido {
  grupos: GrupoPedido[];
  /** Cuántos materiales distintos se piden. */
  articulos: number;
  /** A cuántos proveedores hay que contactar. */
  proveedores: number;
  /** Costo estimado: suma de los subtotales (lo que no tiene precio no suma). */
  costo: number;
  /** Cuántos materiales del pedido todavía no tienen precio. */
  sinPrecio: number;
}

export const SIN_PROVEEDOR = "Sin proveedor";

export function armarPedido(
  materiales: readonly Material[],
  proveedores: readonly Proveedor[],
  parametros: ParametrosPedido,
  ajustes: Readonly<Record<string, AjusteLinea>> = {}
): Pedido {
  const ordenProveedores = ordenarProveedores([...proveedores]);
  const posicion = new Map(ordenProveedores.map((p, i) => [p.id, i]));
  const SIN = Number.MAX_SAFE_INTEGER;

  // En el orden de la planilla: por proveedor (en el orden de la lista de proveedores)
  // y, adentro, por el orden de los materiales.
  const ordenados = [...materiales]
    .filter((m) => m.activo)
    .sort((a, b) => {
      const pa = a.proveedor_id !== null ? posicion.get(a.proveedor_id) ?? SIN : SIN;
      const pb = b.proveedor_id !== null ? posicion.get(b.proveedor_id) ?? SIN : SIN;
      if (pa !== pb) return pa - pb;
      const oa = a.orden ?? SIN;
      const ob = b.orden ?? SIN;
      return oa !== ob ? oa - ob : a.nombre.localeCompare(b.nombre, "es");
    });

  const porClave = new Map<string, GrupoPedido>();
  const grupos: GrupoPedido[] = [];

  for (const material of ordenados) {
    const calculada = cantidadDePedido(material, parametros);
    const ajuste = ajustes[material.id];
    if (calculada <= 0 && ajuste?.cantidad === undefined) continue; // no va en este pedido
    if (ajuste?.excluido) continue;

    const cantidad =
      ajuste?.cantidad !== undefined && Number.isFinite(ajuste.cantidad) && ajuste.cantidad >= 0
        ? redondear(ajuste.cantidad)
        : calculada;
    if (cantidad <= 0) continue;

    const proveedor = material.proveedor_id !== null ? ordenProveedores.find((p) => p.id === material.proveedor_id) ?? null : null;
    const clave = proveedor ? proveedor.id : SIN_PROVEEDOR;
    let grupo = porClave.get(clave);
    if (!grupo) {
      grupo = {
        proveedor,
        nombre: proveedor ? proveedor.nombre : SIN_PROVEEDOR,
        telefono: proveedor && !sinTelefono(proveedor) ? proveedor.telefono!.trim() : null,
        lineas: [],
        subtotal: 0,
      };
      porClave.set(clave, grupo);
      grupos.push(grupo);
    }

    const subtotal = redondear(cantidad * (material.precio ?? 0));
    grupo.lineas.push({ material, cantidad, calculada, precio: material.precio, subtotal });
    grupo.subtotal = redondear(grupo.subtotal + subtotal);
  }

  const lineas = grupos.flatMap((g) => g.lineas);
  return {
    grupos,
    articulos: lineas.length,
    proveedores: grupos.filter((g) => g.proveedor !== null).length,
    costo: redondear(grupos.reduce((s, g) => s + g.subtotal, 0)),
    sinPrecio: lineas.filter((l) => l.precio === null).length,
  };
}

// ── Texto para mandar y archivo para abrir en Excel ─────────────────────────────

export interface DatosEncabezado {
  /** Cliente u obra (texto libre). */
  obra: string;
  /** Quién hace el pedido. */
  pide: string;
}

const coma = (n: number) => String(redondear(n)).replace(".", ",");

/**
 * El mensaje de WhatsApp, con el mismo formato que armaba la planilla:
 *
 *   *PEDIDO DE MATERIALES — Playa & Sol*
 *   Obra: Familia Pérez · Pileta 8x4
 *   Borde: Losetas
 *   Pide: ________
 *
 *   *Ranco Materiales* · +54 9 ...
 *   - Hierro del 6: 90
 *   - Cemento 25 kg: 180 bolsa
 */
export function mensajeWhatsApp(pedido: Pedido, p: ParametrosPedido, e: DatosEncabezado): string {
  const obra = e.obra.trim();
  const obras = p.obras > 1 ? ` · ${coma(p.obras)} obras` : "";
  const extras = [
    p.luces > 0 ? `Luces: ${coma(p.luces)}` : "",
    p.luzCamaAgua ? "Luz en la cama de agua" : "",
    p.banoQuimico ? "Baño químico" : "",
  ].filter(Boolean);

  const cabecera = [
    "*PEDIDO DE MATERIALES — Playa & Sol*",
    `Obra: ${obra ? `${obra} · ` : ""}Pileta ${p.tamano}${obras}`,
    `Borde: ${p.borde}`,
    ...(extras.length ? [extras.join(" · ")] : []),
    `Pide: ${e.pide.trim() || "________"}`,
  ];

  const bloques = pedido.grupos.map((g) => mensajeDeGrupo(g));
  return [cabecera.join("\n"), ...bloques].join("\n\n");
}

/** Las líneas de UN proveedor, para mandárselas a él solo. */
export function mensajeDeGrupo(g: GrupoPedido): string {
  const titulo = `*${g.nombre}*${g.telefono ? ` · ${g.telefono}` : ""}`;
  const lineas = g.lineas.map((l) => {
    const unidad = l.material.unidad && l.material.unidad !== "unidad" ? ` ${l.material.unidad}` : "";
    return `- ${l.material.nombre}: ${coma(l.cantidad)}${unidad}`;
  });
  return [titulo, ...lineas].join("\n");
}

const celdaCsv = (v: string | number) => {
  const s = String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * El pedido como CSV para abrir en Excel en español: separador `;`, decimales
 * con coma y BOM UTF-8 (sin el BOM, Excel rompe las tildes).
 */
export function csvPedido(pedido: Pedido): string {
  const filas: (string | number)[][] = [
    ["Proveedor", "Teléfono", "Artículo", "Cantidad", "Unidad", "Precio unitario", "Subtotal"],
  ];
  for (const g of pedido.grupos) {
    for (const l of g.lineas) {
      filas.push([
        g.nombre,
        g.telefono ?? "",
        l.material.nombre,
        coma(l.cantidad),
        l.material.unidad ?? "",
        l.precio === null ? "A confirmar" : coma(l.precio),
        l.precio === null ? "" : coma(l.subtotal),
      ]);
    }
  }
  filas.push(["", "", "", "", "", "COSTO ESTIMADO", coma(pedido.costo)]);
  return "﻿" + filas.map((f) => f.map(celdaCsv).join(";")).join("\r\n");
}
