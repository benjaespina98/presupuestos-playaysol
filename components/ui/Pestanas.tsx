"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface Pestana {
  href: string;
  etiqueta: string;
}

/**
 * Las pestañas de una sección (Presupuestos, Compras). Cada una es su propia ruta: se puede entrar directo y el botón
 * "atrás" funciona. En el celular son columnas del mismo ancho (un texto largo hace salto de línea): NUNCA quedan
 * cortadas ni hay que deslizarlas. Desde `md`, pestañas en línea.
 */
export function Pestanas({ etiqueta, pestanas, columnas }: { etiqueta: string; pestanas: readonly Pestana[]; columnas: "grid-cols-2" | "grid-cols-4" }) {
  const pathname = usePathname();

  return (
    <nav aria-label={etiqueta}>
      <ul className={`grid ${columnas} border-b border-[#D9DFE3] md:flex md:gap-1`}>
        {pestanas.map((p) => {
          // Con "/" al final: /pedido no puede dar por activa a /pedidos (ni al revés).
          // Si otra pestaña calza mejor (/stock/movimientos frente a /stock), gana la más específica.
          const calza = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
          const activa = calza(p.href) && !pestanas.some((o) => o.href.length > p.href.length && calza(o.href));
          return (
            <li key={p.href} className="min-w-0">
              <Link
                href={p.href}
                aria-current={activa ? "page" : undefined}
                className={`-mb-px flex min-h-11 items-center justify-center border-b-[3px] px-1 text-center text-[13px] leading-tight transition-colors md:inline-flex md:px-4 md:text-sm ${
                  activa
                    ? "border-[#244B5A] font-semibold text-[#244B5A]"
                    : "border-transparent font-medium text-[#4A5861] hover:border-[#7D8892] hover:text-[#1F2A30]"
                }`}
              >
                {p.etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
