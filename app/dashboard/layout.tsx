import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { LOGO_DATA_URI } from "@/lib/brand";
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
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <img src={LOGO_DATA_URI} alt="Playa y Sol" className="h-9 w-9 rounded" />
              <span className="font-semibold text-[#1B3A5C]">
                Playa y Sol — Presupuestos
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">{user.email}</span>
              <LogoutButton />
            </div>
          </div>
        </header>
        <main id="dashboard-main" className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </div>
    </div>
  );
}
