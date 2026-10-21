/**
 * Estilos de botón del portal. Un solo lugar para que "primario", "secundario" y
 * "suave" se vean igual en todas las pantallas. Son strings de clases de
 * Tailwind: se usan como `className={`${boton.base} ${boton.primario}`}`.
 *
 * Todos miden al menos 44 px de alto (zona táctil cómoda en el celular) y tienen
 * hover, estado activo y foco visible (el anillo de foco global está en globals.css).
 */
const base =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition-colors select-none disabled:opacity-50";

export const boton = {
  base,
  /** La acción principal de una pantalla o de una fila: relleno de marca. */
  primario: "bg-marca text-white shadow-sm hover:bg-marca-oscuro active:bg-marca-oscuro",
  /** Acción importante pero no principal: borde marcado y fondo blanco. */
  secundario:
    "border border-marca/40 bg-white text-marca shadow-sm hover:border-marca hover:bg-marca/5 active:bg-marca/10",
  /** Acción de apoyo: sin borde, con un fondo suave para que se note que se toca. */
  suave: "bg-marca/8 text-marca hover:bg-marca/15 active:bg-marca/20",
  /** Acción destructiva (anular, desactivar). */
  peligro: "border border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50 active:bg-red-100",
} as const;

/** Atajo: base + variante. */
export const botonDe = (variante: Exclude<keyof typeof boton, "base">, extra = "") =>
  `${boton.base} ${boton[variante]}${extra ? ` ${extra}` : ""}`;
