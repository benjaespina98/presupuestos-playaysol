"use client";

import { useId, useRef, useState } from "react";
import { registrarMovimiento } from "@/lib/stock";
import {
  CANTIDAD_MAX,
  REFERENCIA_MAX,
  nuevaClaveIdempotencia,
  parsearCantidad,
  validarReferencia,
  ventaDejaNegativo,
} from "@/lib/domain/stock/movimientos";
import type { ResultadoStock } from "@/lib/domain/stock/movimientos";
import {
  CLASE_BOTON_PELIGRO,
  CLASE_BOTON_PRIMARIO,
  CLASE_BOTON_SECUNDARIO,
  CLASE_INPUT,
  MarcoDialogo,
} from "./MarcoDialogo";

const CLASE_PASO =
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#7D8892] bg-[#FFFFFF] text-2xl font-semibold leading-none text-[#244B5A] transition-colors hover:bg-[#EAF0F2] active:bg-[#D5E0E4]";

/**
 * Sumar (+) o restar (−) unidades de un ítem que lleva stock: en el libro, un ingreso o una venta.
 *
 * - Arranca en 1 y se ajusta con − y +: lo normal se hace en dos toques, sin abrir el teclado.
 * - La CLAVE de idempotencia se genera una vez al abrir el diálogo y se reutiliza
 *   en los reintentos (un toque doble o un reintento tras un corte no cuentan dos
 *   veces). Si la persona CAMBIA un dato, es otra operación: clave nueva.
 * - Restar por debajo de 0 se permite, pero primero pide confirmación explícita.
 */
export function DialogoMovimiento({
  tipo,
  itemId,
  nombre,
  stockActual,
  onCerrar,
  onHecho,
}: {
  tipo: "ingreso" | "venta";
  itemId: string;
  nombre: string;
  stockActual: number;
  onCerrar: () => void;
  onHecho: (resultado: ResultadoStock) => void;
}) {
  const idCantidad = useId();
  const idReferencia = useId();
  const [cantidad, setCantidad] = useState("1");
  const [referencia, setReferencia] = useState("");
  const [clave, setClave] = useState(nuevaClaveIdempotencia);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const enCurso = useRef(false);

  const esVenta = tipo === "venta";
  const verbo = esVenta ? "Restar" : "Sumar";

  function cambiar(setter: (v: string) => void, valor: string) {
    setter(valor);
    setError(null);
    setConfirmando(false);
    setClave(nuevaClaveIdempotencia()); // otro dato = otra operación
  }

  async function confirmar() {
    if (enCurso.current) return; // doble toque
    const c = parsearCantidad(cantidad);
    if (c.error !== null) return setError(c.error);
    const r = validarReferencia(referencia);
    if (r.error !== null) return setError(r.error);

    if (esVenta && ventaDejaNegativo(stockActual, c.valor) && !confirmando) {
      setConfirmando(true);
      return;
    }

    enCurso.current = true;
    setEnviando(true);
    setError(null);
    const respuesta = await registrarMovimiento({ itemId, tipo, cantidad: c.valor, idempotencyKey: clave, referencia: r.referencia });
    enCurso.current = false;
    setEnviando(false);
    if (respuesta.error !== null) return setError(respuesta.error);
    onHecho(respuesta.resultado);
  }

  const c = parsearCantidad(cantidad);
  const quedaria = c.error === null ? stockActual + (esVenta ? -c.valor : c.valor) : null;
  const pasar = (delta: number) => {
    const actual = c.error === null ? c.valor : 0;
    cambiar(setCantidad, String(Math.min(CANTIDAD_MAX, Math.max(1, actual + delta))));
  };

  return (
    <MarcoDialogo
      titulo={`${verbo} stock`}
      subtitulo={nombre}
      ocupado={enviando}
      onCerrar={onCerrar}
      pie={
        <div className="flex gap-2">
          <button type="button" disabled={enviando} onClick={onCerrar} className={`${CLASE_BOTON_SECUNDARIO} flex-1`}>
            Cancelar
          </button>
          <button type="button" disabled={enviando} onClick={confirmar} className={`${confirmando ? CLASE_BOTON_PELIGRO : CLASE_BOTON_PRIMARIO} flex-[2]`}>
            {enviando ? "Un momento..." : confirmando ? "Restar igual" : c.error === null ? `${verbo} ${c.valor}` : verbo}
          </button>
        </div>
      }
    >
      <label htmlFor={idCantidad} className="mb-1 block text-sm font-medium text-gray-700">
        Cantidad
      </label>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Una unidad menos" disabled={enviando || (c.valor ?? 0) <= 1} onClick={() => pasar(-1)} className={CLASE_PASO}>
          <span aria-hidden="true">−</span>
        </button>
        <input
          id={idCantidad}
          inputMode="numeric"
          autoComplete="off"
          value={cantidad}
          disabled={enviando}
          maxLength={String(CANTIDAD_MAX).length}
          onChange={(e) => cambiar(setCantidad, e.target.value)}
          className={`${CLASE_INPUT} text-center font-semibold tabular-nums`}
        />
        <button type="button" aria-label="Una unidad más" disabled={enviando || (c.valor ?? 0) >= CANTIDAD_MAX} onClick={() => pasar(1)} className={CLASE_PASO}>
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <p className={`mt-2 text-sm tabular-nums ${quedaria !== null && quedaria < 0 ? "font-medium text-red-700" : "text-gray-700"}`}>
        Hay {stockActual}
        {quedaria !== null && (
          <>
            {" → "}quedan <b>{quedaria < 0 ? `−${Math.abs(quedaria)}` : quedaria}</b>
          </>
        )}
      </p>
      <p className="mt-1 text-[13px] leading-snug text-gray-500">
        {esVenta ? "Se registra como venta. Para una rotura o un error de conteo, usá «Corregir stock» en el menú …" : "Se registra como ingreso de mercadería."}
      </p>

      <label htmlFor={idReferencia} className="mb-1 mt-3 block text-sm font-medium text-gray-700">
        Referencia <span className="font-normal text-gray-500">(opcional)</span>
      </label>
      <input
        id={idReferencia}
        autoComplete="off"
        value={referencia}
        disabled={enviando}
        maxLength={REFERENCIA_MAX}
        onChange={(e) => cambiar(setReferencia, e.target.value)}
        placeholder={esVenta ? "Cliente, presupuesto…" : "Remito, proveedor…"}
        className={CLASE_INPUT}
      />

      {confirmando && (
        <div role="alert" className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-semibold">Esto deja el stock en negativo.</p>
          <p>
            Hay {stockActual} y estás restando {c.valor}. Se puede hacer (por ejemplo si todavía no se cargó lo que llegó), pero queda marcado para revisarlo.
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-[#FDA29B] bg-[#FEF3F2] px-3 py-2 text-sm text-[#912018]">
          {error}
        </p>
      )}
    </MarcoDialogo>
  );
}
