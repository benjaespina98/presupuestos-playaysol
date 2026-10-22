/**
 * Estilos de botón del portal. Un solo lugar para que "primario", "secundario", "suave" y "peligro" se vean
 * igual en todas las pantallas. Son strings de clases de Tailwind: `className={botonDe("primario", "px-4")}`.
 *
 * Los colores van como valores fijos (hex), NO como variables de tema ni con opacidad (`bg-marca/8` se resuelve
 * con `color-mix`, que los Safari viejos no entienden y dejan el fondo transparente: texto blanco sobre blanco).
 * Tokens (todos con contraste de texto de al menos 4,5:1):
 *   primario      azul petróleo #244B5A con texto blanco (11,6:1)
 *   secundario    borde #244B5A, fondo blanco y texto #1A3844
 *   deshabilitado gris medio #D9DFE3 con texto #3E4A52 (legible, nunca blanco sobre blanco)
 *   destructivo   rojo #B42318 (con texto blanco, o borde y texto sobre blanco)
 *
 * Todos miden al menos 44 px de alto (48 px dentro de las hojas) y tienen hover, estado activo y foco visible
 * (el anillo de foco global está en globals.css).
 */
const base =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3.5 text-base font-semibold transition-colors select-none disabled:cursor-not-allowed sm:text-sm";

export const boton = {
  base,
  /** La acción principal de una pantalla o de una fila: relleno de marca. */
  primario:
    "bg-[#244B5A] text-[#FFFFFF] shadow-sm hover:bg-[#1A3844] active:bg-[#12293A] disabled:bg-[#D9DFE3] disabled:text-[#3E4A52] disabled:shadow-none",
  /** Acción importante pero no principal: borde marcado y fondo blanco. */
  secundario:
    "border border-[#244B5A] bg-[#FFFFFF] text-[#1A3844] shadow-sm hover:bg-[#EAF0F2] active:bg-[#D5E0E4] disabled:border-[#8B969E] disabled:bg-[#EEF1F3] disabled:text-[#3E4A52] disabled:shadow-none",
  /** Acción de apoyo: sin borde, con un fondo suave para que se note que se toca. */
  suave:
    "bg-[#E3ECEF] text-[#1A3844] hover:bg-[#D3E1E6] active:bg-[#C2D4DB] disabled:bg-[#EEF1F3] disabled:text-[#3E4A52]",
  /** Acción destructiva (anular, desactivar): borde y texto rojo sobre blanco. */
  peligro:
    "border border-[#B42318] bg-[#FFFFFF] text-[#B42318] hover:bg-[#FEF3F2] active:bg-[#FEE4E2] disabled:border-[#8B969E] disabled:bg-[#EEF1F3] disabled:text-[#3E4A52]",
  /** Confirmar una acción destructiva: relleno rojo con texto blanco. */
  peligroLleno:
    "bg-[#B42318] text-[#FFFFFF] shadow-sm hover:bg-[#912018] active:bg-[#7A1A13] disabled:bg-[#D9DFE3] disabled:text-[#3E4A52] disabled:shadow-none",
} as const;

/** Atajo: base + variante. */
export const botonDe = (variante: Exclude<keyof typeof boton, "base">, extra = "") =>
  `${boton.base} ${boton[variante]}${extra ? ` ${extra}` : ""}`;

/** El botón de lápiz de las filas de una lista: 44×44, borde sutil, hover, foco y estado activo. */
export const BOTON_LAPIZ =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#8B969E] bg-[#FFFFFF] text-[#244B5A] transition-colors hover:border-[#244B5A] hover:bg-[#EAF0F2] active:bg-[#D5E0E4]";
