"use client";

import { useId, useMemo, useState } from "react";
import type { Material } from "@/lib/domain/abastecimiento/material";
import { Hoja } from "@/components/ui/Hoja";
import { botonDe } from "@/components/ui/botones";
import { NumberInput } from "@/components/form/NumberInput";

/**
 * "Agregar material al pedido": se elige uno de los materiales activos que todavía no están en el pedido y se
 * le pone la cantidad. Es un ajuste manual más (como cambiar una cantidad o quitar una línea): no toca el cálculo
 * ni los datos del material. Con muchos materiales, un buscador arriba de la lista.
 */
export function AgregarMaterial({
  disponibles,
  nombreProveedor,
  onAgregar,
  onClose,
}: {
  disponibles: Material[];
  nombreProveedor: (m: Material) => string;
  onAgregar: (material: Material, cantidad: number) => void;
  onClose: () => void;
}) {
  const idBusqueda = useId();
  const [q, setQ] = useState("");
  const [elegido, setElegido] = useState<Material | null>(null);
  const [cantidad, setCantidad] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? disponibles.filter((m) => `${m.nombre} ${nombreProveedor(m)}`.toLowerCase().includes(t)) : disponibles;
  }, [disponibles, q, nombreProveedor]);

  function agregar() {
    if (!elegido) return setError("Elegí un material de la lista.");
    if (cantidad === null || !(cantidad > 0)) return setError("Poné una cantidad mayor a 0.");
    onAgregar(elegido, cantidad);
  }

  return (
    <Hoja
      titulo="Agregar material al pedido"
      subtitulo="Para algo que la cuenta no pide pero hace falta en esta obra."
      ancho="lg"
      alto="completo"
      hayCambios={elegido !== null}
      onCerrar={onClose}
      aviso={
        error ? (
          <p role="alert" className="rounded-lg border border-[#FDA29B] bg-[#FEF3F2] px-3 py-2 text-[15px] font-medium text-[#B42318]">
            {error}
          </p>
        ) : undefined
      }
      pie={
        <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-end">
          <button type="button" onClick={onClose} className={botonDe("secundario", "min-h-12 sm:min-w-32")}>
            Cancelar
          </button>
          <button type="button" onClick={agregar} disabled={!elegido} className={botonDe("primario", "min-h-12 sm:min-w-44")}>
            Agregar al pedido
          </button>
        </div>
      }
    >
      {disponibles.length === 0 ? (
        <p className="py-6 text-center text-base text-[#3E4A52]">Ya están todos los materiales activos en el pedido.</p>
      ) : (
        <div className="space-y-4">
          <div>
            <label htmlFor={idBusqueda} className="mb-1.5 block text-[15px] font-medium text-[#1F2A30]">
              Material
            </label>
            <input
              id={idBusqueda}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre o proveedor…"
              className="min-h-12 w-full rounded-lg border bg-[#FFFFFF] px-3 text-base"
            />
          </div>
          <ul role="listbox" aria-label="Materiales que se pueden agregar" className="max-h-64 divide-y divide-[#EEF1F3] overflow-y-auto rounded-xl border border-[#D9DFE3]">
            {visibles.map((m) => {
              const actual = elegido?.id === m.id;
              return (
                <li key={m.id} role="option" aria-selected={actual}>
                  <button
                    type="button"
                    onClick={() => {
                      setElegido(m);
                      setError(null);
                    }}
                    className={`flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left hover:bg-[#EAF0F2] active:bg-[#D5E0E4] ${actual ? "bg-[#F1F6F8]" : ""}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className={`block break-words text-base text-[#1F2A30] ${actual ? "font-semibold" : ""}`}>{m.nombre}</span>
                      <span className="block break-words text-[13px] text-[#4A5861]">{nombreProveedor(m)}</span>
                    </span>
                    <span aria-hidden="true" className={`w-5 shrink-0 text-lg text-[#244B5A] ${actual ? "" : "invisible"}`}>
                      ✓
                    </span>
                  </button>
                </li>
              );
            })}
            {visibles.length === 0 && <li className="px-4 py-6 text-center text-sm text-[#4A5861]">Ningún material coincide.</li>}
          </ul>

          {elegido && (
            <div>
              <label htmlFor={`${idBusqueda}-cantidad`} className="mb-1.5 block text-[15px] font-medium text-[#1F2A30]">
                Cantidad{elegido.unidad ? <span className="font-normal text-[#4A5861]"> · en {elegido.unidad}</span> : null}
              </label>
              <NumberInput
                id={`${idBusqueda}-cantidad`}
                value={cantidad}
                onValueChange={(v) => {
                  setCantidad(v);
                  setError(null);
                }}
                emptyValue="null"
                placeholder="0"
              />
            </div>
          )}
        </div>
      )}
    </Hoja>
  );
}
