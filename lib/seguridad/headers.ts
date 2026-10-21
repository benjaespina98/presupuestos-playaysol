/**
 * Headers de seguridad que `next.config.ts` aplica a todas las rutas.
 *
 * Vive acá (y no inline en la config) para poder probarlo. Se importa con ruta
 * relativa: el alias `@/` no existe cuando Next lee `next.config.ts`.
 *
 * Qué se ENFORZA y qué sólo se REPORTA:
 *   - Enforzado: nosniff, Referrer-Policy, Permissions-Policy, HSTS y un CSP que
 *     contiene ÚNICAMENTE `frame-ancestors 'none'` (anti-clickjacking).
 *   - Report-Only: la CSP completa. No bloquea nada; el navegador sólo avisa en
 *     la consola lo que habría bloqueado. Para pasarla a enforce, ver
 *     docs/seguridad-csp.md.
 */

export interface HeaderHttp {
  key: string;
  value: string;
}

export interface OpcionesHeaders {
  /** `NEXT_PUBLIC_SUPABASE_URL`. Si falta o no es una URL, la CSP queda sin el dominio de Supabase. */
  supabaseUrl?: string | null;
  /** En desarrollo React necesita `eval` para reconstruir stacks de error. */
  esDesarrollo?: boolean;
}

/** El origen (esquema + host) de una URL, o null si no es una URL http(s) válida. */
export function origenDe(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin : null;
  } catch {
    return null;
  }
}

/**
 * La CSP completa, pensada para publicarse como Report-Only.
 *
 * `script-src` y `style-src` llevan 'unsafe-inline' porque hoy no hay nonces:
 * Next mete scripts inline para arrancar la hidratación y la CSP estática de
 * `next.config.ts` no puede agregarles un nonce por request. Es la parte más
 * floja de la política; el camino para endurecerla (nonces desde `proxy.ts`)
 * está en docs/seguridad-csp.md.
 */
export function construirCspReportOnly({ supabaseUrl, esDesarrollo = false }: OpcionesHeaders = {}): string {
  const supabase = origenDe(supabaseUrl);
  const conSupabase = (fuentes: string[]) => (supabase ? [...fuentes, supabase] : fuentes);

  const directivas: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(esDesarrollo ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    // blob:/data: para las fotos recién elegidas y los planos que se dibujan en canvas.
    "img-src": conSupabase(["'self'", "blob:", "data:"]),
    "font-src": ["'self'", "data:"],
    // Supabase (REST/Auth/Storage) y la descarga de fotos para armar el Word/PDF.
    "connect-src": conSupabase(["'self'"]),
    // @react-pdf/renderer y la compresión de imágenes pueden usar workers desde blob:.
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  return Object.entries(directivas)
    .map(([nombre, fuentes]) => `${nombre} ${fuentes.join(" ")}`)
    .join("; ");
}

export function headersDeSeguridad(opciones: OpcionesHeaders = {}): HeaderHttp[] {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    },
    // Sin includeSubDomains ni preload a propósito: no se sabe qué otros subdominios hay en el dominio final.
    { key: "Strict-Transport-Security", value: "max-age=31536000" },
    // Enforzado y mínimo: sólo anti-clickjacking.
    { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
    { key: "Content-Security-Policy-Report-Only", value: construirCspReportOnly(opciones) },
  ];
}
