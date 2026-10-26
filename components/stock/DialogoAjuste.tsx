"use client";

import { useId, useRef, useState } from "react";
import { ajustarConteo } from "@/lib/stock";
import {
  MOTIVO_MAX,
  cantidadConSigno,
  diferenciaDeConteo,
  nuevaClaveIdempotencia,
  parsearConteo,
  validarMotivo,
} from "@/lib/domain/stock/movimientos";
import type { ResultadoStock } from "@/lib/domain/stock/movimientos";
import { CLASE_BOTON_PRIMARIO, CLASE_BOTON_SECUNDARIO, CLASE_INPUT, MarcoDialogo } from "./MarcoDialogo";

/**
 * "Corregir stock": la persona cuenta las unidades que hay y escribe ese número.
 * Manda el CONTEO, no la diferencia: la diferencia la calcula la base con el ítem
 * bloqueado, así que si el stock cambió mientras contaba, igual queda en lo que contó.
 * Lo que se muestra acá ("cambia en +2") es una estimación con lo que se ve en pantalla.
 */
export function DialogoAjuste({
  itemId,
  nombre,
  stockActual,
  onCerrar,
  onHecho,
}: {
  itemId: string;
  nombre: string;
  stockActual: number;
  onCerrar: () => void;
  onHecho: (resultado: ResultadoStock) => void;
}) {
  const idConteo = useId();
  const idMotivo = useId();
  const [conteo, setConteo] = useState(String(Math.max(0, stockActual)));
  const [motivo, setMotivo] = useState("");
  const [clave, setClave] = useState(nuevaClaveIdempotencia);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const enCurso = useRef(false);

  function cambiar(setter: (v: string) => void, valor: string) {
    setter(valor);
    setError(null);
    setClave(nuevaClaveIdempotencia()); // otro dato = otra operación
  }

  async function confirmar() {
    if (enCurso.current) return; // doble toque
    const c = parsearConteo(conteo);
    if (c.error !== null) return setError(c.error);
    const m = validarMotivo(motivo);
    if (m.error !== null) return setError(m.error);

    enCurso.current = true;
    setEnviando(true);
    setError(null);
    const respuesta = await ajustarConteo({ itemId, stockContado: c.valor, motivo: m.motivo, idempotencyKey: clave });
    enCurso.current = false;
    setEnviando(false);
    if (respuesta.error !== null) return setError(respuesta.error);
    // Si el conteo coincidía con el stock de la base, `movimiento_id` viene null y el padre lo avisa.
    onHecho(respuesta.resultado);
  }

  const c = parsearConteo(conteo);
  const dif = c.error === null ? diferenciaDeConteo(stockActual, c.valor) : null;

  return (
    <MarcoDialogo
      titulo="Corregir stock"
      subtitulo={`${nombre} · el sistema dice ${stockActual}`}
      ocupado={enviando}
      onCerrar={onCerrar}
      pie={
        <div className="flex gap-2">
          <button type="button" disabled={enviando} onClick={onCerrar} className={`${CLASE_BOTON_SECUNDARIO} flex-1`}>
            Cancelar
          </button>
          <button type="button" disabled={enviando} onClick={confirmar} className={`${CLASE_BOTON_PRIMARIO} flex-[2]`}>
            {enviando ? "Un momento..." : "Guardar conteo"}
          </button>
        </div>
      }
    >
      <label htmlFor={idConteo} className="mb-1 block text-sm font-medium text-gray-700">
        Unidades que contaste
      </label>
      <input
        id={idConteo}
        autoFocus
        inputMode="numeric"
        autoComplete="off"
        value={conteo}
        disabled={enviando}
        maxLength={7}
        onChange={(e) => cambiar(setConteo, e.target.value)}
        className={CLASE_INPUT}
      />
      {dif !== null && (
        <p className="mt-1 text-sm text-gray-500">
          {dif === 0 ? "Coincide con el sistema: no cambia nada." : `El stock cambia en ${cantidadConSigno(dif)}.`}
        </p>
      )}

      <label htmlFor={idMotivo} className="mb-1 mt-3 block text-sm font-medium text-gray-700">
        Motivo
      </label>
      <textarea
        id={idMotivo}
        rows={2}
        value={motivo}
        disabled={enviando}
        maxLength={MOTIVO_MAX}
        onChange={(e) => cambiar(setMotivo, e.target.value)}
        placeholder="Por ejemplo: conteo físico del depósito, rotura…"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 hover:border-gray-400 focus:border-marca focus:outline-none focus:ring-2 focus:ring-celeste/40 disabled:opacity-50"
      />

      {error && (
        <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

    </MarcoDialogo>
  );
}
