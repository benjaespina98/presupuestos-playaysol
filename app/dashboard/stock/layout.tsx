import { StockTabs } from "@/components/stock/StockTabs";

/** Stock: las pestañas (Stock · Movimientos) arriba y la pantalla abajo. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StockTabs />
      {children}
    </>
  );
}
