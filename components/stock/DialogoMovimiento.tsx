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

/**
 * Ingreso o venta de unidades de un ítem que lleva stock.
 *
 * - La CLAVE de idempotencia se genera una vez al abrir el diálogo y se reutiliza
 *   en los reintentos (un toque doble o un reintento tras un corte no cuentan dos
 *   veces). Si la persona CAMBIA un dato, es otra operación: clave nueva.
 * - Una venta que deja el stock por debajo de 0 se permite, pero primero pide
 *   confirmación explícita.
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
  const [cantidad, setCantidad] = useState("");
  const [referencia, setReferencia] = useState("");
  const [clave, setClave] = useState(nuevaClaveIdempotencia);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const enCurso = useRef(false);

  const esVenta = tipo === "venta";
  const titulo = esVenta ? "Registrar venta" : "Registrar ingreso";

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

  return (
    <MarcoDialogo titulo={titulo} subtitulo={`${nombre} · hoy hay ${stockActual}`} ocupado={enviando} onCerrar={onCerrar}>
      <label htmlFor={idCantidad} className="mb-1 block text-sm font-medium text-gray-700">
        Cantidad
      </label>
      <input
        id={idCantidad}
        autoFocus
        inputMode="numeric"
        autoComplete="off"
        value={cantidad}
        disabled={enviando}
        maxLength={String(CANTIDAD_MAX).length}
        onChange={(e) => cambiar(setCantidad, e.target.value)}
        placeholder="Unidades"
        className={CLASE_INPUT}
      />
      {quedaria !== null && (
        <p className={`mt-1 text-sm ${quedaria < 0 ? "font-medium text-red-700" : "text-gray-500"}`}>
          Quedaría en {quedaria < 0 ? `−${Math.abs(quedaria)}` : quedaria}
        </p>
      )}

      <label htmlFor={idReferencia} className="mb-1 mt-3 block text-sm font-medium text-gray-700">
        Referencia <span className="font-normal text-gray-400">(opcional)</span>
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
            Hoy hay {stockActual} y estás vendiendo {c.valor}. Se puede hacer (por ejemplo si todavía no se cargó un ingreso), pero queda marcado para
            revisarlo.
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2">
        <button type="button" disabled={enviando} onClick={confirmar} className={confirmando ? CLASE_BOTON_PELIGRO : CLASE_BOTON_PRIMARIO}>
          {enviando ? "Un momento..." : confirmando ? "Vender igual" : esVenta ? "Registrar venta" : "Registrar ingreso"}
        </button>
        <button type="button" disabled={enviando} onClick={onCerrar} className={CLASE_BOTON_SECUNDARIO}>
          Cancelar
        </button>
      </div>
    </MarcoDialogo>
  );
}
