"use client";

import { useState } from "react";
import { llevaStock, stockNegativo, textoStock, type ItemCatalogo } from "@/lib/domain/catalogo/item";
import { nombreCortoLista } from "@/lib/domain/catalogo/listas";
import type { ResultadoStock } from "@/lib/domain/stock/movimientos";
import { MenuAcciones } from "@/components/ui/MenuAcciones";
import { DialogoAjuste } from "./DialogoAjuste";
import { DialogoMovimiento } from "./DialogoMovimiento";
import { HistorialStock } from "./HistorialStock";

export type DialogoStock = "ingreso" | "venta" | "ajuste" | "historial" | null;

/**
 * El stock de un ítem en la lista del catálogo, en tres piezas que la fila acomoda en su grilla sin hacerse
 * más alta:
 *
 *  - `StockNumero`: el número de unidades (rojo si está en 0, con marca de aviso si es negativo). Los que no
 *    llevan stock (hierros, luces, cercos, hormigón…) no muestran nada: "A pedido" repetido en cada fila no decía nada (queda para los lectores de pantalla).
 *  - `ControlStock`: − número +, siempre a la vista: restar y sumar son lo de todos los días.
 *  - `MenuStock`: el menú "…" con lo menos frecuente: Corregir stock y Ver movimientos.
 *  - `DialogosStock`: el diálogo que esté abierto. El número nunca se edita directo.
 */
export function StockNumero({ item }: { item: ItemCatalogo }) {
  if (!llevaStock(item)) return <span className="sr-only">A pedido</span>;
  const negativo = stockNegativo(item);
  const sinUnidades = item.stock <= 0;
  return (
    <span
      title={negativo ? `stock negativo: ${item.stock}` : textoStock(item.stock)}
      className={`inline-flex min-w-[2rem] items-center justify-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-semibold tabular-nums ring-1 ring-inset ${
        sinUnidades ? "bg-[#FEF3F2] text-[#B42318] ring-[#FDA29B]" : "bg-[#ECFDF3] text-[#05603A] ring-[#75E0A7]"
      }`}
    >
      {negativo && (
        <>
          <span aria-hidden="true">⚠</span>
          <span className="sr-only">Stock negativo</span>
        </>
      )}
      {negativo ? `−${Math.abs(item.stock)}` : item.stock}
      {!negativo && <span className="sr-only"> en stock</span>}
    </span>
  );
}

const CLASE_PASO =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#7D8892] bg-[#FFFFFF] text-xl font-semibold leading-none text-[#244B5A] transition-colors hover:bg-[#EAF0F2] active:bg-[#D5E0E4]";

/** Restar y sumar: cada botón abre su diálogo, con la cantidad en 1. Un toque sin querer al bajar por la lista no mueve el stock. */
export function ControlStock({ item, onAbrir }: { item: ItemCatalogo; onAbrir: (d: Exclude<DialogoStock, null>) => void }) {
  if (!llevaStock(item)) return null;
  const nombre = item.descripcion || item.clave;
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" aria-label={`Restar stock de ${nombre}`} title="Restar stock" onClick={() => onAbrir("venta")} className={CLASE_PASO}>
        <span aria-hidden="true">−</span>
      </button>
      <span className="flex min-w-10 justify-center">
        <StockNumero item={item} />
      </span>
      <button type="button" aria-label={`Sumar stock de ${nombre}`} title="Sumar stock" onClick={() => onAbrir("ingreso")} className={CLASE_PASO}>
        <span aria-hidden="true">+</span>
      </button>
    </span>
  );
}

export function MenuStock({ item, onAbrir }: { item: ItemCatalogo; onAbrir: (d: Exclude<DialogoStock, null>) => void }) {
  if (!llevaStock(item)) return null;
  return (
    <MenuAcciones
      etiqueta={`Más acciones de ${item.descripcion || item.clave}`}
      acciones={[
        { etiqueta: "Corregir stock", onClick: () => onAbrir("ajuste") },
        { etiqueta: "Ver movimientos", onClick: () => onAbrir("historial") },
      ]}
    />
  );
}

export function DialogosStock({
  item,
  dialogo,
  onCerrar,
  onResultado,
}: {
  item: ItemCatalogo;
  dialogo: DialogoStock;
  onCerrar: () => void;
  /** Una operación terminó bien: el padre actualiza el stock de la lista y avisa. */
  onResultado: (item: ItemCatalogo, resultado: ResultadoStock) => void;
}) {
  if (!llevaStock(item) || !dialogo) return null;
  const nombre = nombreCortoLista(item.clave) ?? (item.descripcion || item.clave);
  if (dialogo === "ingreso" || dialogo === "venta") {
    return (
      <DialogoMovimiento
        tipo={dialogo}
        itemId={item.id}
        nombre={nombre}
        stockActual={item.stock}
        onCerrar={onCerrar}
        onHecho={(r) => {
          onCerrar();
          onResultado(item, r);
        }}
      />
    );
  }
  if (dialogo === "ajuste") {
    return (
      <DialogoAjuste
        itemId={item.id}
        nombre={nombre}
        stockActual={item.stock}
        onCerrar={onCerrar}
        onHecho={(r) => {
          onCerrar();
          onResultado(item, r);
        }}
      />
    );
  }
  return <HistorialStock itemId={item.id} nombre={nombre} onCerrar={onCerrar} onStockCambiado={(r) => onResultado(item, r)} />;
}

/** Número + acciones + diálogos juntos, para quien no necesita acomodarlos por separado. */
export function StockControles({
  item,
  editable,
  onResultado,
}: {
  item: ItemCatalogo;
  editable: boolean;
  onResultado: (item: ItemCatalogo, resultado: ResultadoStock) => void;
}) {
  const [dialogo, setDialogo] = useState<DialogoStock>(null);
  return (
    <div className="flex items-center gap-2">
      {!editable && <StockNumero item={item} />}
      {editable && (
        <>
          <ControlStock item={item} onAbrir={setDialogo} />
          <MenuStock item={item} onAbrir={setDialogo} />
        </>
      )}
      <DialogosStock item={item} dialogo={dialogo} onCerrar={() => setDialogo(null)} onResultado={onResultado} />
    </div>
  );
}
