"use client";

import { useEffect } from "react";
import {
  actualizarPresupuesto,
  guardarPresupuesto,
  subirFotoPresupuesto,
  type TipoCalculadora,
} from "@/lib/presupuestos";
import {
  actualizarCatalogoItem,
  guardarTextosCompartidos,
  obtenerCatalogo,
  type CatalogoRow,
} from "@/lib/catalogo";

/**
 * ===========================================================================
 * EL PUENTE ENTRE REACT Y LAS CALCULADORAS LEGACY
 * ===========================================================================
 *
 * Las 5 calculadoras siguen siendo JavaScript vanilla (public/*-calc.js y
 * app/dashboard/losetas/script.ts). No importan módulos: hablan con la app
 * de Next a través de un puñado de funciones colgadas de `window`.
 *
 * Este archivo es el ÚNICO lugar donde se declara ese contrato. Antes vivía
 * duplicado como un bloque `declare global` distinto en cada uno de los 5
 * `calculator.tsx`, así que agregar o cambiar una función del puente pedía
 * tocar 5 archivos y era fácil que quedaran desalineados.
 *
 * ---------------------------------------------------------------------------
 * POR QUÉ IMPORTA SI ALGÚN DÍA SE MIGRA A REACT
 * ---------------------------------------------------------------------------
 * Esta es la costura por donde se corta. Cada función de acá es una capacidad
 * que hoy el script legacy pide y que un componente React futuro va a llamar
 * directo (sin `window`). Migrar una calculadora a React = reimplementar SU
 * markup + SU lógica llamando a estas mismas funciones de `lib/`, y dejar de
 * instalar el puente para ese tipo. Las otras 4 no se enteran.
 *
 * Por eso todo lo que cruza el puente ya está tipado y ya está ligado al tipo
 * de calculadora: del otro lado no hay ningún `any` suelto ni ningún string
 * de tipo dando vueltas.
 */

declare global {
  interface Window {
    /* --- React le da al script legacy (se instalan acá) ------------------ */
    guardarPresupuesto?: (
      datos: unknown,
      clienteNombre: string
    ) => Promise<{ error: unknown }>;
    actualizarPresupuesto?: (
      id: string,
      datos: unknown,
      clienteNombre: string
    ) => Promise<{ error: unknown }>;
    subirFotoPresupuesto?: (
      blob: Blob
    ) => Promise<{ url: string; error: null } | { error: unknown }>;
    actualizarCatalogoItem?: (
      clave: string,
      precio: number | null,
      descripcion?: string
    ) => Promise<{ error: unknown }>;
    obtenerCatalogoCompartido?: () => Promise<CatalogoRow[]>;
    guardarTextosCompartidos?: (
      entradas: { clave: string; descripcion: string }[]
    ) => Promise<{ error: unknown }>;
    /** id del presupuesto que se está editando, o null si es uno nuevo. Al
     *  duplicar queda null a propósito: "Guardar en la nube" tiene que crear
     *  una fila nueva, no pisar el original que se está copiando. */
    presupuestoEnEdicionId?: string | null;

    /* --- Librerías pesadas, servidas desde el bundle -----------------------
       docx (~370 KB) y html2canvas (~200 KB) son dependencias del proyecto.
       Los scripts legacy corren como <script> clásicos desde /public, así que
       no pueden hacer `import()` de un paquete: necesitan que alguien se los
       cargue. Estas dos funciones son ese alguien.

       Antes cada script se bajaba su librería de un CDN de terceros: no estaban
       en el lockfile, no funcionaban sin internet y un CDN caído rompía la
       generación del presupuesto. Ahora Next las sirve como chunk aparte, que
       se pide recién en el primer export. --------------------------------- */
    cargarLibDocx?: () => Promise<typeof import("docx")>;
    cargarLibHtml2Canvas?: () => Promise<
      (typeof import("html2canvas"))["default"]
    >;
    /** Caché de la librería ya cargada; la leen los scripts legacy. */
    docx?: typeof import("docx");
    html2canvas?: (typeof import("html2canvas"))["default"];

    /* --- El script legacy le da a React (los instala él, acá solo se
           declaran para poder llamarlos con tipos) ------------------------ */
    cargarPresupuestoExterno?: (datos: unknown) => void;
    /** Nombre de archivo unificado; lo instala public/nombre-archivo.js. */
    armarNombreArchivo?: (
      tipo: string,
      cliente: string,
      fecha: string | null
    ) => string;
  }
}

/**
 * Instala el puente para un tipo de calculadora y lo desarma al desmontar.
 * Todas las funciones quedan ligadas a `tipo`, así el script legacy nunca
 * necesita saber en qué calculadora está parado.
 */
export function usePuenteCalculadora(
  tipo: TipoCalculadora,
  presupuestoId: string | null
) {
  useEffect(() => {
    window.guardarPresupuesto = (datos, clienteNombre) =>
      guardarPresupuesto(tipo, datos, clienteNombre);
    window.actualizarPresupuesto = (id, datos, clienteNombre) =>
      actualizarPresupuesto(id, datos, clienteNombre);
    window.subirFotoPresupuesto = (blob) => subirFotoPresupuesto(tipo, blob);
    window.actualizarCatalogoItem = (clave, precio, descripcion) =>
      actualizarCatalogoItem(tipo, clave, precio, descripcion);
    window.obtenerCatalogoCompartido = () => obtenerCatalogo(tipo);
    window.guardarTextosCompartidos = (entradas) =>
      guardarTextosCompartidos(tipo, entradas);
    window.presupuestoEnEdicionId = presupuestoId;

    // El import() dinámico hace que Next las ponga en un chunk aparte: no pesan
    // nada hasta que alguien exporta. Se cachean en window.docx / window.html2canvas
    // para que una segunda exportación no vuelva a resolver el módulo.
    window.cargarLibDocx = async () => {
      window.docx ??= await import("docx");
      return window.docx;
    };
    window.cargarLibHtml2Canvas = async () => {
      window.html2canvas ??= (await import("html2canvas")).default;
      return window.html2canvas;
    };

    return () => {
      delete window.guardarPresupuesto;
      delete window.actualizarPresupuesto;
      delete window.subirFotoPresupuesto;
      delete window.actualizarCatalogoItem;
      delete window.obtenerCatalogoCompartido;
      delete window.guardarTextosCompartidos;
      delete window.presupuestoEnEdicionId;
      delete window.cargarLibDocx;
      delete window.cargarLibHtml2Canvas;
      // window.docx / window.html2canvas se dejan a propósito: son la librería ya
      // descargada, no estado de esta pantalla. Borrarlas obligaría a re-resolver
      // el módulo en cada navegación entre calculadoras.
    };
  }, [tipo, presupuestoId]);
}
