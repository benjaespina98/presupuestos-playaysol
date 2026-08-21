"use client";

import { useEffect, useRef, useState } from "react";

/**
 * El motor detrás de MoneyInput y NumberField: un input de texto que muestra
 * un número formateado (con separadores, símbolo, lo que sea) pero cuyo dato
 * real es siempre `number | null`.
 *
 * Se comparte entre los dos porque la única diferencia entre "$ 1.500.000" y
 * "1.500,5" es qué formatter/parser se le pasa — el problema de fondo (cursor,
 * foco, cuándo reformatear) es el mismo, y es justo el que no hay que resolver
 * dos veces.
 *
 * ── La regla que evita que el cursor salte ──────────────────────────────────
 * Mientras el campo tiene foco, el texto en pantalla es EXACTAMENTE lo que la
 * persona tipeó — nunca se reescribe. React no mueve el cursor de un input
 * controlado si el valor no cambió respecto de lo que ya había en el DOM, así
 * que con no tocar `texto` alcanza. El formato "bonito" (con `$` y puntos de
 * miles) se aplica recién al perder el foco, cuando ya no importa el cursor.
 *
 * ── Por qué el valor semántico se separa del texto ─────────────────────────
 * `texto` puede ser cualquier cosa a medio tipear ("1.5", "$ 1", "-"). El valor
 * que sale por `onValueChange` es siempre lo que ese texto significa HOY según
 * `parse`, o `null`/`0` si está vacío. Son dos relojes distintos: uno de
 * presentación, uno de dato.
 */
export interface UseMaskedNumberInputOptions {
  /** Valor semántico actual, controlado por quien usa el hook (típicamente
   *  React Hook Form). */
  value: number | null;
  onValueChange: (value: number | null) => void;
  /** Cómo se ve el número cuando el campo NO tiene foco. */
  format: (value: number | null) => string;
  /** Cómo se interpreta el texto tipeado. Normalmente `parseARS`. */
  parse: (texto: string) => number | null;
  /** Qué significa "campo vacío": `null` ("a cotizar", precios) o `0`
   *  (medidas, cantidades). Default: "null". */
  emptyValue?: "null" | "zero";
}

export function useMaskedNumberInput({
  value,
  onValueChange,
  format,
  parse,
  emptyValue = "null",
}: UseMaskedNumberInputOptions) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(() => format(value));

  // Si el valor cambia desde afuera (reset del form, carga de datos) mientras
  // el campo no se está editando, el texto tiene que seguirlo. Si se está
  // editando, no: sería justo el reformateo que le mueve el cursor a quien
  // está tipeando.
  const valorPrevio = useRef(value);
  useEffect(() => {
    if (editando) return;
    if (valorPrevio.current === value && texto === format(value)) return;
    valorPrevio.current = value;
    setTexto(format(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editando]);

  function vacioA(): number | null {
    return emptyValue === "zero" ? 0 : null;
  }

  function handleChange(raw: string) {
    setTexto(raw);
    const limpio = raw.trim();
    const parsed = limpio === "" ? vacioA() : parse(raw);
    valorPrevio.current = parsed;
    onValueChange(parsed);
  }

  function handleFocus() {
    setEditando(true);
  }

  function handleBlur() {
    setEditando(false);
    const limpio = texto.trim();
    const parsed = limpio === "" ? vacioA() : (parse(texto) ?? vacioA());
    valorPrevio.current = parsed;
    onValueChange(parsed);
    setTexto(format(parsed));
  }

  return {
    texto,
    handleChange,
    handleFocus,
    handleBlur,
  };
}
