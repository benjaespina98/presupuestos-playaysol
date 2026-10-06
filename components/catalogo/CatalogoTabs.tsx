"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECCIONES = [
  { href: "/dashboard/catalogo", etiqueta: "Precios de venta", exacto: true },
  { href: "/dashboard/catalogo/materiales", etiqueta: "Materiales" },
  { href: "/dashboard/catalogo/proveedores", etiqueta: "Proveedores" },
  { href: "/dashboard/catalogo/pedido", etiqueta: "Armar pedido" },
  { href: "/dashboard/catalogo/pedidos", etiqueta: "Pedidos" },
] as const;

/**
 * Las secciones del catálogo. Cada una es su propia ruta (se puede entrar
 * directo y el botón "atrás" funciona), no un estado interno de la pantalla.
 */
export function CatalogoTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones del catálogo" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-0">
      <ul className="flex gap-1 border-b border-gray-200">
        {SECCIONES.map((s) => {
          const activa = "exacto" in s && s.exacto
              ? pathname === s.href
              : // Con "/" al final: /pedido no puede dar por activa a /pedidos (ni al revés).
                pathname === s.href || pathname.startsWith(`${s.href}/`);
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                aria-current={activa ? "page" : undefined}
                className={`-mb-px inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-4 text-sm font-medium transition-colors ${
                  activa
                    ? "border-[#1B3A5C] text-[#1B3A5C]"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800"
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
