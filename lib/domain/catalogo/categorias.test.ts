import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  CATEGORIAS,
  Categoria,
  esTextoCompartido,
  soloProductos,
} from "./categorias";

const SQL = path.join(__dirname, "..", "..", "..", "supabase");

describe("categorías del catálogo", () => {
  it("son las 9 acordadas, en orden", () => {
    expect(CATEGORIAS).toEqual([
      "Piscinas",
      "Filtración",
      "Revestimientos",
      "Iluminación",
      "Cobertores",
      "Cercos",
      "Accesorios",
      "Mano de obra",
      "Otros",
    ]);
  });

  it("el esquema rechaza cualquier otra", () => {
    expect(Categoria.safeParse("Piscinas").success).toBe(true);
    expect(Categoria.safeParse("Climatización").success).toBe(false);
    expect(Categoria.safeParse("").success).toBe(false);
  });

  it("la base valida exactamente las mismas 9", () => {
    // Si alguien agrega una categoría en el código y se olvida de la migración,
    // una fila válida para la app sería rechazada por Postgres.
    const sql = fs.readFileSync(
      path.join(SQL, "migration_catalogo_categorias.sql"),
      "utf8"
    );
    for (const c of CATEGORIAS) {
      expect(sql, `la migración no permite "${c}"`).toContain(`'${c}'`);
    }
  });
});

describe("claves reservadas de texto", () => {
  // catalogo_items guarda, además de productos, el aviso legal y los campos del
  // pie bajo claves con doble guión bajo. No son productos.
  it("reconoce las claves de texto compartido", () => {
    expect(esTextoCompartido("__legal")).toBe(true);
    expect(esTextoCompartido("__footer_empresa")).toBe(true);
    expect(esTextoCompartido("__footer_whatsapp")).toBe(true);
  });

  it("no confunde un producto con una clave reservada", () => {
    expect(esTextoCompartido("luces")).toBe(false);
    expect(esTextoCompartido("precioSin")).toBe(false);
    expect(esTextoCompartido("revestimiento_ceramico_bali")).toBe(false);
    expect(esTextoCompartido("_algo")).toBe(false);
  });

  it("soloProductos deja afuera los textos", () => {
    const filas = [
      { clave: "luces" },
      { clave: "__legal" },
      { clave: "precioSin" },
      { clave: "__footer_empresa" },
    ];
    expect(soloProductos(filas).map((f) => f.clave)).toEqual(["luces", "precioSin"]);
  });
});

describe("la migración de categorías es aditiva", () => {
  const sql = fs.readFileSync(
    path.join(SQL, "migration_catalogo_categorias.sql"),
    "utf8"
  );

  it("no borra ni renombra nada", () => {
    expect(sql).not.toMatch(/drop\s+table/i);
    expect(sql).not.toMatch(/drop\s+column/i);
    expect(sql).not.toMatch(/delete\s+from/i);
    expect(sql).not.toMatch(/rename/i);
    expect(sql).not.toMatch(/truncate/i);
  });

  it("se puede volver a correr sin pisar reclasificaciones manuales", () => {
    // Cada UPDATE del paso 2a filtra por `categoria is null`.
    const updatesPorDefecto = sql
      .split("\n")
      .filter((l) => l.includes("update public.catalogo_items set categoria") && l.includes("2a") === false);
    expect(updatesPorDefecto.length).toBeGreaterThan(0);
    // Los del bloque por defecto llevan la guarda.
    expect(sql).toContain("where categoria is null and tipo = 'piscinas'");
    expect(sql).toContain("where categoria is null and tipo = 'cercos'");
  });

  it("usa if not exists para las columnas", () => {
    for (const col of ["categoria", "unidad", "activo", "orden"]) {
      expect(sql).toContain(`add column if not exists ${col}`);
    }
  });
});
