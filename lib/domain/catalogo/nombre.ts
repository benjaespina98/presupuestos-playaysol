import { normalizarTexto } from "@/lib/texto";

/**
 * El nombre de una fila sin repetir el título del bloque donde está: dentro de "Revestimientos", el producto
 * "Revestimientos - Cerámico Simil Piedra Bali" se lee "Cerámico Simil Piedra Bali". Sólo se saca un comienzo que
 * coincide con el título (sin importar mayúsculas, tildes ni singular/plural) y que sigue con un separador ("-", ":" o "·"); sin separador no se toca ("Cerco perimetral" queda igual).
 * Es sólo para mostrar: el nombre guardado no cambia, y si no queda nada se devuelve el original.
 */
export function sinTituloRepetido(nombre: string, ...titulos: (string | null | undefined)[]): string {
  const base = (s: string) => normalizarTexto(s).replace(/s\b/g, "");
  const texto = nombre.trimStart();
  for (const titulo of titulos) {
    const t = titulo?.trim();
    if (!t) continue;
    for (let largo = t.length + 1; largo >= Math.max(1, t.length - 1); largo--) {
      if (largo >= texto.length || base(texto.slice(0, largo)) !== base(t)) continue;
      const resto = texto.slice(largo);
      if (!/^\s*[-–—:·]\s*\S/.test(resto)) continue;
      const limpio = resto.replace(/^\s*[-–—:·,]?\s*/, "");
      return limpio.charAt(0).toUpperCase() + limpio.slice(1);
    }
  }
  return nombre;
}
