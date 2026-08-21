"use client";

import { IconCloudUpload } from "@/components/icons";

/**
 * Barra de "Guardar" fija al pie, sólo en celular (`sm:hidden` — el
 * dispositivo principal del equipo, ver docs/reglas-de-negocio.md). Sin
 * esto, guardar un presupuesto largo (revestimientos con fotos, cercos con
 * varios opcionales) obliga a scrollear TODO el formulario hasta el final
 * — la acción más usada de la pantalla quedaba escondida.
 *
 * `type="submit"` sin `onClick`: sólo funciona si vive dentro del mismo
 * `<form>` que el botón "Guardar" de siempre, delega en el mismo
 * `handleSubmit`. No agrega un segundo camino de guardado que mantener.
 *
 * El formulario que la usa necesita padding-bottom en mobile para que esta
 * barra no tape la última sección (ver `pb-20 sm:pb-0` en cada Calculadora).
 */
export function FloatingSaveBar({ guardando, label = "Guardar en la nube" }: { guardando: boolean; label?: string }) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur sm:hidden"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <button
        type="submit"
        disabled={guardando}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#1B3A5C] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#142c46] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <IconCloudUpload className="h-4 w-4" />
        {guardando ? "Guardando..." : label}
      </button>
    </div>
  );
}
