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

    return () => {
      delete window.guardarPresupuesto;
      delete window.actualizarPresupuesto;
      delete window.subirFotoPresupuesto;
      delete window.actualizarCatalogoItem;
      delete window.obtenerCatalogoCompartido;
      delete window.guardarTextosCompartidos;
      delete window.presupuestoEnEdicionId;
    };
  }, [tipo, presupuestoId]);
}
