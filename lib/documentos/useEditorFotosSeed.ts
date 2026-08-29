"use client";

import { useCallback, useState } from "react";
import { redimensionarImagen, MAX_DIM_SUBIDA, CALIDAD_SUBIDA } from "@/lib/documentos/imagenes";
import type { FotoSeed } from "@/lib/documentos/fotosSeed";
import type { FotoDocumentoModelo, ResolverFotosSeed } from "@/lib/documentos/modelo";

/** Una foto agregada a mano a un grupo de fotos precargadas — vive sólo en
 *  memoria del navegador (blob: URL), nunca se sube a ningún lado: ver el
 *  comentario grande más abajo sobre por qué esto no se persiste. */
export interface FotoSeedAgregada {
  id: string;
  url: string;
  width: number;
  height: number;
}

export interface EstadoGrupoFotosSeed {
  /** URLs de fotos de catálogo que el vendedor sacó para esta exportación. */
  excluidas: Set<string>;
  /** Fotos que el vendedor sumó a mano a este grupo. */
  agregadas: FotoSeedAgregada[];
}

const GRUPO_VACIO: EstadoGrupoFotosSeed = { excluidas: new Set(), agregadas: [] };

/**
 * Deja sacar/agregar fotos de un grupo de "fotos precargadas" (catálogo:
 * "Modelos de referencia", "Fotos de referencia", las que van con cada
 * opcional/material — ver lib/documentos/fotosSeed.ts) ANTES de generar el
 * PDF/Word de un presupuesto puntual.
 *
 * A propósito NO se persiste (ni en el snapshot, ni en Supabase): son fotos
 * de CATÁLOGO, compartidas por todos los presupuestos de la empresa — sacar
 * una acá es "para este cliente en particular no quiero mandar esta foto",
 * no "esta foto ya no es del catálogo". Por eso el estado vive en memoria de
 * este componente (se resetea si se recarga la página o se reabre el
 * presupuesto desde el historial) y por eso las fotos agregadas nunca se
 * suben a Storage: son `blob:` URLs locales, válidas mientras dure la
 * pestaña, que alcanzan para `@react-pdf/renderer` (ver pdfGenerator.tsx,
 * ya resuelve `blob:`/`http(s)` tal cual) y para el Word.
 */
export function useEditorFotosSeed() {
  const [estado, setEstado] = useState<Record<string, EstadoGrupoFotosSeed>>({});
  const [subiendo, setSubiendo] = useState(false);

  const grupo = useCallback((clave: string): EstadoGrupoFotosSeed => estado[clave] ?? GRUPO_VACIO, [estado]);

  const quitar = useCallback((clave: string, url: string) => {
    setEstado((prev) => {
      const actual = prev[clave] ?? GRUPO_VACIO;
      const excluidas = new Set(actual.excluidas);
      excluidas.add(url);
      return { ...prev, [clave]: { ...actual, excluidas } };
    });
  }, []);

  const restaurar = useCallback((clave: string, url: string) => {
    setEstado((prev) => {
      const actual = prev[clave];
      if (!actual || !actual.excluidas.has(url)) return prev;
      const excluidas = new Set(actual.excluidas);
      excluidas.delete(url);
      return { ...prev, [clave]: { ...actual, excluidas } };
    });
  }, []);

  const quitarAgregada = useCallback((clave: string, id: string) => {
    setEstado((prev) => {
      const actual = prev[clave];
      if (!actual) return prev;
      return { ...prev, [clave]: { ...actual, agregadas: actual.agregadas.filter((f) => f.id !== id) } };
    });
  }, []);

  const agregar = useCallback(async (clave: string, files: FileList | null) => {
    if (!files || !files.length) return;
    setSubiendo(true);
    try {
      for (const file of Array.from(files)) {
        try {
          const { blob, width, height } = await redimensionarImagen(file, MAX_DIM_SUBIDA, CALIDAD_SUBIDA);
          const nueva: FotoSeedAgregada = { id: crypto.randomUUID(), url: URL.createObjectURL(blob), width, height };
          setEstado((prev) => {
            const actual = prev[clave] ?? GRUPO_VACIO;
            return { ...prev, [clave]: { ...actual, agregadas: [...actual.agregadas, nueva] } };
          });
        } catch (err) {
          console.error("No se pudo procesar una foto precargada", err);
        }
      }
    } finally {
      setSubiendo(false);
    }
  }, []);

  /** Para pasarle directo a `armarBloques<Tipo>()`: catálogo menos las
   *  excluidas, más las agregadas a mano. */
  const resolver: ResolverFotosSeed = useCallback(
    (clave: string, base: FotoSeed[]): FotoDocumentoModelo[] => {
      const g = estado[clave];
      if (!g) return base;
      return [...base.filter((f) => !g.excluidas.has(f.url)), ...g.agregadas];
    },
    [estado]
  );

  return { grupo, quitar, restaurar, quitarAgregada, agregar, resolver, subiendo };
}

export type EditorFotosSeed = ReturnType<typeof useEditorFotosSeed>;
