import type { FooterFijo } from "./textosCompartidos";
import type { FotoSeed } from "./fotosSeed";

/**
 * EL MODELO DE BLOQUES DEL DOCUMENTO.
 *
 * "Budget Data → Budget Document Renderer → PDF Generator": este archivo es
 * la pieza del medio. `PresupuestoV1` (el dato) no sabe nada de cómo se ve un
 * documento; `armarBloques<Tipo>()` en `lib/documentos/<tipo>/bloques.ts`
 * traduce cada snapshot a una lista ORDENADA de `BloqueDocumento` — datos
 * primitivos (strings, números, URLs, medidas de imagen), sin JSX y sin nada
 * específico de react-pdf ni del navegador. `PresupuestoPdfDocument.tsx` es
 * el único que sabe convertir un bloque en algo dibujable.
 *
 * Por qué existe esto en vez de que el PDF lea directo `Documento<Tipo>.tsx`:
 * ese componente está pensado para pantalla (CSS, `print:`, clases de
 * Tailwind) y depende del navegador para paginar — exactamente el problema
 * que el PDF nuevo tiene que dejar de tener. Este modelo es la única fuente
 * de "qué contenido va y en qué orden" que ambos (pantalla y PDF) podrían
 * usar el día que se decida hacer que la pantalla también renderice desde
 * acá; por ahora sólo lo consume el PDF, a propósito (ver decisión en el
 * plan: no tocar los 4 `Documento<Tipo>.tsx` en esta pasada).
 */

/** Una línea de precio: SUBTOTAL/TOTAL, un adicional suelto, o el total de
 *  una alternativa. `grande`+`destacado` es "SUBTOTAL"/"TOTAL" en letra
 *  grande y color de marca; sin ninguno de los dos es una línea de detalle
 *  chica. `reglaSuperior` dibuja una regla arriba (la línea de TOTAL de
 *  piscinas, cuando hay adicionales). */
export interface RenglonPrecio {
  descripcion: string;
  monto: string;
  grande?: boolean;
  destacado?: boolean;
  reglaSuperior?: boolean;
}

/** Una foto ya resuelta a una URL + su relación de aspecto real — lo único
 *  que hace falta para maquetarla sin deformarla (ver imageLayout.ts). */
export interface FotoDocumentoModelo {
  url: string;
  width: number;
  height: number;
  caption?: string;
}

/**
 * Cómo cada `armarBloques<Tipo>()` resuelve las fotos PRECARGADAS de
 * catálogo (`FotoSeed[]`, ver fotosSeed.ts) a lo que efectivamente va en el
 * documento. Por defecto es la identidad (las fotos de catálogo tal cual);
 * `useEditorFotosSeed` (componentes/calculadoras) devuelve un resolver que
 * saca las que el vendedor tildó "Quitar" y suma las que agregó a mano —
 * SÓLO para esa exportación puntual, nunca se persiste (ver el hook).
 *
 * `grupo` es `GRUPO_SEED_GENERAL` para el set fijo ("Modelos de
 * referencia"/"Fotos de referencia") o la `clave` del opcional/material para
 * las fotos que cuelgan de uno puntual.
 */
export type ResolverFotosSeed = (grupo: string, base: FotoSeed[]) => FotoDocumentoModelo[];

export type BloqueDocumento =
  | { tipo: "encabezado"; color: string; logoUrl: string }
  | { tipo: "titulo"; texto: string }
  | { tipo: "meta"; pares: { label: string; value: string }[] }
  /** Fotos de referencia fijas de catálogo (no del presupuesto puntual):
   *  "Fotos de referencia" de cercos/cobertores cerca del encabezado, o
   *  "Modelos de referencia" de piscinas al final. */
  | { tipo: "galeriaSeeds"; titulo: string; fotos: FotoDocumentoModelo[] }
  /** "Dimensión piscina" / "Detalle del recorrido" / "Notas de la pileta":
   *  un título de sección + una lista de renglones sueltos. `siempreVisible`
   *  reproduce la única particularidad real (piscinas: el título se muestra
   *  aunque no haya líneas todavía — ver DocumentoPiscina.tsx). */
  | { tipo: "listaDetalle"; titulo: string; lineas: string[]; siempreVisible?: boolean }
  /** Un bloque de precios. `variante: "detalle"` es la lista chica de
   *  "Adicionales" (con título, renglones sin destacar); `variante:
   *  "totales"` es el bloque final con regla superior gruesa y renglones en
   *  letra grande — cubre tanto el caso simple (1-2 líneas de TOTAL) como el
   *  de piscinas (SUBTOTAL + adicionales inline + TOTAL condicional), que ya
   *  son la misma estructura de renglones con distintos flags. */
  | { tipo: "seccionPrecios"; variante: "detalle" | "totales"; titulo?: string; renglones: RenglonPrecio[] }
  /** Encabezado de un grupo de tarjetas (opcionales de piscinas/cercos/
   *  cobertores, o "Revestimiento cotizado" de revestimientos). */
  | { tipo: "tituloSeccion"; texto: string }
  /** Una tarjeta de opcional/material: descripción + monto (o null = "No
   *  incluye") + una leyenda chica opcional (revestimientos: "$X por m² ×
   *  Y m²") + sus fotos de referencia, si tiene. */
  | { tipo: "tarjetaOpcional"; descripcion: string; monto: string | null; subcaption?: string; fotos: FotoDocumentoModelo[] }
  | { tipo: "validez"; dias: string }
  | { tipo: "textoLegal"; texto: string }
  /** Fotos subidas por el vendedor para ESTE presupuesto ("Fotos ilustrativas"). */
  | { tipo: "galeriaFotos"; titulo: string; fotos: FotoDocumentoModelo[] }
  | { tipo: "pie"; footer: FooterFijo };

/** Colores/imagen de marca por variante de encabezado — mismos valores que
 *  ya vivían repetidos en los 4 `Documento<Tipo>.tsx` y los 4 `docx.ts`. */
export const HEADER_VARIANTS: Record<string, { color: string; img: string }> = {
  teal: { color: "#00829C", img: "/header-teal.png" },
  navy: { color: "#244B5A", img: "/header-navy.png" }, // Azul Institucional oficial (RGB 36,75,90)
};

export function varianteEncabezado(variacion: string): { color: string; img: string } {
  return HEADER_VARIANTS[variacion] ?? HEADER_VARIANTS.teal;
}

/** Mismo criterio que `splitDimensionLines` de los 4 `Documento<Tipo>.tsx`:
 *  renglones cortos por salto de línea y por punto seguido de mayúscula, no
 *  un párrafo corrido. Vive acá porque los 4 `armarBloques<Tipo>` lo usan. */
export function splitDimensionLines(text: string): string[] {
  return String(text || "")
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚÑ0-9])/))
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Pares label/value de la tarjeta de datos del cliente, salteando los
 *  vacíos — mismo criterio que el componente `Meta` de los 4 documentos. */
export function paresCliente(snapshot: {
  fecha: string;
  cliente: { nombre: string; domicilio: string; localidad: string; telefono: string; email: string };
}): { label: string; value: string }[] {
  const pares: { label: string; value: string }[] = [
    { label: "Fecha:", value: snapshot.fecha },
    { label: "Señor/Sra:", value: snapshot.cliente.nombre },
    { label: "Domicilio:", value: snapshot.cliente.domicilio },
    { label: "Localidad:", value: snapshot.cliente.localidad },
    { label: "Tel:", value: snapshot.cliente.telefono },
    { label: "Email:", value: snapshot.cliente.email },
  ];
  return pares.filter((p) => p.value);
}
