import { CatalogoTabs } from "@/components/catalogo/CatalogoTabs";
import { VolverArriba } from "@/components/catalogo/VolverArriba";

/**
 * Marco común de las secciones del catálogo: las pestañas de Compras arriba (Precios no lleva) y, abajo, la
 * pantalla de cada sección (que arma su propio ancho).
 */
export default function CatalogoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mx-auto max-w-7xl px-4">
        <CatalogoTabs />
      </div>
      {children}
      <VolverArriba />
    </>
  );
}
