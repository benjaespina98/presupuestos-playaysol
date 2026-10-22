"use client";

import { SECCIONES, type SeccionId } from "@/lib/domain/catalogo/secciones";
import type { FiltroStock } from "@/lib/domain/catalogo/item";
import { etiquetaCortaDeOrden, opcionesDeOrden, type ClaveOrden } from "@/lib/ordenar";
import { Buscador } from "@/components/ui/FiltrosPlegables";
import { BarraListado, BotonFiltros, Chip, ChipsFila, Interruptor, MenuSeleccion, type OpcionMenu } from "@/components/ui/BarraListado";

// Se re-exportan para las pantallas que ya los importaban de acá.
export { Chip, Interruptor };

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
}

export const CLASE_SELECT =
  "min-h-11 w-full rounded-lg border bg-white px-3 py-2.5 text-base text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#244B5A]/20 sm:w-auto sm:text-sm";

const ORDENES = opcionesDeOrden(["nombre", "precio", "stock", "actualizado"]);

/**
 * La barra del Catálogo de precios: UNA fila en escritorio (buscador · secciones en una fila de chips ·
 * stock · orden · "Filtros") y a lo sumo dos en el celular. "Filtros" abre un panel con "Mostrar desactivados",
 * "Modo consulta rápida" y "Limpiar filtros".
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
}: FiltrosCatalogoProps) {
  // Sólo las secciones con algo adentro (más la elegida, para poder des-elegirla).
  const seccionesVisibles = SECCIONES.filter((s) => (conteos.porSeccion[s.id] ?? 0) > 0 || s.id === seccion);
  const hayStock = conteosStock.disponible + conteosStock.agotado + conteosStock.negativo > 0 || stock !== "";

  const opcionesStock: OpcionMenu<FiltroStock | "todos">[] = [
    { id: "todos", etiqueta: "Todos", cantidad: totalStock },
    { id: "disponible", etiqueta: "Con stock", cantidad: conteosStock.disponible, descripcion: "Más de 0 unidades" },
    { id: "agotado", etiqueta: "Sin stock", cantidad: conteosStock.agotado, descripcion: "Exactamente 0 unidades" },
    { id: "negativo", etiqueta: "Stock negativo", cantidad: conteosStock.negativo, tono: "aviso", descripcion: "Se vendió más de lo cargado" },
    { id: "sin-control", etiqueta: "Sin control de stock", cantidad: conteosStock["sin-control"], descripcion: "Se piden a pedido" },
  ];
  const filtrosActivos = [incluirInactivos, modoConsulta].filter(Boolean).length;

  return (
    <BarraListado
      buscador={<Buscador valor={busqueda} onCambio={onBusqueda} placeholder="Buscar: Caribe 550, cerco…" etiqueta="Buscar en el catálogo" />}
      menus={
        <>
          {hayStock && (
            <MenuSeleccion
              etiqueta="Filtrar por stock"
              titulo="Stock"
              opciones={opcionesStock}
              valor={stock === "" ? "todos" : stock}
              porDefecto="todos"
              onCambio={(v) => onStock(v === "todos" ? "" : v)}
            />
          )}
          <MenuSeleccion
            etiqueta="Ordenar"
            titulo="Orden"
            opciones={ORDENES.map((o) => ({ id: o.id, etiqueta: o.etiqueta }))}
            valor={orden}
            porDefecto="defecto"
            onCambio={onOrden}
            textoBoton={etiquetaCortaDeOrden(orden)}
          />
        </>
      }
      chips={
        <ChipsFila etiqueta="Filtrar por sección">
          <Chip activo={seccion === ""} onClick={() => onSeccion("")} cantidad={conteos.total}>
            Todo
          </Chip>
          {seccionesVisibles.map((s) => (
            <Chip key={s.id} activo={seccion === s.id} onClick={() => onSeccion(seccion === s.id ? "" : s.id)} cantidad={conteos.porSeccion[s.id] ?? 0}>
              {s.etiqueta}
            </Chip>
          ))}
        </ChipsFila>
      }
      filtros={
        <BotonFiltros contador={filtrosActivos} hayFiltros={hayFiltros} onLimpiar={onLimpiar}>
          <Interruptor checked={incluirInactivos} onChange={onIncluirInactivos}>
            Mostrar desactivados
          </Interruptor>
          <Interruptor checked={modoConsulta} onChange={onModoConsulta}>
            Modo consulta rápida
          </Interruptor>
        </BotonFiltros>
      }
    />
  );
}
