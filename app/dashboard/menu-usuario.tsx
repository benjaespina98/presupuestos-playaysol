"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

/**
 * El menú del usuario del encabezado: un círculo de 44 px con la inicial del correo (y el correo, desde `lg`).
 * Adentro, el correo completo y "Cerrar sesión". Reemplaza al botón grande de "Cerrar sesión", que en el
 * celular ocupaba media fila.
 */
export default function MenuUsuario({ email }: { email: string }) {
  const router = useRouter();
  const id = useId();
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [derecha, setDerecha] = useState<number | null>(null);
  const [top, setTop] = useState(0);
  const abierto = derecha !== null;

  const cerrar = useCallback((devolverFoco = false) => {
    setDerecha(null);
    if (devolverFoco) boton.current?.focus();
  }, []);

  function abrir() {
    const r = boton.current?.getBoundingClientRect();
    if (!r) return;
    setTop(r.bottom + 6);
    setDerecha(Math.max(8, window.innerWidth - r.right));
  }

  useEffect(() => {
    if (!abierto) return;
    panel.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    const alTocar = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !boton.current?.contains(e.target as Node)) cerrar();
    };
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar(true);
    };
    document.addEventListener("mousedown", alTocar);
    document.addEventListener("keydown", alTeclear);
    window.addEventListener("resize", cerrar as () => void);
    return () => {
      document.removeEventListener("mousedown", alTocar);
      document.removeEventListener("keydown", alTeclear);
      window.removeEventListener("resize", cerrar as () => void);
    };
  }, [abierto, cerrar]);

  async function cerrarSesion() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const inicial = (email.trim()[0] ?? "?").toUpperCase();

  return (
    <>
      <button
        ref={boton}
        type="button"
        aria-label={`Menú de ${email}`}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? `${id}-menu` : undefined}
        onClick={() => (abierto ? cerrar() : abrir())}
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-[#7D8892] bg-[#FFFFFF] pr-1 text-sm text-[#1F2A30] transition-colors hover:border-[#244B5A] hover:bg-[#EAF0F2] active:bg-[#D5E0E4] lg:pr-3"
      >
        <span aria-hidden="true" className="ml-px flex h-[2.625rem] w-[2.625rem] shrink-0 items-center justify-center rounded-full bg-[#244B5A] text-base font-bold text-[#FFFFFF] lg:h-9 lg:w-9">
          {inicial}
        </span>
        <span className="hidden max-w-[16rem] truncate lg:inline">{email}</span>
      </button>
      {abierto &&
        createPortal(
          <div
            ref={panel}
            id={`${id}-menu`}
            role="menu"
            aria-label="Cuenta"
            style={{ position: "fixed", top, right: derecha ?? 8 }}
            className="z-[60] w-64 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-[#D9DFE3] bg-[#FFFFFF] py-1 shadow-xl"
          >
            <p className="border-b border-[#E3E8EB] px-4 py-2.5 text-[13px] leading-snug text-[#4A5861]">
              Sesión iniciada como
              <span className="block break-all text-sm font-semibold text-[#1F2A30]">{email}</span>
            </p>
            <button
              type="button"
              role="menuitem"
              onClick={cerrarSesion}
              className="flex min-h-12 w-full items-center px-4 text-left text-base font-semibold text-[#B42318] hover:bg-[#FEF3F2] active:bg-[#FEE4E2] focus-visible:bg-[#FEF3F2] focus-visible:outline-none"
            >
              Cerrar sesión
            </button>
          </div>,
          document.body
        )}
    </>
  );
}
