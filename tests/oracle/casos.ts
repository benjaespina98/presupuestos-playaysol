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

// Cercos ya no está acá: se migró a React (Fase 5), así que ya no hay
// calculadora legacy contra la cual grabar/comparar estos casos. La fixture
// que estos casos produjeron (tests/oracle/fixtures/cercos.json) sigue viva:
// lib/domain/precios/contra-oraculo.test.ts la usa para proteger el motor
// nuevo para siempre, sin necesitar volver a ejecutar el legacy.
export const CASOS: Record<TipoLegacy, Caso[]> = {
  /* ── COBERTORES ──────────────────────────────────────────────────────────
     m² = largo × ancho + adicional.  El precio SALTA a los 15 m²:
     hasta 15 → 10.903 /m² · más de 15 → 9.902 /m² · instalación 100.000
     Los tres casos del borde son los más importantes de todo el archivo. */
  cobertores: [
    {
      nombre: "borde: exactamente 15 m² (3 × 5)",
      preparar: (c) => {
        c.set("f-largo", "3");
        c.set("f-ancho", "5");
        c.set("f-modo-precio", "ambos");
      },
      leerAdemas: ["f-m2"],
    },
    {
      nombre: "borde: apenas debajo de 15 m² (3 × 4,9)",
      preparar: (c) => {
        c.set("f-largo", "3");
        c.set("f-ancho", "4.9");
        c.set("f-modo-precio", "ambos");
      },
      leerAdemas: ["f-m2"],
    },
    {
      nombre: "borde: apenas encima de 15 m² (3 × 5,1)",
      preparar: (c) => {
        c.set("f-largo", "3");
        c.set("f-ancho", "5.1");
        c.set("f-modo-precio", "ambos");
      },
      leerAdemas: ["f-m2"],
    },
    {
      nombre: "pileta grande 8 × 4",
      preparar: (c) => {
        c.set("f-largo", "8");
        c.set("f-ancho", "4");
        c.set("f-modo-precio", "ambos");
      },
      leerAdemas: ["f-m2"],
    },
    {
      nombre: "el adicional de m² cruza el umbral (3 × 4,5 = 13,5 + 2 = 15,5)",
      preparar: (c) => {
        c.set("f-largo", "3");
        c.set("f-ancho", "4.5");
        c.set("f-adicional-m2", "2");
        c.set("f-modo-precio", "ambos");
      },
      leerAdemas: ["f-m2"],
    },
    {
      nombre: "el adicional de m² NO alcanza a cruzarlo (13,5 + 1 = 14,5)",
      preparar: (c) => {
        c.set("f-largo", "3");
        c.set("f-ancho", "4.5");
        c.set("f-adicional-m2", "1");
        c.set("f-modo-precio", "ambos");
      },
      leerAdemas: ["f-m2"],
    },
    {
      nombre: "sin medidas",
      preparar: (c) => {
        c.set("f-largo", "0");
        c.set("f-ancho", "0");
        c.set("f-modo-precio", "ambos");
      },
      leerAdemas: ["f-m2"],
    },
  ],

  /* ── PISCINAS ────────────────────────────────────────────────────────────
     total = subtotal (lo tipea una persona) + Σ adicionales.
     La complejidad no está en la cuenta sino en cómo se muestran los
     opcionales: salen TODOS, con precio si están tildados y "No incluye"
     si no.                                                              */
  piscinas: [
    {
      nombre: "subtotal a mano, sin opcionales",
      preparar: (c) => {
        c.set("f-subtotal", "18500000");
      },
    },
    {
      nombre: "subtotal con un opcional tildado",
      preparar: (c) => {
        c.set("f-subtotal", "18500000");
        c.opcional(0, true);
      },
    },
    {
      nombre: "subtotal con tres opcionales tildados",
      preparar: (c) => {
        c.set("f-subtotal", "18500000");
        c.opcional(0, true);
        c.opcional(1, true);
        c.opcional(2, true);
      },
    },
    {
      nombre: "sin subtotal cargado",
      preparar: (c) => {
        c.set("f-subtotal", "0");
      },
    },
    {
      nombre: "subtotal + un adicional (aparece la línea TOTAL)",
      preparar: (c) => {
        c.set("f-subtotal", "18500000");
        c.agregarAdicional("Traslado de equipos", "350000");
      },
    },
    {
      nombre: "subtotal + dos adicionales",
      preparar: (c) => {
        c.set("f-subtotal", "18500000");
        c.agregarAdicional("Traslado de equipos", "350000");
        c.agregarAdicional("Retiro de tierra", "420000");
      },
    },
  ],

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
