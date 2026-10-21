/**
 * Qué se loguea cuando una fila de la base no valida contra su esquema.
 *
 * Antes se volcaba la fila completa a la consola: en el servidor eso termina en
 * los logs de Vercel y en el navegador en la consola de cualquiera, con datos de
 * proveedores (contacto, teléfono) y de obras. Alcanza con saber CUÁL fila
 * (su id) y POR QUÉ no validó (campo + motivo de Zod, que no incluye el valor).
 */

/** El id de una fila, si lo tiene y es un texto o un número; si no, "sin id". */
export function idDeFila(fila: unknown): string {
  if (fila && typeof fila === "object" && "id" in fila) {
    const id = (fila as { id: unknown }).id;
    if (typeof id === "string" || typeof id === "number") return String(id);
  }
  return "sin id";
}

interface ErrorZodMinimo {
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>;
}

/** "campo: motivo; otro.campo: motivo" — sin los valores recibidos. */
export function resumenErrorZod(error: ErrorZodMinimo): string {
  return error.issues.map((i) => `${i.path.map(String).join(".") || "(raíz)"}: ${i.message}`).join("; ");
}

/** El mensaje de log para una fila que no validó: qué fila y qué falló, nada más. */
export function mensajeFilaInvalida(contexto: string, fila: unknown, error: ErrorZodMinimo): string {
  return `${contexto} (id: ${idDeFila(fila)}): ${resumenErrorZod(error)}`;
}
