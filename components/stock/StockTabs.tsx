import { Pestanas } from "@/components/ui/Pestanas";

const PESTANAS = [
  { href: "/dashboard/stock", etiqueta: "Stock" },
  { href: "/dashboard/stock/movimientos", etiqueta: "Movimientos" },
] as const;

/** Las pestañas de Stock: lo que hay ahora y el registro de lo que pasó (quién, cuándo, cuánto). */
export function StockTabs() {
  return (
    <div data-print-hide="" className="mx-auto max-w-7xl px-4">
      <Pestanas etiqueta="Secciones de stock" pestanas={PESTANAS} columnas="grid-cols-2" />
    </div>
  );
}
