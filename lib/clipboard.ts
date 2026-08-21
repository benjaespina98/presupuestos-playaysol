/**
 * Envoltorio de `navigator.clipboard.writeText`. Existe como módulo aparte
 * (no una llamada directa desde el componente) para poder mockearlo en tests
 * con `vi.mock("@/lib/clipboard", ...)` — mismo patrón que el resto de la app
 * usa para todo lo que toca una API del navegador/Supabase — en vez de tener
 * que parchear `navigator.clipboard` a mano en cada test, que en jsdom es una
 * propiedad de sólo lectura en el prototipo de `Navigator` y no siempre se
 * puede reemplazar de forma confiable.
 */
export async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // Sin permiso de portapapeles (poco común, pero pasa en algunos
    // navegadores/contextos http): no hay una API estándar para reintentar,
    // así que se informa `false` y quien llama decide qué mostrar.
    return false;
  }
}
