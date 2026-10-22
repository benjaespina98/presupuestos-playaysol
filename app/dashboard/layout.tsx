import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { LOGO_URL } from "@/lib/brand";
import { Wordmark } from "@/components/Wordmark";
import MenuUsuario from "./menu-usuario";
import { NavLink } from "./nav-link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="relative min-h-dvh bg-gray-50">
      <div
        aria-hidden="true"
        data-print-hide=""
        className="pointer-events-none fixed inset-0 z-0 bg-center bg-no-repeat opacity-[0.04]"
        style={{ backgroundImage: `url(${LOGO_URL})`, backgroundSize: "480px" }}
      />
      <div className="relative z-10">
        {/* Celular: el logo y el menú de usuario arriba (52 px) y, debajo, las cuatro secciones en una fila de 48 px
            que reparte el ancho. Desde md, todo en una sola fila. */}
        <header data-print-hide="" className="border-b border-[#244B5A]/15 bg-[#FFFFFF]">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-x-3 px-4 md:flex-nowrap md:gap-x-6">
            <Link href="/dashboard" className="flex h-[3.25rem] items-center md:h-14">
              <Wordmark className="h-6 sm:h-7" />
            </Link>
            {/* "Precios" es lo que se le cobra al cliente; "Compras" es lo que se le compra a los proveedores. */}
            <nav aria-label="Secciones del portal" className="order-3 flex w-full items-stretch text-[15px] md:order-none md:ml-2 md:w-auto md:flex-1 md:gap-5">
              <NavLink href="/dashboard" exacto>
                Nuevo
              </NavLink>
              <NavLink href="/dashboard/historial">Historial</NavLink>
              <NavLink href="/dashboard/catalogo" grupo="precios">
                Precios
              </NavLink>
              <NavLink href="/dashboard/catalogo/materiales" grupo="compras">
                Compras
              </NavLink>
            </nav>
            <MenuUsuario email={user.email ?? "usuario"} />
          </div>
        </header>
        {/* Sin ancho máximo ni padding acá: las calculadoras necesitan todo el
            ancho disponible para poner el formulario y el documento lado a lado
            (antes quedaban embutidas en 1024px y el documento salía apretado).
            Las pantallas que sí quieren una columna angosta —selección de
            calculadora, historial— la piden con <PanelPortal>. */}
        <main id="dashboard-main">{children}</main>
      </div>
    </div>
  );
}
