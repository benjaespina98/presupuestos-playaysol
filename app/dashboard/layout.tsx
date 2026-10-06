import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { LOGO_URL } from "@/lib/brand";
import { Wordmark } from "@/components/Wordmark";
import LogoutButton from "./logout-button";
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
        <header data-print-hide="" className="border-b border-[#1B3A5C]/15 bg-white">
          {/* Celular: logo y "Cerrar sesión" arriba, y los links debajo en una fila propia. */}
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 sm:py-3">
            <Link href="/dashboard" className="flex items-center gap-3">
              <Wordmark className="h-6 sm:h-7" />
            </Link>
            {/* Este link decía "Presupuestos" pero lleva al historial — y la
                pantalla de inicio también se titulaba "Presupuestos". Dos cosas
                distintas con el mismo nombre. */}
            <nav aria-label="Secciones del portal" className="contents text-sm sm:flex sm:items-center sm:gap-4">
              <div className="order-3 flex w-full items-center gap-6 sm:order-none sm:w-auto sm:gap-4">
              <NavLink href="/dashboard" exacto>
                Nuevo
              </NavLink>
              <NavLink href="/dashboard/historial">Historial</NavLink>
              <NavLink href="/dashboard/catalogo">Catálogo</NavLink>
              </div>
              <span className="hidden text-gray-400 sm:inline">{user.email}</span>
              <LogoutButton />
            </nav>
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
