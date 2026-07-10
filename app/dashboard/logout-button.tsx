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
      className="rounded-md border border-[#1B3A5C]/30 px-3 py-2 text-sm text-[#1B3A5C] hover:bg-[#1B3A5C]/5"
    >
      Cerrar sesión
    </button>
  );
}
