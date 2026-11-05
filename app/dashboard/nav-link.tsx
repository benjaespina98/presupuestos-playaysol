"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { seccionDeRuta, type SeccionPortal } from "@/lib/navegacion";

/** Link del menú del portal que marca la sección actual. */
export function NavLink({
  href,
  seccion,
  children,
}: {
  href: string;
  seccion: SeccionPortal;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const activo = seccionDeRuta(pathname) === seccion;

  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      className={`-mb-px inline-flex min-h-12 flex-1 items-center justify-center border-b-2 px-1 font-medium transition-colors md:flex-none md:justify-start ${
        activo ? "border-acento font-semibold text-marca" : "border-transparent text-[#4A5861] hover:border-[#9DB0B8] hover:text-marca"
      }`}
    >
      {children}
    </Link>
  );
}
