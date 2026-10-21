import { describe, expect, it } from "vitest";
import { validarUrlLocal } from "../../scripts/test-concurrencia-stock.mjs";

describe("la prueba de concurrencia sólo corre contra la base local de este proyecto", () => {
  it.each(["http://127.0.0.1:54321", "http://localhost:54321", "http://127.0.0.1:54327", "http://localhost:54322/rest/v1"])(
    "acepta %s",
    (url) => {
      expect(validarUrlLocal(url)).toBeNull();
    }
  );

  it.each([
    ["un proyecto de Supabase en la nube", "https://abcdefgh.supabase.co"],
    ["un host remoto con puerto local", "http://192.168.1.50:54321"],
    ["un nombre que empieza como local", "http://localhost.evil.com:54321"],
    ["la base de otro proyecto (puerto 5432)", "http://127.0.0.1:5432"],
    ["otro puerto cualquiera", "http://127.0.0.1:3000"],
    ["un puerto fuera del rango", "http://127.0.0.1:54400"],
    ["sin puerto", "http://127.0.0.1"],
    ["algo que no es una URL", "no-es-una-url"],
    ["vacío", ""],
  ])("se niega con %s", (_nombre, url) => {
    expect(validarUrlLocal(url)).toMatch(/Me niego|no es válida/);
  });
});
