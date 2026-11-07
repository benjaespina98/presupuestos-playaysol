# Inventario de pantallas y estados

La lista de TODO lo que se ve en el portal. Es la base de la revisión visual (`docs/qa-pantallas.md`) y del recorrido
automático (`tests/local/recorrido.spec.ts`, `tests/local/chequeos.spec.ts`): cada fila se abre en cada tamaño de
pantalla (360×740, 390×844, 430×932, 768×1024, 1280×800, 1366×768 y el iPhone 13 emulado en Chromium y WebKit).

Los nombres de la columna "Paso" son los de las capturas (`capturas-locales/<fase>/<proyecto>/<paso>.png`, carpeta
ignorada por git).

## 1. Sin sesión

| Paso | Pantalla / estado | Ruta |
|---|---|---|
| `login` | Ingreso (correo, contraseña, "Ingresar") | `/login` |
| `login-error` | Ingreso con credenciales incorrectas (aviso de error) | `/login` |
| (redirección) | Cualquier ruta protegida sin sesión lleva a `/login` | `/dashboard/*` |

## 2. Inicio y presupuestos

| Paso | Pantalla / estado | Ruta |
|---|---|---|
| `inicio` | Buscador general y una tarjeta por área (Presupuestos, Plano de piscina, Precios, Stock Indusplast con su resumen, Compras). Sin datos de clientes hasta que se busca | `/dashboard` |
| (estados) | Resultados por grupo, sin coincidencias, alguna fuente sin leer, cargando | |
| `inicio-nuevo` | Elegir el tipo de trabajo (4 tarjetas: el plano de piscina tiene la suya en Inicio) | `/dashboard/nuevo` |
| `calc-piscinas` | Piscinas: formulario + documento, barra de guardado, vista previa móvil | `/dashboard/piscinas` |
| `calc-cercos` | Cercos | `/dashboard/cercos` |
| `calc-cobertores` | Cobertores | `/dashboard/cobertores` |
| `calc-revestimientos` | Revestimientos | `/dashboard/revestimientos` |
| `calc-losetas` | Plano de piscina (losetas): formulario, dibujo del plano, fotos | `/dashboard/losetas` |
| (estados) | Cargando (esqueleto), "Duplicar el último", textos del documento editables, fotos, error al guardar | las cinco |

## 3. Historial

| Paso | Pantalla / estado | Ruta |
|---|---|---|
| `historial` | Lista de presupuestos (tarjetas en celular, tabla desde 640 px) | `/dashboard/historial` |
| `historial-filtros` | Hoja / panel de filtros | |
| `historial-anular` | Diálogo "Anular presupuesto" (motivo) | |
| (estados) | Vacío, "Ningún presupuesto coincide", error de carga, cargando, con anulados | |

## 4. Precios (precios de venta)

| Paso | Pantalla / estado | Ruta |
|---|---|---|
| `catalogo-precios` | Lista agrupada por modelo / sección, con stock | `/dashboard/catalogo` |
| `catalogo-filtros` | Hoja / panel de filtros (categoría, stock, orden, interruptores) | |
| `catalogo-menu-stock`, `catalogo-menu-orden` | Menús de stock y de orden (escritorio) | |
| `catalogo-agregar-item`, `catalogo-editar-item` | Hoja de alta y de edición de un ítem | |
| (estados) | Vacío por filtro de stock, error, cargando, modo consulta rápida, "Se guardó…" (aviso). El stock se ve, pero no se mueve acá | |

## 4b. Stock (piscinas Indusplast)

| Paso | Pantalla / estado | Ruta |
|---|---|---|
| `stock` | Buscador, filtros rápidos con contador (Todas, Con stock, Agotadas, Negativas), resumen y lista por modelo con − número + | `/dashboard/stock` |
| `stock-agotadas`, `stock-vacio` | Filtro aplicado y sin coincidencias | |
| `stock-menu-fila` | Menú "…" de la fila (Corregir stock, Ver movimientos) | |
| `stock-venta`, `stock-ingreso`, `stock-ajuste`, `stock-historial` | Diálogos de stock | |
| (estados) | Cargando, error, nada con stock, aviso de stock negativo, "Stock de …" (aviso) | |
| `stock-movimientos` | Pestaña Movimientos: período (Hoy, 7 días, 30 días, Todo), tipo, métricas (vendidas, ingresadas, movimientos, sin stock ahora), más vendidas, quién movió stock, cuándo se agotó cada modelo y el registro con fecha, persona, cantidad y saldo | `/dashboard/stock/movimientos` |
| `actividad` | Registro de todo lo que se hizo en el portal (precios, stock, presupuestos, pedidos, compras) con quién y cuándo; lo que no hizo una persona figura como Sistema. Filtros por área y por persona/sistema | `/dashboard/actividad` (menú de la cuenta) |

## 5. Compras

| Paso | Pantalla / estado | Ruta |
|---|---|---|
| `catalogo-materiales` | Materiales (lista por rubro) | `/dashboard/catalogo/materiales` |
| `materiales-filtros`, `materiales-menu-proveedor` | Filtros y selector de proveedor | |
| `material-nuevo`, `material-editar` | Hoja del material (secciones, cantidades por tamaño) | |
| `material-selector-proveedor`, `material-selector-aplica` | Selectores en hoja | |
| `catalogo-proveedores` | Proveedores | `/dashboard/catalogo/proveedores` |
| `proveedor-nuevo`, `proveedor-editar` | Hoja del proveedor | |
| `catalogo-armar-pedido` | Armar pedido (tamaño, borde, luces, líneas por proveedor, agregar material) | `/dashboard/catalogo/pedido` |
| `pedido-menu-exportar` | Menú "Exportar" y acciones por proveedor (Compartir, Descargar, Copiar) | |
| `catalogo-pedidos` | Pedidos guardados | `/dashboard/catalogo/pedidos` |
| `pedido-detalle`, `pedido-anular` | Detalle de un pedido y diálogo de anulación | |
| (estados) | Vacíos, errores, cargando, proveedor desactivado en el pedido, pedido anulado | |

## 6. Chrome común

| Pieza | Qué se revisa |
|---|---|
| Encabezado | Logo, menú de usuario (Cerrar sesión adentro), sin recortes en 360 px |
| Barra principal | Presupuestos · Precios · Stock · Compras, con la sección activa visible; el logo lleva a Inicio |
| Pestañas secundarias | Presupuestos (Nuevo, Historial) y Compras (Materiales, Proveedores, Armar pedido, Pedidos), nunca cortadas |
| Barra de herramientas | Buscador, Filtros (contador), "+" (celular); filtros, orden, "Más filtros" y Agregar (escritorio) |
| Hoja de filtros | Encabezado fijo, opciones de 48 px, pie con "Limpiar" y "Ver N resultados" |
| Chips de filtros activos | Sólo cuando hay filtros; hacen salto de línea |
| Flecha "volver arriba" | Sólo tras hacer scroll, sin tapar controles |
| Avisos (toast) | "Se guardó…" |
