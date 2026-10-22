"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { botonDe } from "@/components/ui/botones";

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
      className={botonDe("secundario", "px-3 font-medium")}
    >
      Cerrar sesión
    </button>
  );
}
