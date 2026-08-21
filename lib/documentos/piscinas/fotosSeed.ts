/**
 * Fotos de referencia por opcional de Piscinas — contenido de catálogo, no
 * dato de un presupuesto puntual (por eso viven en código, no en `fotos`
 * ni en el snapshot). Restaura lo que hacía el legacy: cuando un opcional
 * tiene fotos propias (equipo físico en el negocio, muestras de
 * revestimiento), el presupuesto las muestra siempre — el opcional se ve
 * igual con o sin tildar (regla ya existente: "Los opcionales se muestran
 * TODOS", ver DocumentoPiscina.tsx), así que sus fotos también.
 *
 * Los archivos son los mismos `public/seeds/*.jpg` que ya estaban en el
 * proyecto sin usarse desde la migración a React. Ancho/alto reales
 * (necesarios para no deformar la imagen en el .docx) verificados contra
 * los archivos, no inventados.
 *
 * Verificado contra un presupuesto real ya entregado (Pettenon, Rogelio
 * 7x3) — mismas fotos, mismo criterio de "siempre visibles".
 */
export interface FotoSeed {
  url: string;
  width: number;
  height: number;
}

const TRAVERTINO: FotoSeed[] = [
  { url: "/seeds/travertino-1-ac1fe49e.jpg", width: 413, height: 392 },
  { url: "/seeds/travertino-2-89179844.jpg", width: 403, height: 392 },
  { url: "/seeds/travertino-3-8c31fff6.jpg", width: 398, height: 389 },
];

/**
 * Clave del catálogo → fotos de ESE opcional. Las claves están confirmadas
 * contra `supabase/migration_catalogo_categorias.sql` (única fuente que las
 * nombra) y contra el presupuesto real de referencia.
 *
 * "travertino_rustico_exterior" y "travertino_pulido_interior" son dos
 * opcionales consecutivos que en el presupuesto real comparten un solo
 * bloque de fotos (no una tanda repetida por cada uno) — por eso el set de
 * fotos cuelga sólo del segundo: así aparece una vez, inmediatamente
 * después de que se muestran los dos.
 */
export const FOTOS_POR_CLAVE: Record<string, FotoSeed[]> = {
  climatizacion25000: [
    { url: "/seeds/climatizacion25000-1-e031a7b1.jpg", width: 424, height: 580 },
    { url: "/seeds/climatizacion25000-2-09461576.jpg", width: 273, height: 208 },
  ],
  climatizacion30000: [
    { url: "/seeds/climatizacion30000-1-39bb24d6.jpg", width: 342, height: 316 },
    { url: "/seeds/climatizacion30000-2-8b23b6df.jpg", width: 331, height: 290 },
    { url: "/seeds/climatizacion30000-3-b2373b9c.jpg", width: 351, height: 270 },
  ],
  revestimiento_ceramico_bali: [
    { url: "/seeds/revestimiento_ceramico_bali-1-c19833a5.jpg", width: 193, height: 334 },
    { url: "/seeds/revestimiento_ceramico_bali-2-98907be6.jpg", width: 477, height: 342 },
    { url: "/seeds/revestimiento_ceramico_bali-3-417efb5f.jpg", width: 373, height: 339 },
    { url: "/seeds/revestimiento_ceramico_bali-4-dc038b92.jpg", width: 371, height: 250 },
  ],
  revestimiento_piedra_bali: [
    { url: "/seeds/revestimiento_piedra_bali-1-98f57e64.jpg", width: 482, height: 479 },
    { url: "/seeds/revestimiento_piedra_bali-2-fde03c40.jpg", width: 403, height: 521 },
    { url: "/seeds/revestimiento_piedra_bali-3-b164545a.jpg", width: 399, height: 469 },
  ],
  travertino_rustico_exterior: [],
  travertino_pulido_interior: TRAVERTINO,
  cerco_perimetral: [
    { url: "/seeds/cerco_perimetral-1-6dde6bea.jpg", width: 851, height: 661 },
    { url: "/seeds/cerco_perimetral-2-23004a23.jpg", width: 556, height: 695 },
  ],
};

/**
 * Fotos "generales": van siempre al final del documento, sin depender de
 * ningún opcional (dos modelos de referencia + una foto de obra real). El
 * presupuesto real de referencia usa exactamente estas tres — de las 9
 * variantes que hay en `public/seeds/general-*`, son las que coinciden con
 * "MODELO 2", "MODELO 6" y la foto de obra terminada.
 */
export const FOTOS_GENERALES: FotoSeed[] = [
  { url: "/seeds/general-1-454abd16.jpg", width: 579, height: 404 }, // Modelo 2
  { url: "/seeds/general-2-84060e27.jpg", width: 1100, height: 618 }, // Modelo 6
  { url: "/seeds/general-3-45ececf7.jpg", width: 712, height: 590 }, // obra terminada
];

/** Fotos de un opcional por su clave (o [] si no tiene ninguna asociada). */
export function fotosSeedDeOpcional(clave: string | null): FotoSeed[] {
  return FOTOS_POR_CLAVE[clave ?? ""] ?? [];
}
