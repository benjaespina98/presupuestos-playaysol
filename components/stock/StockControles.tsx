"use client";

import { useState } from "react";
import { llevaStock, stockNegativo, textoStock, type ItemCatalogo } from "@/lib/domain/catalogo/item";
import type { ResultadoStock } from "@/lib/domain/stock/movimientos";
import { botonDe } from "@/components/ui/botones";
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
    <span className="inline-flex items-center gap-2 md:flex-col md:gap-0.5">
      <span
        title={negativo ? `stock negativo: ${item.stock}` : textoStock(item.stock)}
        className={`inline-flex min-w-[3rem] justify-center rounded-full px-3 py-1 text-base font-bold tabular-nums ring-1 ring-inset ${
          sinUnidades ? "bg-red-50 text-red-700 ring-red-200" : "bg-green-50 text-green-700 ring-green-200"
        }`}
      >
        {negativo ? `−${Math.abs(item.stock)}` : item.stock}
      </span>
      {!negativo && <span className="text-xs text-gray-500 md:sr-only">en stock</span>}
      {negativo && (
        <span role="status" className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700">
          <span aria-hidden="true">⚠</span> Stock negativo
        </span>
      )}
    </span>
  );

  if (!editable) return numero;

  // Ingreso y Venta son las acciones del día a día: botones con borde. Ajustar conteo e Historial
  // son de apoyo (fondo suave). En el celular quedan en una grilla de 2x2, así nada se parte ni
  // deja un botón solo; en pantallas anchas van todos en una sola fila.
  const principal = botonDe("secundario", "w-full md:w-auto md:px-3");
  const apoyo = botonDe("suave", "w-full font-medium md:w-auto md:px-2.5");

  return (
    <div className="flex flex-col gap-2 md:flex-row md:flex-nowrap md:items-center md:justify-center md:gap-1.5">
      {numero}
      <div className="grid grid-cols-2 gap-2 md:contents">
        <button type="button" aria-label={`Ingreso de ${nombre}`} onClick={() => setDialogo("ingreso")} className={principal}>
          Ingreso
        </button>
        <button type="button" aria-label={`Venta de ${nombre}`} onClick={() => setDialogo("venta")} className={principal}>
          Venta
        </button>
        <button type="button" aria-label={`Ajustar conteo de ${nombre}`} onClick={() => setDialogo("ajuste")} className={apoyo}>
          Ajustar conteo
        </button>
        <button type="button" aria-label={`Historial de stock de ${nombre}`} onClick={() => setDialogo("historial")} className={apoyo}>
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
