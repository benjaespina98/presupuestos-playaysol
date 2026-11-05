import { PresupuestosTabs } from "@/components/PresupuestosTabs";

/** Nuevo presupuesto: las pestañas de Presupuestos arriba y la pantalla abajo. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PresupuestosTabs />
      {children}
    </>
  );
}
