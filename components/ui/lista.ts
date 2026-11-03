/**
 * Las clases de las listas del portal (Precios, Materiales, Proveedores, Pedidos, Actualizar precios), en un solo
 * lugar para que encabezados, grupos y filas midan y se lean igual en todas. Las columnas las pone cada pantalla.
 *
 * Los importes y las cantidades van alineados a la derecha (`COLUMNA_NUMERO`): así se comparan de un vistazo.
 */

export const LISTA = "rounded-lg border border-[#D9DFE3] bg-[#FFFFFF] lg:rounded-none";

/** El encabezado de columnas (sólo desde lg), pegado debajo de la barra de herramientas. */
export const LISTA_ENCABEZADO =
  "hidden h-9 border-b border-[#D9DFE3] bg-[#F1F4F6] px-4 text-[13px] font-semibold uppercase tracking-wide text-[#4A5861] lg:sticky lg:top-[var(--catalogo-barra,0px)] lg:z-10 lg:grid lg:items-center lg:gap-x-4";

/** El título de un bloque (un rubro, un modelo). */
export const LISTA_GRUPO =
  "sticky top-[var(--catalogo-barra,0px)] z-[5] flex h-9 items-center gap-1.5 border-b border-[#D9DFE3] bg-[#F4F8F9] px-4 text-[13px] font-bold uppercase tracking-wide text-[#244B5A]";

/** Una fila que se abre al tocarla: en el celular, flex; desde lg, una fila de la grilla de columnas. */
export const LISTA_FILA =
  "flex min-h-[3.25rem] cursor-pointer items-center gap-3 px-4 py-1 text-sm leading-5 transition-colors hover:bg-[#F4F8F9] active:bg-[#EAF0F2] lg:grid lg:min-h-[3rem] lg:gap-x-4 lg:py-0";

export const LISTA_SEPARADORES = "divide-y divide-[#EEF1F3]";

/** Un importe o una cantidad en su columna. */
export const COLUMNA_NUMERO = "whitespace-nowrap text-right tabular-nums";

/** El texto secundario de una fila (proveedor, detalle, fecha). */
export const TEXTO_SECUNDARIO = "text-[13px] text-[#4A5861]";

/** Campos de texto sueltos, fuera de los formularios de `components/form`. */
export const CLASE_CAMPO =
  "min-h-11 w-full rounded-lg border bg-[#FFFFFF] px-3 py-2 text-base text-[#1F2A30] placeholder:text-[#6B7680] focus:outline-none focus:ring-2 focus:ring-[#244B5A]/20 sm:text-sm";

/** La etiqueta de esos campos. */
export const CLASE_ETIQUETA = "mb-1.5 block text-sm font-medium text-[#3E4A52]";
