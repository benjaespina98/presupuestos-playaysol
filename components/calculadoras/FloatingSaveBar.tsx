"use client";

import { IconCloudUpload } from "@/components/icons";
import { SoloSiNoAnulado } from "@/components/Anulado";

/**
 * Barra de "Guardar" al pie, sólo en celular (`sm:hidden`). Sin esto, guardar un presupuesto largo obliga a scrollear TODO
 * el formulario hasta el final.
 *
 * Es `sticky` (pegada al borde de abajo mientras se desliza la página), NO `fixed`: en el iPhone, después de usar el
 * teclado, una barra `fixed` se quedaba a mitad de pantalla y el scroll se veía roto. Una barra `sticky` es parte del
 * scroll de la página y no depende del alto "visible" que informa el navegador.
 *
 * Va FUERA del <form> (a continuación) y apunta a él con `form={formId}`: así su contenedor es toda la pantalla y no la
 * grilla del formulario (que acotaría dónde puede pegarse). Delega en el mismo `handleSubmit` que el "Guardar" de siempre:
 * no agrega un segundo camino de guardado que mantener.
 */
export function FloatingSaveBar({ guardando, label = "Guardar en la nube", formId }: { guardando: boolean; label?: string; formId: string }) {
  return (
    <SoloSiNoAnulado>
    <div
      className="sticky bottom-0 z-40 -mx-4 -mt-20 border-t border-gray-200 bg-[#FFFFFF] px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] sm:hidden print:hidden"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <button
        type="submit"
        form={formId}
        disabled={guardando}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#244B5A] px-4 text-sm font-semibold text-[#FFFFFF] transition-colors hover:bg-marca-oscuro disabled:cursor-not-allowed disabled:opacity-50"
      >
        <IconCloudUpload className="h-4 w-4" />
        {guardando ? "Guardando..." : label}
      </button>
    </div>
    </SoloSiNoAnulado>
  );
}
