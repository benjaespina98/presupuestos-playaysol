"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="min-h-9 rounded-md border border-[#244B5A]/30 px-3 text-sm text-[#244B5A] hover:bg-[#244B5A]/5"
    >
      Cerrar sesión
    </button>
  );
}
