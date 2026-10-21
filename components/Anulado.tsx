"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Cómo se ve un registro anulado, y cómo le avisan a las pantallas de edición
 * que ese registro es de sólo lectura.
 *
 * Un presupuesto anulado se puede abrir y exportar (Word, PDF), pero no guardar:
 * la base lo rechaza igual (trigger `controlar_anulacion`), esto evita ofrecer
 * un botón que no va a funcionar. Se usa un contexto para no pasar una prop por
 * las cinco calculadoras.
 */

export interface DatosAnulacion {
  motivo: string | null;
  fecha: string | null;
}

const AnuladoContext = createContext<DatosAnulacion | null>(null);

/** `anulado` = null: el presupuesto se puede guardar normalmente. */
export function ProveerAnulado({ anulado, children }: { anulado: DatosAnulacion | null; children: ReactNode }) {
  return <AnuladoContext.Provider value={anulado}>{children}</AnuladoContext.Provider>;
}

/** Los datos de la anulación, o null si lo que se está editando no está anulado. */
export function useAnulado(): DatosAnulacion | null {
  return useContext(AnuladoContext);
}

/** La etiqueta chica que acompaña a un registro anulado en las listas. */
export function EtiquetaAnulado({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ${className}`}
    >
      Anulado
    </span>
  );
}

function fechaCorta(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-AR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

/** El aviso de arriba de una pantalla que muestra un registro anulado. */
export function AvisoAnulado({ anulado, que = "presupuesto" }: { anulado: DatosAnulacion; que?: string }) {
  const fecha = fechaCorta(anulado.fecha);
  return (
    <div data-print-hide="" role="status" className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <p className="font-semibold">Este {que} está anulado{fecha ? ` (${fecha})` : ""}.</p>
      <p className="mt-0.5">
        Se puede ver y exportar, pero no se puede modificar ni guardar.
        {anulado.motivo ? <> Motivo: {anulado.motivo}</> : null}
      </p>
    </div>
  );
}

/** Muestra sus hijos (el botón "Guardar") sólo si lo que se edita NO está anulado. */
export function SoloSiNoAnulado({ children }: { children: ReactNode }) {
  return useContext(AnuladoContext) ? null : <>{children}</>;
}

/**
 * Envuelve los campos del formulario de un presupuesto. Si el presupuesto está
 * anulado, los deshabilita a todos (un <fieldset disabled> alcanza a inputs,
 * selects, textareas y botones) y bloquea el puntero sobre lo que no es un campo
 * (por ejemplo el plano). Las acciones de exportar quedan afuera: se puede ver y
 * exportar, no editar. Sin anulación es un contenedor transparente.
 */
export function CamposSoloLectura({ children }: { children: ReactNode }) {
  const anulado = useContext(AnuladoContext);
  return (
    <fieldset
      disabled={!!anulado}
      aria-readonly={anulado ? true : undefined}
      className={`m-0 min-w-0 space-y-6 border-0 p-0 ${anulado ? "pointer-events-none opacity-90" : ""}`}
    >
      {children}
    </fieldset>
  );
}
