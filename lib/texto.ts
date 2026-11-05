/** Para comparar textos como los escribe una persona: sin mayúsculas ni tildes ("Solárium" = "solarium"). */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/**
 * ¿El texto coincide con lo buscado? Cada palabra tiene que aparecer, en cualquier orden: "8x4 hormigon" encuentra
 * "Hormigón 8x4". Una búsqueda vacía coincide con todo.
 */
export function coincideBusqueda(texto: string, busqueda: string): boolean {
  const palabras = normalizarTexto(busqueda).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return true;
  const normalizado = normalizarTexto(texto);
  return palabras.every((p) => normalizado.includes(p));
}
