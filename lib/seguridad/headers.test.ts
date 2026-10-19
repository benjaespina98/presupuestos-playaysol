import { describe, expect, it } from "vitest";
import { construirCspReportOnly, headersDeSeguridad, origenDe } from "./headers";

const SUPABASE = "https://proyecto-de-prueba.supabase.co";

function valor(headers: { key: string; value: string }[], key: string) {
  return headers.find((h) => h.key === key)?.value;
}

describe("origenDe", () => {
  it("devuelve sólo el origen, sin ruta", () => {
    expect(origenDe(`${SUPABASE}/rest/v1/`)).toBe(SUPABASE);
  });

  it.each([undefined, null, "", "no es una url", "javascript:alert(1)", "ftp://x.com"])("devuelve null para %s", (u) => {
    expect(origenDe(u)).toBeNull();
  });
});

describe("construirCspReportOnly", () => {
  it("toma el dominio de Supabase de la variable, en connect-src e img-src", () => {
    const csp = construirCspReportOnly({ supabaseUrl: SUPABASE });
    expect(csp).toContain(`connect-src 'self' ${SUPABASE}`);
    expect(csp).toContain(`img-src 'self' blob: data: ${SUPABASE}`);
  });

  it("sin variable de Supabase no inventa ningún dominio", () => {
    const csp = construirCspReportOnly({ supabaseUrl: undefined });
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toContain("supabase");
  });

  it("incluye las directivas restrictivas básicas", () => {
    const csp = construirCspReportOnly({ supabaseUrl: SUPABASE });
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("'unsafe-eval' sólo en desarrollo", () => {
    expect(construirCspReportOnly({ esDesarrollo: true })).toContain("'unsafe-eval'");
    expect(construirCspReportOnly({ esDesarrollo: false })).not.toContain("'unsafe-eval'");
  });
});

describe("headersDeSeguridad", () => {
  const headers = headersDeSeguridad({ supabaseUrl: SUPABASE });

  it("pone los headers simples", () => {
    expect(valor(headers, "X-Content-Type-Options")).toBe("nosniff");
    expect(valor(headers, "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(valor(headers, "Strict-Transport-Security")).toMatch(/^max-age=\d+/);
    expect(valor(headers, "Permissions-Policy")).toContain("camera=()");
  });

  it("la CSP que se enforza contiene SOLO frame-ancestors 'none'", () => {
    expect(valor(headers, "Content-Security-Policy")).toBe("frame-ancestors 'none'");
  });

  it("la CSP completa va únicamente como Report-Only", () => {
    const reportOnly = valor(headers, "Content-Security-Policy-Report-Only");
    expect(reportOnly).toContain("default-src 'self'");
    expect(headers.filter((h) => h.key === "Content-Security-Policy")).toHaveLength(1);
  });
});
