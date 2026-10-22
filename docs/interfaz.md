# Interfaz: piezas compartidas

Dónde está cada pieza, para no reinventarla en la próxima pantalla.

| Pieza | Archivo | Para qué |
|---|---|---|
| Colores de marca | `app/globals.css` (`@theme`) | `marca` (#244B5A), `marca-oscuro`, `acento` (#FFC629), `celeste` (#16819A). Se usan como `bg-marca`, `text-marca`, `ring-celeste/40`. |
| Interacción global | `app/globals.css` | Cursor de mano, foco visible (`:focus-visible`), estado "hundido" al apretar, combos con flecha propia, 16 px en campos de texto en el celular (evita el zoom de iOS), `prefers-reduced-motion`. |
| Botones | `components/ui/botones.ts` | `botonDe("primario" \| "secundario" \| "suave" \| "peligro", extra)`. Todos de 44 px de alto como mínimo. |
| Hoja | `components/ui/Hoja.tsx` | Todo formulario o diálogo. Celular: hoja inferior con encabezado y pie fijos y sólo el cuerpo con scroll; escritorio: modal centrado. Avisa si se cierra con cambios sin guardar (`hayCambios`). `PieAcciones` es el pie estándar (Cancelar y Guardar). |
| Menú de acciones | `components/ui/MenuAcciones.tsx` | El botón "⋯" con un menú (se dibuja en el `<body>`, no lo recorta ningún `overflow`). |
| Filtros plegables | `components/ui/FiltrosPlegables.tsx` | `Buscador` (con botón de limpiar) y `FiltrosPlegables`: en el celular, el buscador y un botón "Filtros" con la cantidad de filtros activos; en escritorio, todo a la vista. |
| Estado que se conserva | `lib/useEstadoPersistente.ts` | Como `useState`, pero guardado en `sessionStorage`: la búsqueda y los filtros siguen ahí al abrir un detalle y volver. |

## Reglas que se siguen

- Toda fila que abre algo es un botón entero (no un lápiz suelto): materiales y proveedores.
- En el catálogo de precios, una acción principal a la vista (Venta) y el resto en el menú "⋯".
- Un formulario tiene lo esencial a la vista y lo demás en "Más opciones" (cerrado por defecto).
- "Desactivar" va separado, al final, con una explicación de una línea. Nada se borra.
- Los tests que miran filtros guardados limpian `sessionStorage` solos (`tests/setup-jsdom.ts`).

## Cómo se mide

`node scripts/e2e-local.mjs relevamiento` (con `E2E_FASE=antes|despues`) recorre todas las pantallas en 390×844 y
1280×800 con la base local, saca capturas en `capturas-locales/<fase>/<viewport>/` (ignorada por git) y escribe
`_medidas.txt`: filas visibles sin scroll, zonas táctiles de menos de 44 px, scroll horizontal y si los formularios
de Material y Proveedor entran sin scroll con Guardar a la vista.
