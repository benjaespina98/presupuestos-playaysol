# QA visual de pantallas (PROMPT G)

Esta es la revisión hecha **mirando las capturas** (se abrió cada imagen con la herramienta de lectura de imágenes), no sólo los
números de los tests. Las capturas están en `capturas-locales/despues/<perfil>/<paso>.png` (carpeta ignorada por git, porque tienen datos
de la base local). Los nombres de los pasos son los de `docs/pantallas.md`.

**Cómo se hizo.** Dos rondas completas de `tests/local/recorrido.spec.ts` en los 10 perfiles (360×740, 390×844, 430×932, 768×1024,
1280×800, 1366×768, iPhone 13 en Chromium y en WebKit, y esos dos con el teléfono en modo oscuro). Se abrieron unas 110 capturas en total;
cada vez que apareció un problema se corrigió y se volvió a sacar la captura (la tabla dice qué se corrigió). Lo que NO se abrió
(sólo se midió con los chequeos automáticos) está listado al final.

Leyenda de tamaños abiertos: **360** = 360×740, **390** = 390×844 / iPhone 13, **430** = 430×932, **768** = tablet, **1366** = 1366×768,
**W** = iPhone 13 en WebKit, **Wo** = WebKit en modo oscuro.

## Veredicto por pantalla

| Pantalla / estado | Abiertas en | Qué se vio bien | Qué se corrigió tras mirarla |
|---|---|---|---|
| Login | 360, W, Wo | Tarjeta centrada, botón azul con texto blanco, campos con borde visible, foco claro. En modo oscuro idéntico al claro. | — |
| Login con error | 360 | Aviso rojo legible, el botón no se mueve. | — |
| Nuevo (5 tarjetas) | 390 | Tarjetas de 96 px, íconos con contraste. | El ícono usaba `text-[#244B5A]/70` (opacidad): pasó a un color sólido. |
| Calculadoras (piscinas, cercos, cobertores, revestimientos) | 360, 390 | Encabezado compacto, "Editar / Vista previa", barra de guardado fija abajo sin tapar campos al final. | — (el "Guardar" aparece dos veces al final: el de la barra fija y el del formulario; es el diseño de siempre). |
| Plano de losetas | 360, 390 | Secciones plegables, plano chico y legible. | — |
| Historial (celular) | 360, 430, 390 W | Una fila de 79–97 px por presupuesto, acciones de 44 px, cliente largo con elipsis, anulados con motivo. | Eran tarjetas de 176 px: ahora filas. El contador decía "de 13" contando anulados: ahora "de 11". |
| Historial (tablet y escritorio) | 768, 1366 | Tabla desde 1280 px; en tablet, la lista con acciones a la derecha. | En 768 px los encabezados de la tabla se pisaban ("Cliente" con "Detalle"): la tabla pasó a verse desde 1280 px. |
| Hoja de filtros (Historial, Precios, Materiales, Proveedores, Pedidos) | 360, 390, W, Wo | Encabezado y pie fijos, acordeones con opciones de 48 px y contadores, "Limpiar" legible aunque esté deshabilitado, "Ver N resultados" en una línea. | "Ver N resultados" se partía en dos líneas a 360 px: se ajustó la grilla del pie. |
| Filtros activos (chips) | 360 | Chips chicos con su "×" debajo de la barra, sólo si hay filtros; "5 presupuestos de 11". | El chip decía "Stock: Stock negativo": ahora "Stock negativo". |
| Precios (lista) | 360, 390, 430, 768, 1366, W | Barra de una fila (56 px), grupos con encabezado fijo de 36 px, filas de 59 px; con stock: nombre y stock arriba, precio, "Venta", "…" y lápiz abajo (83 px). | El precio quedaba tapado por "Venta" a 360 px (la fila se montaba): se rehízo la grilla de la fila. |
| Precios con filtros / stock negativo / vacío | 360, 768 | Contador "7 de 64 ítems", chips, estado vacío con "Limpiar filtros". | El contador usaba 65 (con el desactivado): ahora 64. |
| Menú de stock y de categoría | 360, 768, 1366 | Cinco opciones de stock con contadores y el negativo en rojo con ⚠. | — |
| Menú "⋯" de la fila, Venta, Ingreso, Ajustar, Historial de stock | 360 | Hojas con el teclado a un toque, botones de 48 px. | — |
| Agregar / Editar ítem | 360 | Secciones, Guardar siempre visible (deshabilitado pero legible sin cambios). | — |
| Materiales | 360, 430, 768, 1366 | Rubros con encabezado fijo, nombre en hasta 3 renglones, proveedor en gris, precio con unidad, lápiz de 44 px. | A 360 px el nombre se cortaba en 2 renglones ("Cable subterráneo 3 x…"): ahora 3. El buscador decía "Buscar materi…": ahora "Buscar". |
| Materiales con filtros, filtro de proveedor, desplazada, vacía | 360 | Selector de 17 proveedores dentro de la hoja, sin scroll anidado. | — |
| Editar / Agregar material, selector "Cuándo se pide" | 360, 430, 768, W, Wo | Secciones, cantidades por tamaño, selector en hoja con descripciones, Guardar fijo. | — |
| Proveedores | 360, 390, 1366 | Nombre y teléfono en dos renglones, "Falta teléfono" en ámbar, "+1 más". | El teléfono medía 44 px y abría una fila de 76 px: el área táctil se estiró con un pseudo-elemento y la fila bajó a 53 px. |
| Editar proveedor | 360 | Campos de 48 px, secciones. | — |
| Armar pedido | 360, 390, 430, 768, 1366 | Formulario, resumen, acciones y una tarjeta por proveedor con cantidades editables. | En celular los 5 botones quedaban sueltos y desparejos: ahora una grilla de dos columnas. Las líneas medían 190 px: ahora unos 130 px (nombre arriba, cantidad y subtotal, precio unitario y lápiz). En 768 px los encabezados "Artículo / Cantidad" se pisaban: las columnas pasan a verse desde 1024 px. La barra de acciones sólo se pega desde 1024 px. |
| Agregar material al pedido | 360 | Lista dentro de la hoja, sin scroll propio. | Tenía una lista con scroll vertical anidado: se quitó. |
| Menú Exportar | 360, 390 | Hoja inferior con PDF / Excel / CSV, "sin precios ni teléfonos". | — |
| Pedidos | 360, 768, 1366 | Número y fecha, obra, tamaño y costo, estado con color; tabla desde 1024. | "PED-0003" se partía en dos renglones a 360 px: no se parte. |
| Detalle de pedido | 360, 430, 1366 | Por proveedor: líneas con "cantidad × precio", subtotal, Descargar y Copiar mensaje. | Era una tabla de 30 rem dentro de una región con scroll horizontal (precios cortados): ahora una lista sin scroll lateral. |
| Anular (presupuesto y pedido) | 360 | Diálogo con motivo, botones de 48 px. | — |
| Encabezado y menú de usuario | todas | Logo y círculo de 44 px (el correo se ve desde 1024 px); en el menú, "Cerrar sesión". | El botón grande de "Cerrar sesión" ocupaba media fila: ahora un menú. |
| Pestañas de Compras | 360, 390, 430, 768, 1366 | Cuatro columnas del mismo ancho, ninguna cortada ("Armar pedido" en dos renglones a 360 px). | Se cortaban ("Ped…"). Precios ya no tiene pestañas. |
| Flecha "volver arriba" | 390, W | Sólo aparece al SUBIR, chica, abajo a la izquierda. | Quedaba quieta tapando la esquina de "Agregar otro material al pedido": ahora aparece al subir y se va a los 2,5 s. |
| Barra a 768 px | 768 | Una fila con menús, "+" compacto. | "Más filtros" quedaba debajo de "Agregar" cuando había un filtro activo: los menús se acortan con elipsis y "Agregar" es sólo "+" por debajo de 1024 px. |

