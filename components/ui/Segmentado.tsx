/** Elegir una de pocas opciones a la vista ("Losetas / Deck", "Costos / Precios de venta"). */
export function Segmentado<T extends string>({
  etiqueta,
  opciones,
  valor,
  onCambio,
  lleno = false,
  envolver = false,
}: {
  etiqueta: string;
  opciones: readonly { id: T; texto: string }[];
  valor: T;
  onCambio: (v: T) => void;
  /** Reparte todo el ancho disponible, también en pantallas anchas. */
  lleno?: boolean;
  /** Con muchas opciones, hace salto de línea en vez de apretarlas (el texto nunca se corta). */
  envolver?: boolean;
}) {
  return (
    <div role="group" aria-label={etiqueta} className={envolver ? "grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" : "flex gap-2"}>
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={valor === o.id}
          onClick={() => onCambio(o.id)}
          className={`min-h-11 flex-1 rounded-lg border px-3 text-sm font-semibold transition-colors ${lleno ? "" : "sm:flex-none"} ${
            valor === o.id ? "border-[#244B5A] bg-[#244B5A] text-[#FFFFFF]" : "border-[#7D8892] bg-[#FFFFFF] text-[#1F2A30] hover:bg-[#EAF0F2] active:bg-[#D5E0E4]"
          }`}
        >
          {o.texto}
        </button>
      ))}
    </div>
  );
}
