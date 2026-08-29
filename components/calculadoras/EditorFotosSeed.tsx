"use client";

import type { FotoSeed } from "@/lib/documentos/fotosSeed";
import type { EditorFotosSeed as EditorFotosSeedHook } from "@/lib/documentos/useEditorFotosSeed";

/**
 * Un grupo de fotos precargadas de catálogo (ver `useEditorFotosSeed`) con
 * "quitar"/"agregar" — la foto de catálogo que se saca no desaparece de la
 * grilla, se ve tachada con un botón para deshacer, así el vendedor puede
 * arrepentirse sin tener que recordar cuál era.
 */
export function EditorFotosSeed({
  clave,
  etiqueta,
  base,
  editor,
}: {
  clave: string;
  etiqueta: string;
  base: FotoSeed[];
  editor: EditorFotosSeedHook;
}) {
  const { excluidas, agregadas } = editor.grupo(clave);
  if (!base.length && !agregadas.length) return null;

  return (
    <div className="space-y-2 rounded-md border border-gray-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-700">{etiqueta}</span>
        <label className="min-h-8 cursor-pointer rounded px-2 py-1 text-xs font-medium text-[#1B3A5C] hover:bg-[#1B3A5C]/5">
          + Agregar
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={editor.subiendo}
            className="hidden"
            onChange={(e) => {
              editor.agregar(clave, e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {base.map((f) => {
          const sacada = excluidas.has(f.url);
          return (
            <div key={f.url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- foto de catálogo (public/seeds) */}
              <img src={f.url} alt="" className={`aspect-square w-full rounded object-cover ${sacada ? "opacity-25" : ""}`} />
              <button
                type="button"
                onClick={() => (sacada ? editor.restaurar(clave, f.url) : editor.quitar(clave, f.url))}
                title={sacada ? "Volver a incluir esta foto" : "Sacar esta foto de la exportación"}
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 bg-white text-xs font-bold text-[#1B3A5C] shadow-sm hover:bg-gray-50"
              >
                {sacada ? "↺" : "×"}
              </button>
            </div>
          );
        })}
        {agregadas.map((f) => (
          <div key={f.id} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- preview de una foto recién agregada por el usuario */}
            <img src={f.url} alt="" className="aspect-square w-full rounded object-cover ring-2 ring-[#00829C]" />
            <button
              type="button"
              onClick={() => editor.quitarAgregada(clave, f.id)}
              title="Quitar esta foto agregada"
              className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 bg-white text-xs font-bold text-red-600 shadow-sm hover:bg-red-50"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
