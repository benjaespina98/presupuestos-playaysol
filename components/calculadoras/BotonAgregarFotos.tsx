"use client";

/**
 * "Agregar fotos": reemplaza al selector de archivos del navegador ("Choose Files / No file chosen", en inglés y
 * según el idioma del equipo). Es un botón de 48 px; el <input> real queda oculto dentro de la etiqueta.
 */
export function BotonAgregarFotos({ onElegir, ocupado }: { onElegir: (archivos: FileList | null) => void; ocupado: boolean }) {
  return (
    <label
      className={`inline-flex min-h-12 items-center justify-center rounded-md bg-[#244B5A] px-5 text-base font-semibold text-[#FFFFFF] transition-colors hover:bg-marca-oscuro has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#244B5A] ${
        ocupado ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      }`}
    >
      {ocupado ? "Subiendo..." : "Agregar fotos"}
      <input
        type="file"
        accept="image/*"
        multiple
        disabled={ocupado}
        className="sr-only"
        onChange={(e) => {
          onElegir(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );
}
