import { createHash, timingSafeEqual } from "node:crypto";

/**
 * ¿El token que llegó coincide con el esperado? Se compara en tiempo constante
 * (sobre el hash de los dos, así tampoco se filtra el largo del token): una
 * comparación común con `===` tarda distinto según cuántos caracteres
 * coinciden, y eso se puede medir desde afuera.
 */
export function tokenValido(recibido: string, esperado: string): boolean {
  if (!recibido || !esperado) return false;
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(recibido), h(esperado));
}

/** Saca el token de un encabezado `Authorization: Bearer <token>`; "" si no hay. */
export function tokenDeEncabezado(encabezado: string | null): string {
  const m = /^Bearer\s+(.+)$/i.exec((encabezado ?? "").trim());
  return m ? m[1].trim() : "";
}
