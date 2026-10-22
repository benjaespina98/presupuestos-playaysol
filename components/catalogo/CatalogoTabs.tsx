"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** "Precios" (lo que se le cobra al cliente) y "Compras" (lo que se le compra a los proveedores): dos secciones del menú. */
const PRECIOS = [{ href: "/dashboard/catalogo", etiqueta: "Precios de venta", exacto: true }] as const;
const COMPRAS = [
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
  const nav = useRef<HTMLElement>(null);
  const SECCIONES = pathname === "/dashboard/catalogo" ? PRECIOS : COMPRAS;

  // En el celular las pestañas no entran todas: la activa se acerca al centro para que no quede oculta.
  useEffect(() => {
    const activa = nav.current?.querySelector<HTMLElement>('[aria-current="page"]');
    activa?.scrollIntoView?.({ inline: "center", block: "nearest" });
  }, [pathname]);

  return (
    <nav ref={nav} aria-label={pathname === "/dashboard/catalogo" ? "Precios" : "Secciones de compras"} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [mask-image:linear-gradient(to_right,#000_calc(100%-32px),transparent)] md:mx-0 md:px-0 md:[mask-image:none] [&::-webkit-scrollbar]:hidden">
      <ul className="flex gap-1 border-b border-[#D9DFE3] pr-8 md:pr-0">
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
                    ? "border-[#244B5A] text-[#244B5A]"
                    : "border-transparent text-[#4A5861] hover:border-[#7D8892] hover:text-[#1F2A30]"
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
