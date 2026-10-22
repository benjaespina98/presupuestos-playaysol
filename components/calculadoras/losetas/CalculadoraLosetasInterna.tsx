"use client";

import { useMemo, useState, type ReactNode } from "react";
import { NumberInput } from "@/components/form/NumberInput";
import {
  calcularLosetas,
  entradaPorDefecto,
  type EntradaCalculoLosetas,
  type TipoPileta,
} from "@/lib/domain/plano/calculoLosetas";

/**
 * Calculadora de losetas — herramienta INTERNA, separada del plano y del presupuesto.
 *
 * Calcula cantidades de piezas (losetas de borde y planas) para pedir. No calcula precios, no suma
 * a ningún total y no aparece en la imagen, el PDF ni el Word que se le entregan al cliente: tiene su
 * propio estado y no forma parte del formulario que se guarda. Se oculta al imprimir.
 *
 * Las medidas de la pileta arrancan con las del plano, pero se pueden cambiar acá sin tocarlo.
 */
export function CalculadoraLosetasInterna({ largoPlano, anchoPlano }: { largoPlano: number; anchoPlano: number }) {
  const [entrada, setEntrada] = useState<EntradaCalculoLosetas>(() => ({
    ...entradaPorDefecto("hormigon"),
    largo: largoPlano,
    ancho: anchoPlano,
  }));
  const cambiar = (parcial: Partial<EntradaCalculoLosetas>) => setEntrada((e) => ({ ...e, ...parcial }));
  const r = useMemo(() => calcularLosetas(entrada), [entrada]);

  function elegirTipo(tipo: TipoPileta) {
    // Sólo cambia el tipo: la vereda sugerida es la misma (0,50) y se puede editar en los dos.
    cambiar({ tipo });
  }

  const campo = (id: string, etiqueta: string, valor: number | null, onCambio: (v: number | null) => void, ayuda?: string): ReactNode => (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {etiqueta}
      </label>
      <NumberInput id={id} value={valor} onValueChange={onCambio} emptyValue="null" placeholder="0" />
      {ayuda && <p className="text-xs text-gray-500">{ayuda}</p>}
    </div>
  );

  return (
    <details
      data-print-hide=""
      className="group rounded-lg border border-gray-200 bg-[#FFFFFF] shadow-sm"
      // Enter en un campo de acá NO guarda el presupuesto: esta calculadora no es parte del formulario.
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
      }}
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-5 py-3 hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-sm font-semibold text-gray-900">Calculadora de losetas</span>
          <span className="block text-xs text-gray-500">Herramienta interna: cuenta piezas, no precios. No va al plano ni al presupuesto.</span>
        </span>
        <span aria-hidden="true" className="text-gray-400 transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>

      <div className="space-y-4 border-t border-gray-100 px-5 py-4">
        <div role="group" aria-label="Tipo de pileta" className="grid grid-cols-2 gap-2">
          {(
            [
              ["hormigon", "Hormigón"],
              ["fibra", "Fibra"],
            ] as const
          ).map(([valor, texto]) => (
            <button
              key={valor}
              type="button"
              aria-pressed={entrada.tipo === valor}
              onClick={() => elegirTipo(valor)}
              className={`min-h-11 rounded-lg border px-3 text-sm font-semibold transition-colors ${
                entrada.tipo === valor ? "border-marca bg-marca text-[#FFFFFF] shadow-sm" : "border-gray-200 bg-[#FFFFFF] text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
        {entrada.tipo === "fibra" && (
          <p className="rounded-lg bg-[#EEF2F6] px-3 py-2 text-xs text-gray-600">
            Para fibra, cargá las medidas reales del modelo (largo y ancho exteriores) a mano.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-500">Plano: {largoPlano || "—"} × {anchoPlano || "—"} m</p>
          <button
            type="button"
            onClick={() => cambiar({ largo: largoPlano, ancho: anchoPlano })}
            disabled={!largoPlano || !anchoPlano}
            className="min-h-11 rounded-lg px-3 text-sm font-semibold text-[#1A3844] hover:bg-[#EAF0F2] active:bg-[#D5E0E4]"
          >
            Usar las medidas del plano
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {campo("calc-largo", "Largo exterior (m)", entrada.largo || null, (v) => cambiar({ largo: v ?? 0 }))}
          {campo("calc-ancho", "Ancho exterior (m)", entrada.ancho || null, (v) => cambiar({ ancho: v ?? 0 }))}
          {campo("calc-prof", "Profundidad de referencia (m)", entrada.profundidad ?? null, (v) => cambiar({ profundidad: v ?? undefined }), "No cambia la cantidad.")}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {campo("calc-loseta-largo", "Loseta, largo (m)", entrada.losetaLargo, (v) => cambiar({ losetaLargo: v ?? 0 }))}
          {campo("calc-loseta-ancho", "Loseta, ancho (m)", entrada.losetaAncho, (v) => cambiar({ losetaAncho: v ?? 0 }))}
          {campo("calc-vereda", "Ancho de vereda (m)", entrada.vereda, (v) => cambiar({ vereda: v ?? 0 }))}
          {campo("calc-desperdicio", "Desperdicio (%)", entrada.desperdicioPct, (v) => cambiar({ desperdicioPct: v ?? 0 }))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {campo("calc-planas", "Losetas planas", entrada.planas, (v) => cambiar({ planas: Math.max(0, Math.round(v ?? 0)) }), "Escalera y accesos.")}
        </div>

        {r.error ? (
          <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {r.error}
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-2 text-center" aria-label="Resultado">
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-2 py-3">
                <dt className="text-xs text-gray-500">De borde</dt>
                <dd className="text-2xl font-bold tabular-nums text-gray-900">{r.borde}</dd>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-2 py-3">
                <dt className="text-xs text-gray-500">Planas</dt>
                <dd className="text-2xl font-bold tabular-nums text-gray-900">{r.planas}</dd>
              </div>
              <div className="rounded-xl border border-[#BDC9CD] bg-[#EAF0F2] px-2 py-3">
                <dt className="text-xs text-marca">Total</dt>
                <dd className="text-2xl font-bold tabular-nums text-marca">{r.total}</dd>
              </div>
            </dl>
            <ol className="list-decimal space-y-0.5 pl-5 text-xs text-gray-600">
              {r.detalle.map((paso) => (
                <li key={paso}>{paso}</li>
              ))}
            </ol>
          </>
        )}
      </div>
    </details>
  );
}
