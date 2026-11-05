"use client";

import { usePathname } from "next/navigation";
import { Pestanas } from "@/components/ui/Pestanas";

/** Las secciones de "Compras" (lo que se le compra a los proveedores). "Precios" es una sola pantalla: no lleva pestañas. */
const COMPRAS = [
  { href: "/dashboard/catalogo/materiales", etiqueta: "Materiales" },
  { href: "/dashboard/catalogo/proveedores", etiqueta: "Proveedores" },
  { href: "/dashboard/catalogo/pedido", etiqueta: "Armar pedido" },
  { href: "/dashboard/catalogo/pedidos", etiqueta: "Pedidos" },
] as const;

/** Las pestañas de Compras. */
export function CatalogoTabs() {
  const pathname = usePathname();
  if (pathname === "/dashboard/catalogo" || pathname.startsWith("/dashboard/catalogo/actualizar-precios")) return null;

  return <Pestanas etiqueta="Secciones de compras" pestanas={COMPRAS} columnas="grid-cols-4" />;
}
