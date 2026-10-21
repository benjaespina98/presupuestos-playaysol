import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

import * as ruta from "./route";
import { GET, MAX_BYTES_SOLICITUD } from "./route";

const ENV = ["SHEETS_SYNC_TOKEN", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const guardadas: Record<string, string | undefined> = {};
const TOKEN = "token-de-prueba-0123456789";

function pedido(headers: Record<string, string> = {}) {
  return new Request("https://ejemplo.test/api/sheets/catalogo", { headers });
}

describe("/api/sheets/catalogo · seguridad", () => {
  beforeEach(() => {
    for (const k of ENV) guardadas[k] = process.env[k];
    process.env.SHEETS_SYNC_TOKEN = TOKEN;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "clave-de-servicio";
    createClient.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const k of ENV) {
      if (guardadas[k] === undefined) delete process.env[k];
      else process.env[k] = guardadas[k];
    }
  });

  it("sólo exporta GET: POST, PUT, PATCH y DELETE no existen (Next responde 405)", () => {
    for (const metodo of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]) {
      expect(ruta, metodo).not.toHaveProperty(metodo);
    }
    expect(typeof ruta.GET).toBe("function");
  });

  it("no escribe nada en la base: ni insert, ni update, ni upsert, ni delete, ni rpc", () => {
    const src = fs.readFileSync(path.join(__dirname, "route.ts"), "utf8");
    expect(src).not.toMatch(/\.(insert|update|upsert|delete|rpc)\(/);
  });

  it("sin token o con uno equivocado: 401 con un mensaje genérico, sin detalles, y no toca la base", async () => {
    for (const encabezados of [{} as Record<string, string>, { Authorization: "Bearer otro" }, { Authorization: "Basic abc" }, { Authorization: TOKEN }]) {
      const r = await GET(pedido(encabezados));
      expect(r.status).toBe(401);
      expect(await r.json()).toEqual({ error: "No autorizado." });
      expect(r.headers.get("Cache-Control")).toBe("no-store");
    }
    expect(createClient).not.toHaveBeenCalled();
  });

  it("un encabezado Authorization enorme no se procesa: 401", async () => {
    const r = await GET(pedido({ Authorization: `Bearer ${"a".repeat(5000)}` }));
    expect(r.status).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("una solicitud con cuerpo grande se rechaza (413) antes de mirar nada", async () => {
    const r = await GET(pedido({ "content-length": String(MAX_BYTES_SOLICITUD + 1), Authorization: `Bearer ${TOKEN}` }));
    expect(r.status).toBe(413);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("si falta la configuración responde 503 genérico, sin decir qué variable falta", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const r = await GET(pedido({ Authorization: `Bearer ${TOKEN}` }));
    expect(r.status).toBe(503);
    expect(JSON.stringify(await r.json())).not.toMatch(/SUPABASE|SERVICE|TOKEN|variable/i);
  });

  it("no loguea el token ni el contenido de las filas inválidas", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    createClient.mockReturnValue({
      from: (t: string) => ({
        select: () =>
          Promise.resolve({
            data:
              t === "proveedores"
                ? [{ id: "p-9", nombre: "Corralón Secreto SA", telefono: "+54 9 3534 999999", activo: "no-es-boolean" }]
                : t === "catalogo_items"
                  ? [{ id: "i-3", tipo: "piscinas", clave: "luces", precio: "mucho" }]
                  : [],
            error: null,
          }),
      }),
    });

    const r = await GET(pedido({ Authorization: `Bearer ${TOKEN}` }));
    expect(r.status).toBe(200);

    const todo = JSON.stringify(log.mock.calls);
    expect(todo).toContain("p-9");
    expect(todo).toContain("i-3");
    expect(todo).not.toContain("Secreto");
    expect(todo).not.toContain("999999");
    expect(todo).not.toContain(TOKEN);
    expect(todo).not.toContain("clave-de-servicio");
  });

  it("valida los ítems del catálogo con Zod: una fila con la forma mal se omite, el resto sale", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    createClient.mockReturnValue({
      from: (t: string) => ({
        select: () =>
          Promise.resolve({
            data:
              t === "catalogo_items"
                ? [
                    { id: "a", tipo: "piscinas", clave: "luces", precio: 240000, activo: true },
                    { id: "b", tipo: "piscinas", clave: "rota", precio: { raro: true } },
                  ]
                : [],
            error: null,
          }),
      }),
    });
    const cuerpo = await (await GET(pedido({ Authorization: `Bearer ${TOKEN}` }))).json();
    expect(cuerpo.precios).toEqual({ "piscinas:luces": 240000 });
  });

  it("el error de la base se loguea sin el objeto completo", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    createClient.mockReturnValue({
      from: () => ({
        select: () => Promise.resolve({ data: null, error: { code: "42P01", message: "tabla inexistente", details: "fila: Juan Pérez" } }),
      }),
    });
    const r = await GET(pedido({ Authorization: `Bearer ${TOKEN}` }));
    expect(r.status).toBe(502);
    expect(JSON.stringify(log.mock.calls)).not.toContain("Juan");
  });

  it("los desactivados salen en la hoja Catálogo web con Estado 'Desactivado', y no en los precios vigentes", async () => {
    createClient.mockReturnValue({
      from: (t: string) => ({
        select: () =>
          Promise.resolve({
            data:
              t === "catalogo_items"
                ? [
                    { id: "a", tipo: "piscinas", clave: "luces", precio: 240000, activo: true },
                    { id: "b", tipo: "piscinas", clave: "kit_limpieza", precio: 109000, activo: false },
                  ]
                : [],
            error: null,
          }),
      }),
    });
    const cuerpo = await (await GET(pedido({ Authorization: `Bearer ${TOKEN}` }))).json();
    const estados = Object.fromEntries(cuerpo.catalogo.map((f: unknown[]) => [f[1], f[7]]));
    expect(estados).toEqual({ luces: "Activo", kit_limpieza: "Desactivado" });
    expect(cuerpo.precios).toEqual({ "piscinas:luces": 240000 });
  });
});
