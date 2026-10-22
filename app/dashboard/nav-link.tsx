"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Link del menú del portal que marca la sección actual. `exacto` es para
 * "Nuevo" (/dashboard): sin eso quedaría activo en todas las pantallas, porque
 * todas cuelgan de /dashboard. Las calculadoras (/dashboard/piscinas, etc.) son
 * parte de "Nuevo", así que ahí también se marca.
 */
export function NavLink({
  href,
  exacto = false,
  grupo,
  children,
}: {
  href: string;
  exacto?: boolean;
  /** "precios" o "compras": las secciones del antiguo Catálogo (lo que se cobra / lo que se compra). */
  grupo?: "precios" | "compras";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const seccionesPropias = ["/dashboard/historial", "/dashboard/catalogo"];
  const activo = grupo
    ? grupo === "precios"
      ? pathname === "/dashboard/catalogo"
      : /^\/dashboard\/catalogo\/(materiales|proveedores|pedido|pedidos)(\/|$)/.test(pathname)
    : exacto
      ? pathname === href || !seccionesPropias.some((s) => pathname.startsWith(s))
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      className={`-mb-px inline-flex min-h-12 flex-1 items-center justify-center border-b-[3px] px-1 font-semibold transition-colors md:flex-none md:justify-start ${
        activo ? "border-acento text-marca" : "border-transparent text-[#4A5861] hover:border-[#9DB0B8] hover:text-marca"
      }`}
    >
      {children}
    </Link>
  );
}