## Lo que NO se abrió (sólo medido)

- **1280×800** y **iPhone 13 en Chromium (claro y oscuro)** casi no se abrieron: se midieron con los chequeos automáticos (que dieron lo
  mismo que los tamaños vecinos) pero no se miraron una por una.
- De los 10 perfiles, **ninguno es tu iPhone real** (ver el informe: hoja de compartir de iOS, teclado real, versión de iOS).

## Resultado numérico (antes → después, base local con datos del tamaño de producción)

| Pantalla | 390×844: bloque de herramientas (desde las pestañas hasta la lista) | 390×844: lista empieza en | 390×844: filas completas | 1366×768: barra + encabezado de tabla | 1366×768: filas completas |
|---|---|---|---|---|---|
| Precios | 184 → 88 px | 344 → 188 px | 8 → 10 | 148 → 100 px | 10 → 11 |
| Materiales | 185 → 89 px | 345 → 233 px | 6 → 6 (filas de 3 renglones) | 149 → 100 px | 11 → 11 |
| Proveedores | 185 → 89 px | 345 → 233 px | 7 → 11 | 149 → 100 px | 11 → 11 |
| Pedidos | 185 → 89 px | 345 → 233 px | 2 → 2 (hay 3 pedidos) | 149 → 100 px | 2 → 2 |
| Historial | 188 → 89 px | 296 → 189 px | 3 → 8 | 240 → 100 px | 7 → 8 |

Regiones con scroll horizontal por pantalla: 1–2 → 0. Scroll horizontal de la página: 0 antes y después (la medición anterior no lo habría visto
si lo hubiera: ver `docs/decisiones-tecnicas.md`, sección 14).
