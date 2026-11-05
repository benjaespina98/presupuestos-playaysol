import { Pestanas } from "@/components/ui/Pestanas";

const PESTANAS = [
  { href: "/dashboard/nuevo", etiqueta: "Nuevo" },
  { href: "/dashboard/historial", etiqueta: "Historial" },
] as const;

/** Las pestañas de Presupuestos: crear uno o buscar uno ya hecho. */
export function PresupuestosTabs() {
  return (
    <div data-print-hide="" className="mx-auto max-w-7xl px-4">
      <Pestanas etiqueta="Secciones de presupuestos" pestanas={PESTANAS} columnas="grid-cols-2" />
    </div>
  );
}
