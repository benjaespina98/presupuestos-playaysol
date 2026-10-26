"use client";

import { useEffect, useRef, useState } from "react";
import { anularMovimiento, listarMovimientos } from "@/lib/stock";
import {
  ETIQUETA_TIPO,
  cantidadConSigno,
  esAnulable,
  motivoNoAnulable,
  nuevaClaveIdempotencia,
  type MovimientoVista,
  type ResultadoStock,
} from "@/lib/domain/stock/movimientos";
import { AnularDialog } from "@/components/AnularDialog";
import { CLASE_BOTON_SECUNDARIO, MarcoDialogo } from "./MarcoDialogo";

function fechaHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * El historial de movimientos de un ítem que lleva stock: fecha, tipo, cantidad,
 * saldo, quién, motivo y referencia. Lo anulado se tacha y lleva su etiqueta; la
 * anulación (contra-asiento) se muestra como otra fila. Desde acá se anula un
 * movimiento con motivo (el libro nunca se edita ni se borra).
 */
export function HistorialStock({
  itemId,
  nombre,
  onCerrar,
  onStockCambiado,
}: {
  itemId: string;
  nombre: string;
  onCerrar: () => void;
  /** Se anuló un movimiento: el stock cambió. */
  onStockCambiado: (resultado: ResultadoStock) => void;
}) {
  const [movimientos, setMovimientos] = useState<MovimientoVista[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [porAnular, setPorAnular] = useState<MovimientoVista | null>(null);
  // La clave se reutiliza mientras el motivo no cambie (un reintento no anula dos veces).
  const ultimaClave = useRef<{ movimiento: string; motivo: string; clave: string } | null>(null);

  async function cargar() {
    const r = await listarMovimientos(itemId);
    if (r.error !== null) setError(r.error);
    else {
      setError(null);
      setMovimientos(r.movimientos);
    }
  }

  useEffect(() => {
    let cancelado = false;
    listarMovimientos(itemId).then((r) => {
      if (cancelado) return;
      if (r.error !== null) setError(r.error);
      else setMovimientos(r.movimientos);
    });
    return () => {
      cancelado = true;
    };
  }, [itemId]);

  async function confirmarAnulacion(motivo: string): Promise<string | null> {
    if (!porAnular) return null;
    const previa = ultimaClave.current;
    const clave =
      previa && previa.movimiento === porAnular.id && previa.motivo === motivo ? previa.clave : nuevaClaveIdempotencia();
    ultimaClave.current = { movimiento: porAnular.id, motivo, clave };

    const r = await anularMovimiento({ movimientoId: porAnular.id, motivo, idempotencyKey: clave });
    if (r.error !== null) return r.error;
    setPorAnular(null);
    onStockCambiado(r.resultado);
    await cargar();
    return null;
  }

  return (
    <MarcoDialogo
      titulo="Movimientos de stock"
      subtitulo={nombre}
      ancho="sm:max-w-2xl"
      onCerrar={onCerrar}
      pie={
        <button type="button" onClick={onCerrar} className={CLASE_BOTON_SECUNDARIO}>
          Cerrar
        </button>
      }
    >
      {error && (
        <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {!error && movimientos === null && <p className="text-sm text-gray-500">Cargando…</p>}
      {movimientos && movimientos.length === 0 && (
        <p className="rounded-md border border-dashed border-gray-300 px-3 py-6 text-center text-sm text-gray-500">
          Todavía no hay movimientos de este ítem.
        </p>
      )}

      {movimientos && movimientos.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
          {movimientos.map((m) => {
            const negativo = m.stock_resultante < 0;
            const noAnulable = motivoNoAnulable(m);
            return (
              <li key={m.id} className={`px-3 py-3 text-sm ${m.anulado ? "bg-gray-50 text-gray-500" : ""}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="font-semibold text-gray-900">
                    <span className={m.anulado ? "line-through" : ""}>{ETIQUETA_TIPO[m.tipo]}</span>{" "}
                    <span className={`tabular-nums ${m.cantidad < 0 ? "text-red-700" : "text-green-700"} ${m.anulado ? "line-through" : ""}`}>
                      {cantidadConSigno(m.cantidad)}
                    </span>
                    {m.anulado && (
                      <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 align-middle text-xs font-medium text-red-700">Anulado</span>
                    )}
                    {m.tipo === "anulacion" && (
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 align-middle text-xs font-medium text-gray-600">Contra-asiento</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">{fechaHora(m.creado_at)}</p>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  Saldo:{" "}
                  <span className={`font-medium tabular-nums ${negativo ? "text-red-700" : "text-gray-700"}`}>
                    {negativo ? `−${Math.abs(m.stock_resultante)} (negativo)` : m.stock_resultante}
                  </span>
                  {" · "}
                  {m.creadorNombre ?? "—"}
                </p>
                {m.motivo && <p className="mt-0.5 text-xs text-gray-600">Motivo: {m.motivo}</p>}
                {m.referencia && <p className="mt-0.5 text-xs text-gray-600">Referencia: {m.referencia}</p>}
                <div className="mt-1.5">
                  {esAnulable(m) ? (
                    <button
                      type="button"
                      onClick={() => setPorAnular(m)}
                      className="min-h-11 rounded-md border border-red-200 px-3 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Anular
                    </button>
                  ) : (
                    noAnulable && <p className="text-xs text-gray-400">{noAnulable}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AnularDialog
        open={porAnular !== null}
        titulo="Anular movimiento"
        mensaje={
          porAnular
            ? `Vas a anular ${ETIQUETA_TIPO[porAnular.tipo].toLowerCase()} de ${cantidadConSigno(porAnular.cantidad)}. No se borra: se agrega un contra-asiento que deja el stock como estaba.`
            : ""
        }
        onConfirmar={confirmarAnulacion}
        onCancel={() => setPorAnular(null)}
      />
    </MarcoDialogo>
  );
}
