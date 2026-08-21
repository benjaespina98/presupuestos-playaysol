/**
 * Aclara qué significa el asterisco rojo que `FieldShell` dibuja junto a los
 * campos obligatorios (ver `required` en components/form/FieldShell.tsx).
 * Sin esto, el asterisco aparece sin ninguna leyenda que lo explique en
 * ningún lado de la pantalla.
 */
export function CamposObligatoriosHint() {
  return (
    <p className="text-xs text-gray-500">
      <span className="text-red-600" aria-hidden="true">
        *
      </span>{" "}
      Campos obligatorios
    </p>
  );
}
