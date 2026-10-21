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
  children,
}: {
  href: string;
  exacto?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const seccionesPropias = ["/dashboard/historial", "/dashboard/catalogo"];
  const activo = exacto
    ? pathname === href || !seccionesPropias.some((s) => pathname.startsWith(s))
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      className={`border-b-2 py-1 font-medium text-[#244B5A] transition-colors hover:border-[#244B5A]/40 ${
        activo ? "border-[#244B5A]" : "border-transparent"
      }`}
    >
      {children}
    </Link>
  );
}
