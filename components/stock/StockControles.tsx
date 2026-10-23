"use client";

import { useState } from "react";
import { llevaStock, stockNegativo, textoStock, type ItemCatalogo } from "@/lib/domain/catalogo/item";
import type { ResultadoStock } from "@/lib/domain/stock/movimientos";
import { botonDe } from "@/components/ui/botones";
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
 *    llevan stock (hierros, luces, cercos, hormigón…) dicen "A pedido".
 *  - `AccionesStock`: "Venta" (la acción del día a día) y el menú "…" con Ingreso, Ajustar conteo e Historial.
 *  - `DialogosStock`: el diálogo que esté abierto. El número nunca se edita directo.
 */
export function StockNumero({ item }: { item: ItemCatalogo }) {
  if (!llevaStock(item)) return <span className="whitespace-nowrap text-[13px] text-[#4A5861]">A pedido</span>;
  const negativo = stockNegativo(item);
  const sinUnidades = item.stock <= 0;
  return (
    <span
      title={negativo ? `stock negativo: ${item.stock}` : textoStock(item.stock)}
      className={`inline-flex min-w-[2rem] items-center justify-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[13px] font-semibold tabular-nums ring-1 ring-inset ${
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

export function AccionesStock({ item, onAbrir }: { item: ItemCatalogo; onAbrir: (d: Exclude<DialogoStock, null>) => void }) {
  if (!llevaStock(item)) return null;
  const nombre = item.descripcion || item.clave;
  return (
    <>
      <button type="button" aria-label={`Venta de ${nombre}`} onClick={() => onAbrir("venta")} className={botonDe("suave", "min-w-[4.5rem] px-3 font-semibold")}>
        Venta
      </button>
      <MenuAcciones
        etiqueta={`Más acciones de ${nombre}`}
        acciones={[
          { etiqueta: "Ingreso", onClick: () => onAbrir("ingreso") },
          { etiqueta: "Ajustar conteo", onClick: () => onAbrir("ajuste") },
          { etiqueta: "Historial", onClick: () => onAbrir("historial") },
        ]}
      />
    </>
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
  const nombre = item.descripcion || item.clave;
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
      <StockNumero item={item} />
      {editable && <AccionesStock item={item} onAbrir={setDialogo} />}
      <DialogosStock item={item} dialogo={dialogo} onCerrar={() => setDialogo(null)} onResultado={onResultado} />
    </div>
  );
}
