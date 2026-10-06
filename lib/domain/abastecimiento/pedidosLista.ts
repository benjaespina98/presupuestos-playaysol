import { ESTADOS_PEDIDO, numeroFormateado, type EstadoPedido, type PedidoGuardado } from "./pedidoDocumento";

/** Filtros del historial de pedidos. */
export interface FiltroPedidos {
  busqueda?: string;
  estado?: EstadoPedido | null;
}

/** Los nombres de proveedor distintos de un pedido, en el orden en que se piden. */
export function proveedoresDePedido(p: Pick<PedidoGuardado, "lineas">): string[] {
  return [...new Set(p.lineas.map((l) => l.proveedor))];
}

/**
 * Busca por número ("7", "PED-0007"), obra, quien pidió y proveedor, y filtra por
 * estado. Los más nuevos primero.
 */
export function filtrarPedidos(items: readonly PedidoGuardado[], filtro: FiltroPedidos): PedidoGuardado[] {
  const q = filtro.busqueda?.trim().toLowerCase() ?? "";
  return items
    .filter((p) => {
      if (filtro.estado && p.estado !== filtro.estado) return false;
      if (!q) return true;
      const texto = [numeroFormateado(p.numero), String(p.numero), p.obra, p.solicitante, p.parametros.tamano, ...proveedoresDePedido(p)]
        .join(" ")
        .toLowerCase();
      return texto.includes(q);
    })
    .sort((a, b) => b.numero - a.numero);
}

/** Cuántos pedidos hay por estado, con la búsqueda aplicada (ignora el filtro de estado: son los contadores de los chips). */
export function contarPorEstado(
  items: readonly PedidoGuardado[],
  busqueda: string
): { total: number; porEstado: Record<EstadoPedido, number> } {
  const porEstado = Object.fromEntries(ESTADOS_PEDIDO.map((e) => [e, 0])) as Record<EstadoPedido, number>;
  const coincidentes = filtrarPedidos(items, { busqueda });
  for (const p of coincidentes) porEstado[p.estado] += 1;
  return { total: coincidentes.length, porEstado };
}
