import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { LOGO_DATA_URI } from "@/lib/brand";
import { Wordmark } from "@/components/Wordmark";
import LogoutButton from "./logout-button";

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
    <div className="relative min-h-screen bg-gray-50">
      <div
        aria-hidden="true"
        data-print-hide=""
        className="pointer-events-none fixed inset-0 z-0 bg-center bg-no-repeat opacity-[0.04]"
        style={{ backgroundImage: `url(${LOGO_DATA_URI})`, backgroundSize: "480px" }}
      />
      <div className="relative z-10">
        <header data-print-hide="" className="border-b border-[#1B3A5C]/15 bg-white">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <Link href="/dashboard" className="flex items-center gap-3">
              <Wordmark className="text-base" />
              <span className="hidden text-sm text-gray-400 sm:inline">
                Presupuestos
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/dashboard"
                className="font-medium text-[#1B3A5C] hover:underline"
              >
                Calculadoras
              </Link>
              <Link
                href="/dashboard/historial"
                className="font-medium text-[#1B3A5C] hover:underline"
              >
                Historial
              </Link>
              <span className="hidden text-gray-400 sm:inline">{user.email}</span>
              <LogoutButton />
            </nav>
          </div>
        </header>
        <main id="dashboard-main" className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </div>
    </div>
  );
}
