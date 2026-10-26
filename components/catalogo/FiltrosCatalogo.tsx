"use client";

import { SECCIONES, type SeccionId } from "@/lib/domain/catalogo/secciones";
import type { FiltroStock } from "@/lib/domain/catalogo/item";
import { opcionesDeOrden, type ClaveOrden } from "@/lib/ordenar";
import { PLANILLA_COSTOS_URL } from "@/lib/brand";
import { IconTable } from "@/components/icons";
import { BarraHerramientas, type SeccionFiltro } from "@/components/ui/BarraHerramientas";

export interface FiltrosCatalogoProps {
  busqueda: string;
  onBusqueda: (v: string) => void;
  seccion: SeccionId | "";
  onSeccion: (v: SeccionId | "") => void;
  /** Cuántos ítems hay por sección con el resto de los filtros aplicados. */
  conteos: { total: number; porSeccion: Partial<Record<SeccionId, number>> };
  stock: FiltroStock | "";
  onStock: (v: FiltroStock | "") => void;
  /** Ítems por disponibilidad; si ninguno lleva stock, el filtro se oculta. */
  conteosStock: Record<FiltroStock, number>;
  /** Cuántos ítems hay con todos los filtros menos el de stock (el contador de "Todos"). */
  totalStock: number;
  orden: ClaveOrden;
  onOrden: (v: ClaveOrden) => void;
  incluirInactivos: boolean;
  onIncluirInactivos: (v: boolean) => void;
  modoConsulta: boolean;
  onModoConsulta: (v: boolean) => void;
  hayFiltros: boolean;
  onLimpiar: () => void;
  /** Cuántos ítems da la lista con estos filtros. */
  resultados: number;
  contador?: React.ReactNode;
  contadorDerecha?: React.ReactNode;
  onAgregar?: () => void;
}

export const CLASE_SELECT =
  "min-h-11 w-full rounded-lg border bg-[#FFFFFF] px-3 py-2.5 text-base text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#244B5A]/20 sm:w-auto sm:text-sm";

const ORDENES = opcionesDeOrden(["nombre", "precio", "stock", "actualizado"]);

/**
 * La barra de Precios: buscador, Categoría, Stock (con sus contadores), Orden, "Mostrar desactivados" y "Modo
 * consulta rápida", "Planilla de costos" y "Agregar ítem". Todo lo arma `BarraHerramientas` (la misma de todas
 * las listas): en el celular, una fila con una hoja de filtros; en escritorio, una fila con menús.
 */
export function FiltrosCatalogo({
  busqueda,
  onBusqueda,
  seccion,
  onSeccion,
  conteos,
  stock,
  onStock,
  conteosStock,
  totalStock,
  orden,
  onOrden,
  incluirInactivos,
  onIncluirInactivos,
  modoConsulta,
  onModoConsulta,
  hayFiltros,
  onLimpiar,
  resultados,
  contador,
  contadorDerecha,
  onAgregar,
}: FiltrosCatalogoProps) {
  // Sólo las categorías con algo adentro (más la elegida, para poder des-elegirla).
  const seccionesVisibles = SECCIONES.filter((s) => (conteos.porSeccion[s.id] ?? 0) > 0 || s.id === seccion);
  const hayStock = conteosStock.disponible + conteosStock.agotado + conteosStock.negativo > 0 || stock !== "";

  const secciones: SeccionFiltro[] = [
    {
      id: "categoria",
      titulo: "Categoría",
      opciones: [
        { id: "", etiqueta: "Todas", cantidad: conteos.total },
        ...seccionesVisibles.map((s) => ({ id: s.id as string, etiqueta: s.etiqueta, cantidad: conteos.porSeccion[s.id] ?? 0 })),
      ],
      valor: seccion,
      onCambio: (v) => onSeccion(v as SeccionId | ""),
    },
    ...(hayStock
      ? [
          {
            id: "stock",
            titulo: "Stock",
            opciones: [
              { id: "", etiqueta: "Todos", cantidad: totalStock },
              { id: "disponible", etiqueta: "Con stock", cantidad: conteosStock.disponible, descripcion: "Más de 0 unidades" },
              { id: "agotado", etiqueta: "Sin stock", cantidad: conteosStock.agotado, descripcion: "Exactamente 0 unidades" },
              { id: "negativo", etiqueta: "Stock negativo", cantidad: conteosStock.negativo, tono: "aviso" as const, descripcion: "Se vendió más de lo cargado" },
              { id: "sin-control", etiqueta: "Sin control de stock", cantidad: conteosStock["sin-control"], descripcion: "Se piden a pedido" },
            ],
            valor: stock,
            onCambio: (v: string) => onStock(v as FiltroStock | ""),
          },
        ]
      : []),
  ];

  return (
    <BarraHerramientas
      buscador={{ valor: busqueda, onCambio: onBusqueda, placeholder: "Buscar ítem", etiqueta: "Buscar en el catálogo" }}
      secciones={secciones}
      orden={{ opciones: ORDENES, valor: orden, onCambio: onOrden }}
      interruptores={[
        { id: "inactivos", etiqueta: "Mostrar desactivados", valor: incluirInactivos, onCambio: onIncluirInactivos },
        { id: "consulta", etiqueta: "Modo consulta rápida", valor: modoConsulta, onCambio: onModoConsulta },
      ]}
      acciones={[
        { etiqueta: "Actualizar precios", href: "/dashboard/catalogo/actualizar-precios?que=ventas" },
        { etiqueta: "Planilla de costos", texto: "Planilla", href: PLANILLA_COSTOS_URL, icono: <IconTable className="h-4 w-4" /> },
      ]}
      agregar={modoConsulta ? undefined : { etiqueta: "Agregar ítem", onClick: onAgregar }}
      resultados={resultados}
      contador={contador}
      contadorDerecha={contadorDerecha}
      hayFiltros={hayFiltros}
      onLimpiar={onLimpiar}
    />
  );
}
