"use client";

import { useState } from "react";
import { llevaStock, stockNegativo, textoStock, type ItemCatalogo } from "@/lib/domain/catalogo/item";
import type { ResultadoStock } from "@/lib/domain/stock/movimientos";
import { DialogoAjuste } from "./DialogoAjuste";
import { DialogoMovimiento } from "./DialogoMovimiento";
import { HistorialStock } from "./HistorialStock";

type Dialogo = "ingreso" | "venta" | "ajuste" | "historial" | null;

/**
 * El stock de un ítem en la lista del catálogo.
 *
 * Los que no llevan stock (hierros, luces, cercos, hormigón…) dicen "A pedido" y
 * NO tienen controles ni historial. Los que sí, muestran las unidades y, si se
 * puede editar, tres acciones —Ingreso, Venta y Ajustar conteo— más el
 * historial. Cada una abre un diálogo; el número nunca se edita directo.
 * Un stock negativo se ve en rojo con una marca de aviso.
 */
export function StockControles({
  item,
  editable,
  onResultado,
}: {
  item: ItemCatalogo;
  editable: boolean;
  /** Una operación terminó bien: el padre actualiza el stock de la lista y avisa. */
  onResultado: (item: ItemCatalogo, resultado: ResultadoStock) => void;
}) {
  const [dialogo, setDialogo] = useState<Dialogo>(null);

  if (!llevaStock(item)) return <span className="text-xs text-gray-400">A pedido</span>;

  const nombre = item.descripcion || item.clave;
  const negativo = stockNegativo(item);
  const sinUnidades = item.stock <= 0;

  const numero = (
    <span className="inline-flex flex-col items-center gap-0.5">
      <span
        title={negativo ? `stock negativo: ${item.stock}` : textoStock(item.stock)}
        className={`inline-flex min-w-[2.75rem] justify-center rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums ${
          sinUnidades ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
        }`}
      >
        {negativo ? `−${Math.abs(item.stock)}` : item.stock}
      </span>
      {negativo && (
        <span role="status" className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700">
          <span aria-hidden="true">⚠</span> Stock negativo
        </span>
      )}
    </span>
  );

  if (!editable) return numero;

  const boton =
    "inline-flex min-h-11 items-center justify-center rounded-md border border-gray-200 px-2.5 text-sm font-medium text-[#1B3A5C] hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1B3A5C]";

  return (
    <div className="flex flex-wrap items-center gap-1.5 md:justify-center">
      {numero}
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" aria-label={`Ingreso de ${nombre}`} onClick={() => setDialogo("ingreso")} className={boton}>
          Ingreso
        </button>
        <button type="button" aria-label={`Venta de ${nombre}`} onClick={() => setDialogo("venta")} className={boton}>
          Venta
        </button>
        <button type="button" aria-label={`Ajustar conteo de ${nombre}`} onClick={() => setDialogo("ajuste")} className={boton}>
          Ajustar conteo
        </button>
        <button type="button" aria-label={`Historial de stock de ${nombre}`} onClick={() => setDialogo("historial")} className={boton}>
          Historial
        </button>
      </div>

      {(dialogo === "ingreso" || dialogo === "venta") && (
        <DialogoMovimiento
          tipo={dialogo}
          itemId={item.id}
          nombre={nombre}
          stockActual={item.stock}
          onCerrar={() => setDialogo(null)}
          onHecho={(r) => {
            setDialogo(null);
            onResultado(item, r);
          }}
        />
      )}
      {dialogo === "ajuste" && (
        <DialogoAjuste
          itemId={item.id}
          nombre={nombre}
          stockActual={item.stock}
          onCerrar={() => setDialogo(null)}
          onHecho={(r) => {
            setDialogo(null);
            onResultado(item, r);
          }}
        />
      )}
      {dialogo === "historial" && (
        <HistorialStock
          itemId={item.id}
          nombre={nombre}
          onCerrar={() => setDialogo(null)}
          onStockCambiado={(r) => onResultado(item, r)}
        />
      )}
    </div>
  );
}
