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

/** Un token legítimo mide decenas de caracteres; un encabezado enorme es un ataque, no se procesa. */
export const LARGO_MAXIMO_ENCABEZADO = 1024;

/** Saca el token de un encabezado `Authorization: Bearer <token>`; "" si no hay (o si es absurdamente largo). */
export function tokenDeEncabezado(encabezado: string | null): string {
  if ((encabezado ?? "").length > LARGO_MAXIMO_ENCABEZADO) return "";
  const m = /^Bearer\s+(.+)$/i.exec((encabezado ?? "").trim());
  return m ? m[1].trim() : "";
}
