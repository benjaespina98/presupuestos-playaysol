import type { Calculadora, TipoLegacy } from "./harness";

/**
 * Los casos que se le plantean a cada calculadora legacy para grabar qué
 * contesta. NO son "los resultados correctos": son los resultados ACTUALES.
 * Si alguno estuviera mal, se documenta y se corrige después de la migración,
 * nunca durante.
 *
 * Al agregar un caso hay que volver a grabar las fixtures:
 *     npm run oraculo:grabar
 */

export interface Caso {
  nombre: string;
  /** Qué se carga en la calculadora. Sólo campos, sin aserciones. */
  preparar: (c: Calculadora) => void | Promise<void>;
  /** Campos calculados por la app que también vale la pena congelar. */
  leerAdemas?: string[];
}

// Cercos, cobertores y piscinas ya no están acá: se migraron a React (Fase
// 5), así que ya no hay calculadora legacy contra la cual grabar/comparar
// estos casos. Las fixtures que produjeron
// (tests/oracle/fixtures/{cercos,cobertores,piscinas}.json) siguen vivas:
// lib/domain/precios/contra-oraculo.test.ts las usa para proteger el motor
// nuevo para siempre, sin necesitar volver a ejecutar el legacy.
export const CASOS: Record<TipoLegacy, Caso[]> = {
  /* ── REVESTIMIENTOS ──────────────────────────────────────────────────────
     m² = piso + paredes + escalera + desperdicio + adicionales
     paredes = 2 × profundidad_promedio × (largo + ancho)
     total   = Σ opcionales incluidos (precio × m², o precio fijo si es
               "por obra") + Σ adicionales                              */
  revestimientos: [
    {
      nombre: "profundidad pareja (solo desde)",
      preparar: (c) => {
        c.set("f-largo", "8");
        c.set("f-ancho", "4");
        c.set("f-prof-min", "1.5");
      },
      leerAdemas: ["f-m2-fondo", "f-m2-paredes", "f-m2-total"],
    },
    {
      nombre: "profundidad de menor a mayor (usa el promedio)",
      preparar: (c) => {
        c.set("f-largo", "8");
        c.set("f-ancho", "4");
        c.set("f-prof-min", "1");
        c.set("f-prof-max", "1.6");
      },
      leerAdemas: ["f-m2-fondo", "f-m2-paredes", "f-m2-total"],
    },
    {
      nombre: "con escalera y desperdicio",
      preparar: (c) => {
        c.set("f-largo", "8");
        c.set("f-ancho", "4");
        c.set("f-prof-min", "1.5");
        c.set("f-escalera", "3");
        c.set("f-desperdicio", "2");
      },
      leerAdemas: ["f-m2-fondo", "f-m2-paredes", "f-m2-total"],
    },
    {
      nombre: "un revestimiento incluido, cobrado por m²",
      preparar: (c) => {
        c.set("f-largo", "8");
        c.set("f-ancho", "4");
        c.set("f-prof-min", "1.5");
        c.opcional(0, true);
      },
      leerAdemas: ["f-m2-total"],
    },
    {
      nombre: "dos revestimientos incluidos",
      preparar: (c) => {
        c.set("f-largo", "8");
        c.set("f-ancho", "4");
        c.set("f-prof-min", "1.5");
        c.opcional(0, true);
        c.opcional(1, true);
      },
      leerAdemas: ["f-m2-total"],
    },
    {
      nombre: "sin medidas",
      preparar: (c) => {
        c.set("f-largo", "0");
        c.set("f-ancho", "0");
        c.set("f-prof-min", "0");
      },
      leerAdemas: ["f-m2-fondo", "f-m2-paredes", "f-m2-total"],
    },
  ],
};
