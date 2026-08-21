// Estructura común a todos los campos: label + control + error, con el mismo
// espaciado y tipografía en todos lados. Existe para que un formulario de la
// Fase 4 no tenga que reinventar "¿cuánto margen lleva el label?" por cada
// campo — es la única pieza de layout que TextField/MoneyField/etc. comparten.
//
// Mobile-first a propósito: label arriba del control (nunca al costado, que en
// una pantalla angosta fuerza el control a un ancho incómodo), texto de error
// visible sin tener que tocar nada, y el control ocupa todo el ancho
// disponible para que el área táctil sea grande.
export function FieldShell({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-0.5">
        {/* El asterisco queda FUERA de <label> a propósito: si estuviera adentro,
            `getByLabelText`/el nombre accesible del campo pasarían a incluirlo
            (aria-hidden no lo saca del textContent), y "Largo (m)" dejaría de
            matchear con "Largo (m) *" — rompería cualquier test o software de
            accesibilidad que busque el campo por su label real. */}
        <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        {required && (
          <span className="text-red-600" aria-hidden="true">
            *
          </span>
        )}
      </div>
      {children}
      {hint && !error && (
        <p id={hintId} className="text-xs text-gray-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/** IDs para `aria-describedby`: null si no hay nada que describir, para no
 *  meter un `aria-describedby=""` vacío en el DOM. */
export function describedBy(htmlFor: string, hint?: string, error?: string): string | undefined {
  const ids = [error ? `${htmlFor}-error` : null, hint && !error ? `${htmlFor}-hint` : null].filter(
    Boolean
  );
  return ids.length ? ids.join(" ") : undefined;
}
