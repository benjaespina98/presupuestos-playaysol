"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Las secciones de "Compras" (lo que se le compra a los proveedores). "Precios" es una sola pantalla: no lleva pestañas. */
const COMPRAS = [
  { href: "/dashboard/catalogo/materiales", etiqueta: "Materiales" },
  { href: "/dashboard/catalogo/proveedores", etiqueta: "Proveedores" },
  { href: "/dashboard/catalogo/pedido", etiqueta: "Armar pedido" },
  { href: "/dashboard/catalogo/pedidos", etiqueta: "Pedidos" },
] as const;

/**
 * Las pestañas de Compras. Cada una es su propia ruta (se puede entrar directo y el botón "atrás" funciona), no un
 * estado interno de la pantalla. En el celular son cuatro columnas del mismo ancho (el texto largo, "Armar pedido",
 * hace salto de línea): NUNCA quedan cortadas ni hay que deslizarlas. Desde `md`, pestañas en línea.
 */
export function CatalogoTabs() {
  const pathname = usePathname();
  if (pathname === "/dashboard/catalogo" || pathname.startsWith("/dashboard/catalogo/actualizar-precios")) return null;

  return (
    <nav aria-label="Secciones de compras">
      <ul className="grid grid-cols-4 border-b border-[#D9DFE3] md:flex md:gap-1">
        {COMPRAS.map((s) => {
          // Con "/" al final: /pedido no puede dar por activa a /pedidos (ni al revés).
          const activa = pathname === s.href || pathname.startsWith(`${s.href}/`);
          return (
            <li key={s.href} className="min-w-0">
              <Link
                href={s.href}
                aria-current={activa ? "page" : undefined}
                className={`-mb-px flex min-h-11 items-center justify-center border-b-[3px] px-1 text-center text-[13px] leading-tight transition-colors md:inline-flex md:px-4 md:text-sm ${
                  activa
                    ? "border-[#244B5A] font-semibold text-[#244B5A]"
                    : "border-transparent font-medium text-[#4A5861] hover:border-[#7D8892] hover:text-[#1F2A30]"
                }`}
              >
                {s.etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
