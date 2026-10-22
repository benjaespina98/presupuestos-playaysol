# Interfaz: piezas compartidas

Dónde está cada pieza, para no reinventarla en la próxima pantalla.

| Pieza | Archivo | Para qué |
|---|---|---|
| Colores de marca | `app/globals.css` (`@theme`) | `marca` (#244B5A), `marca-oscuro`, `acento` (#FFC629), `celeste` (#16819A). Se usan como `bg-marca`, `text-marca`, `ring-celeste/40`. |
| Interacción global | `app/globals.css` | Cursor de mano, foco visible (`:focus-visible`), estado "hundido" al apretar, combos con flecha propia, 16 px en campos de texto en el celular (evita el zoom de iOS), `prefers-reduced-motion`. |
| Botones | `components/ui/botones.ts` | `botonDe("primario" \| "secundario" \| "suave" \| "peligro", extra)`. Todos de 44 px de alto como mínimo. |
| Hoja | `components/ui/Hoja.tsx` | Todo formulario o diálogo. Celular: hoja inferior con encabezado y pie fijos y sólo el cuerpo con scroll; escritorio: modal centrado. Avisa si se cierra con cambios sin guardar (`hayCambios`). `PieAcciones` es el pie estándar (Cancelar y Guardar). |
| Menú de acciones | `components/ui/MenuAcciones.tsx` | El botón "⋯" con un menú (se dibuja en el `<body>`, no lo recorta ningún `overflow`). |
| Buscador | `components/ui/FiltrosPlegables.tsx` | `Buscador`: el campo de búsqueda con su botón de limpiar (lo usa la barra de herramientas). |
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

## Piezas nuevas (corrección tras la prueba en el celular)

| Pieza | Archivo | Para qué |
|---|---|---|
| Barra de herramientas | `components/ui/BarraHerramientas.tsx` | LA barra de todas las listas (ver abajo). Las piezas sueltas (menú de opciones, interruptor, panel, aviso) están en `components/ui/BarraListado.tsx`. |
| Orden | `lib/ordenar.ts` | Nombre, Precio, Stock, Actualizado (ascendente y descendente). Sólo reordena lo mostrado; "Orden actual" es el de siempre. |
| Lápiz de fila | `components/ui/BotonLapiz.tsx` | 44×44, `Editar <nombre>`. `alTocarFila` hace que tocar la fila entera también abra la edición, pero no los toques sobre links, botones o campos. |
| Selector propio | `components/ui/SelectorHoja.tsx` + `components/form/SelectField.tsx` | Lista en hoja inferior (opciones de 48 px, tilde en la actual, cierra al elegir; con buscador si hay más de 8). Debajo hay un `<select>` real oculto cableado a React Hook Form. |
| Secciones de formulario | `components/ui/SeccionForm.tsx` | `Seccion`, `SeccionPlegable` ("Notas"), `ZonaActivo` e `InfoPopover` (la explicación larga va en un ícono "i", en el formulario queda una línea). |
| Hoja | `components/ui/Hoja.tsx` | 92 % de la altura en celular, encabezado con título grande + subtítulo con el nombre del ítem + cerrar de 44 px, pie fijo con Cancelar y Guardar del mismo ancho (48 px). Guardar sin cambios queda deshabilitado pero legible. Se acota al área visible (`visualViewport`): con el teclado abierto el pie no se tapa. |

### Reglas que se siguen (y se miden)

- **Colores de los controles**: valores fijos, sin variables de tema ni opacidad (`bg-marca/8` se resuelve con `color-mix`, que
  los Safari viejos no entienden y dejan el fondo transparente: texto blanco sobre blanco). Primario `#244B5A` con texto blanco;
  secundario con borde `#244B5A` y texto `#1A3844`; deshabilitado `#D9DFE3` con texto `#3E4A52` (nunca `opacity-50`);
  destructivo `#B42318`. Están en `components/ui/botones.ts`.
- **Tipografía**: nada visible por debajo de 13 px (`text-xs` vale 13 px en todo el portal); campos y botones de 16 px en
  celular; etiquetas de 15 px.
- **Zonas táctiles** de al menos 44 px (48 px dentro de las hojas); todo lo que se toca muestra la manito en escritorio.
- **Los precios y el costo estimado son internos**: se ven en la app, pero NINGUNA salida de un pedido (PDF, Excel, ZIP, CSV,
  mensaje, copiar, compartir, imprimir) los lleva, ni teléfonos, ni notas internas (`paraSalida` en
  `lib/domain/abastecimiento/pedidoDocumento.ts`; lo prueba `tests/unit/pedidos-sin-datos-internos.test.ts`).
- **Menú**: "Precios" (lo que se le cobra al cliente) y "Compras" (materiales, proveedores, armar pedido, pedidos). Las rutas
  siguen siendo `/dashboard/catalogo/...`.

### Cómo se mide ahora

`node scripts/e2e-local.mjs pantallas` corre, en 360×740, 390×844, 430×932, 768×1024, 1280×800, 1366×768 y el iPhone 13
emulado (Chromium y WebKit): `recorrido` (contraste ≥ 4,5:1 en texto y ≥ 3:1 en íconos y bordes contra el fondo real, textos
menores a 13 px, zonas táctiles menores a 44 px, cursor, scroll horizontal), `edicion` (lápiz, Guardar visible con el teclado
abierto, cantidades por tamaño), `compartir` (Compartir / Descargar / Copiar de un proveedor) y `documentos` (textos largos del
cliente en la vista previa). Con `E2E_FASE=antes|despues` guarda el informe y las capturas en `capturas-locales/<fase>/<proyecto>/`.

## Barra de herramientas única (PROMPT G)

`BarraHerramientas` es la barra de TODAS las listas (Precios, Materiales, Proveedores, Pedidos, Historial): cada pantalla le pasa
sus filtros (`secciones`), interruptores, orden, el botón de agregar y los contadores; ella decide cómo se ve.

- **Celular (hasta 767 px)**: una fila de 56 px: buscador, "Filtros" (con el contador de filtros activos) y un "+" de 44×44.
  Todos los filtros están en una hoja inferior (92 % de la altura, encabezado y pie fijos, un acordeón por filtro con opciones de
  48 px y contadores, "Limpiar" y "Ver N resultados"; los cambios se aplican en vivo). Los filtros activos se ven debajo de la barra
  como chips chicos que hacen salto de línea, cada uno con su "×", y sólo si hay. Después, el contador ("12 de 65 ítems").
- **Escritorio (768 px o más)**: una fila de 64 px: buscador, un menú por filtro (con contadores), orden, "Más filtros" (los
  interruptores) y "Agregar" a la derecha. Las acciones secundarias ("Planilla de costos") entran como botón desde 1024 px; más
  angosto, van dentro de "Más filtros". Los chips no se usan en escritorio: seis opciones nunca caben junto al resto de la barra
  sin scroll, así que son menús.
- La barra queda pegada arriba al bajar y publica su alto en `--catalogo-barra`; los encabezados de grupo (36 px) y el de la tabla
  se pegan justo debajo. La lista usa el scroll de la página (ningún scroll vertical anidado).
- Una sola versión se dibuja a la vez (`lib/useMediaQuery.ts`); en las pruebas con jsdom, que no tiene `matchMedia`, es la de escritorio.
- El filtro de fecha (`lib/filtroFecha.ts`: últimos 7, 30 y 90 días, este año) lo usan Pedidos e Historial.

### Encabezado y pestañas (celular)

El encabezado mide 52 px (logo y menú de usuario con "Cerrar sesión" adentro) y debajo van Nuevo · Historial · Precios · Compras en
una fila de 48 px que reparte el ancho. Las pestañas de Compras son cuatro columnas del mismo ancho de 44 px ("Armar pedido" hace
salto de línea): nunca quedan cortadas ni hay que deslizarlas. Precios es una sola pantalla y no lleva pestañas.
*Decisión tomada:* el encabezado no se oculta al bajar (ocupa 52 px y se va con el scroll; la barra de herramientas es lo único fijo).

### Gestos y scroll

Toda región que se desliza de costado usa la clase `scroll-h` (`app/globals.css`): `overflow-x: auto`, `overflow-y: hidden`,
`touch-action: pan-x pan-y`, `overscroll-behavior-x: contain`, `-webkit-overflow-scrolling: touch`. `tests/local/gestos.spec.ts`
prueba con toques reales (Chromium) que un deslizamiento vertical sobre la barra, el contador, las pestañas o una fila mueve la
página, que uno horizontal sobre una región `scroll-h` mueve sólo la región, y (también en WebKit) el contrato de CSS.

### Compatibilidad con Safari de iOS

Auditoría del CSS compilado (ver `docs/decisiones-tecnicas.md`, sección 14): colores sólidos para todo lo crítico (sin `color-mix`
ni opacidades en botones, texto y bordes), `dvh` con respaldo en `vh` (`pys-min-h-pantalla`, `pys-max-h-*`), áreas seguras en los
costados (`viewport-fit=cover`), `color-scheme: light` (también en el `<meta>`), `-webkit-appearance: none` en botones y campos y
`-webkit-text-fill-color` en los deshabilitados.

### Cómo se mide ahora (G)

`node scripts/e2e-local.mjs recorrido` mide en 10 perfiles (6 tamaños, iPhone 13 en Chromium y WebKit, y los dos en modo oscuro), por
cada pantalla y estado: contraste, textos menores a 13 px, zonas táctiles menores a 44 px, scroll horizontal de la página (contra el
ancho del DISPOSITIVO: Safari achica una página más ancha y `innerWidth` no lo mostraba), textos cortados sin elipsis, solapes,
controles tapados por algo fijo o flotante y controles fuera de la pantalla. `autoprueba` comprueba que esos chequeos de verdad
encuentran cada falla; `estados` lleva cada control a hover, foco, apretado y deshabilitado (claro y oscuro); `gestos` prueba los
deslizamientos; `metricas` mide alto de barra, inicio de la lista y filas completas. `node scripts/e2e-local.mjs servir` deja el portal y la
base locales levantados para trabajar a mano (`node scripts/e2e-contra-servidor.mjs <spec>` corre una prueba contra ese portal).
