import { CatalogoTabs } from "@/components/catalogo/CatalogoTabs";
import { VolverArriba } from "@/components/catalogo/VolverArriba";

/**
 * Marco común de las secciones del catálogo: las pestañas arriba y, abajo, la
 * pantalla de cada sección (que arma su propio encabezado y su propio ancho).
 */
export default function CatalogoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:pt-6">
        <CatalogoTabs />
      </div>
      {children}
      <VolverArriba />
    </>
  );
}
