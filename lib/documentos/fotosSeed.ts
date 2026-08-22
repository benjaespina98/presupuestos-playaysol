/**
 * Fotos de referencia por opcional/material — compartidas entre Piscinas,
 * Revestimientos, Cercos y Cobertores. Son contenido de CATÁLOGO, no dato
 * de un presupuesto puntual (por eso viven en código, no en `fotos` ni en
 * el snapshot): la foto del equipo de climatización es siempre la misma
 * foto, la use quien la use, no depende de qué presupuesto sea.
 *
 * Restaura lo que hacía el legacy y se perdió al migrar a React (nadie
 * sabía que había que reconstruirlo — `public/seeds/*.jpg` quedó sin
 * consumidores). Ancho/alto reales, verificados contra los archivos, no
 * inventados: hacen falta para no deformar la imagen en el .docx.
 *
 * Verificado contra un presupuesto real ya entregado (Pettenon, Rogelio
 * 7x3, piscinas) para el mapeo clave → foto y el criterio de "siempre
 * visibles". Para cercos y cobertores no hay un presupuesto real de
 * referencia a mano — el mapeo ahí es la mejor lectura de qué archivo de
 * `public/seeds/` corresponde a cada uno (confirmado con el usuario antes
 * de implementarlo), no una transcripción 1:1 de un documento real.
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
 * Clave del catálogo → fotos de ESE material/opcional. La misma clave puede
 * existir en más de una calculadora (`revestimiento_ceramico_bali`, por
 * ejemplo, es un opcional de Piscinas Y un material de Revestimientos — es
 * el mismo producto físico, catálogo distinto por tipo de calculadora) y la
 * foto es la misma en los dos lados: por eso el mapa es por clave sola, sin
 * distinguir de qué calculadora viene.
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

/** Fotos de un opcional/material por su clave (o [] si no tiene ninguna asociada). */
export function fotosSeedDeOpcional(clave: string | null): FotoSeed[] {
  return FOTOS_POR_CLAVE[clave ?? ""] ?? [];
}

/**
 * Fotos "generales" de Piscinas: van siempre al final del documento, sin
 * depender de ningún opcional (dos modelos de referencia + una foto de obra
 * real). El presupuesto real de referencia usa exactamente estas tres — de
 * las 9 variantes que hay en `public/seeds/general-*`, son las que
 * coinciden con "MODELO 2", "MODELO 6" y la foto de obra terminada.
 */
export const FOTOS_GENERALES_PISCINAS: FotoSeed[] = [
  { url: "/seeds/general-1-454abd16.jpg", width: 579, height: 404 }, // Modelo 2
  { url: "/seeds/general-2-84060e27.jpg", width: 1100, height: 618 }, // Modelo 6
  { url: "/seeds/general-3-45ececf7.jpg", width: 712, height: 590 }, // obra terminada
];

/**
 * Cercos no modela "cerco perimetral" como un opcional de catálogo (es el
 * producto principal: metros lineales + precio por ml, campos propios del
 * formulario, no una fila de `catalogo_items`) — por eso estas fotos no
 * cuelgan de ninguna clave: se muestran fijas, siempre, igual que las
 * "generales" de Piscinas.
 */
export const FOTOS_REFERENCIA_CERCOS: FotoSeed[] = [
  { url: "/seeds/cerco_perimetral-1-6dde6bea.jpg", width: 851, height: 661 },
  { url: "/seeds/cerco_perimetral-2-23004a23.jpg", width: 556, height: 695 },
];

/**
 * Cobertores: mismo caso que Cercos (el cobertor es el producto principal,
 * no un opcional de catálogo). Las fotos son dos lonas/cobertores de
 * pileta que estaban mezcladas en la carpeta "general" de `public/seeds/`
 * — confirmado con el negocio que son las de Cobertores, no fotos
 * genéricas de piscina.
 */
export const FOTOS_REFERENCIA_COBERTORES: FotoSeed[] = [
  { url: "/seeds/general-1-adad76e0.jpg", width: 1100, height: 618 },
  { url: "/seeds/general-2-a55d37fe.jpg", width: 1000, height: 702 },
];
