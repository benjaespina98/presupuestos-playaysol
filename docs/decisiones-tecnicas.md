# Decisiones técnicas de la migración

Registro corto de las decisiones que no son obvias, para no volver a discutirlas
ni descubrirlas por arqueología de commits.

---

## 1 · Las calculadoras legacy NO adoptan los motores nuevos en la Fase 2

**Fecha:** Fase 2 · **Estado:** aplicada

### La decisión

Los cinco motores de precios quedan extraídos, tipados y verificados contra el
oráculo, pero `public/*-calc.js` y `app/dashboard/losetas/script.ts` **siguen
usando sus propias fórmulas inline**. La adopción ocurre en la Fase 5-6, cuando
cada calculadora se reescribe en React.

### Por qué

Cablear el legacy a los motores nuevos exigiría:

- pasarlos por `window.*`, porque los scripts de `/public` son `<script>`
  clásicos y no pueden importar un paquete;
- convertir en asincrónico el camino de `buildDocumentBody()`, que hoy corre de
  forma sincrónica en cada tecla;
- tocar cuatro archivos en producción **que se eliminan dos fases después**.

A cambio se ganaría tener una sola fuente de la fórmula durante unas semanas.
No compensa: la prioridad número uno acordada es *no romper presupuestos*, y el
oráculo ya demuestra la equivalencia entre las dos implementaciones sin tocar
nada.

La puerta de salida de la Fase 2, tal como quedó aprobada, dice exactamente
esto: *"el motor nuevo reproduce el 100 % de las fixtures · las calculadoras
legacy siguen intactas"*.

### Cómo se sostiene mientras conviven

Durante la convivencia hay dos implementaciones de cada fórmula. Lo que evita
que se desincronicen en silencio:

- `tests/unit/oraculo.test.ts` — corre el legacy y lo compara contra las
  fixtures. Si alguien toca una fórmula vieja, falla.
- `lib/domain/precios/contra-oraculo.test.ts` — corre el motor nuevo contra las
  mismas fixtures. Si alguien toca una fórmula nueva, falla.

Las dos apuntan al mismo archivo de referencia, así que cualquier divergencia
aparece en el primer `npm test`.

---

## 2 · El oráculo corre en jsdom, no en Playwright

**Fecha:** Fase 1 · **Estado:** aplicada

El plan original grababa las fixtures manejando la app real con Playwright. Eso
exigía servidor, login y credenciales de un usuario de prueba.

Se cambió por un arnés que levanta la calculadora legacy dentro de jsdom
(`tests/oracle/harness.ts`): corre en ~5 s, sin red, sin Supabase y sin
credenciales, así que funciona en cualquier máquina y en CI.

**Lo que jsdom no cubre:** cómo se ve el documento, el PDF, el Word y las fotos.
Eso necesita navegador real y se valida en la Fase 5, al liberar la primera
calculadora migrada.

---

## 3 · Los importes se comparan al centavo, no al float

**Fecha:** Fase 2 · **Estado:** aplicada

Las fixtures guardan el importe **impreso** en el documento, que ya pasó por el
formateador. El motor devuelve el float crudo. Para 15,3 m² × 9.902 eso es
`151500.59999999998` contra `151500.6`.

Comparar con igualdad estricta haría fallar la migración por un error de
redondeo en el decimal once, que no le cambia el precio a nadie. Se compara con
`toBeCloseTo(…, 2)`.

---

## 4 · Las categorías del catálogo no participan de ningún cálculo

**Fecha:** Fase 2 · **Estado:** aplicada

`catalogo_items` describe y precia ítems; los motores de dominio calculan.
Cambiar la categoría de un producto no puede mover el total de un presupuesto.

Por eso la clasificación inicial de la migración es mecánica y editable: si está
mal, se corrige desde la pantalla de Catálogo sin ningún riesgo de negocio.

---

## 5 · Un mismo material puede estar dos veces en el catálogo

**Fecha:** Fase 0 · **Estado:** aplicada

`revestimiento_ceramico_bali` existe en `piscinas` y en `revestimientos` con
precios distintos. **No se unifican.** En piscinas es el revestimiento completo
instalado de una pileta nueva; en revestimientos es el precio por m² de un
trabajo suelto. Son ítems comerciales distintos que comparten nombre técnico.

---

## 6 · MoneyInput/NumberInput comparten un solo motor de máscara

**Fecha:** Fase 3 · **Estado:** aplicada

`components/form/useMaskedNumberInput.ts` es el único lugar que decide "cuándo
reformatear, cuándo no tocar el texto, qué significa vacío". MoneyInput
(`formatARS`/`parseARS`, vacío → `null`) y NumberInput (`formatNumero`/
`parseARS`, vacío → `0`, como `parseARSOCero` en el legacy) son ese mismo motor
con dos formatters distintos, no dos implementaciones.

La regla que evita que el cursor salte: mientras el input tiene foco, el texto
en pantalla es exactamente lo que la persona tipeó, nunca se reescribe. El
formato "bonito" se aplica recién al perder el foco. React no mueve el cursor
de un input controlado si el valor no cambió respecto del DOM, así que alcanza
con no tocar `texto` mientras `editando === true`.

---

## 7 · `useController` de RHF, no `register`, para MoneyField/NumberField

**Fecha:** Fase 3 · **Estado:** aplicada

TextField/SelectField/CheckboxField usan `register`: el dato que guardan es
literalmente el string/valor del input, así que RHF lo maneja sin ayuda.
MoneyField/NumberField no pueden: el dato semántico es `number | null` pero lo
que hay en el DOM es un string formateado ("$ 1.500.000"), y esa traducción
tiene que pasar por alguien. `useController` es ese puente.

Al desestructurar `field` de `useController`, el objeto trae una propiedad
`ref` (el callback ref de RHF) junto con `name`/`value`/`onChange`/`onBlur`. La
regla `react-hooks/refs` de eslint-plugin-react-hooks 7.x asume que cualquier
objeto con una propiedad `ref` es un ref de React y prohíbe leer sus otras
propiedades durante el render — falso positivo con la forma que tiene
`ControllerRenderProps`, no un problema real (nada ahí es un ref de React salvo
el propio `.ref`). Se resuelve desestructurando cada propiedad por separado
(`const { field: { ref: campoRef, name: campoNombre, ... } }`) en vez de pasar
el objeto `field` completo, sin desactivar la regla.

---

## 8 · Zod valida forma, no fórmulas

**Fecha:** Fase 3 · **Estado:** aplicada

`useZodForm` (lib/forms) es el único punto donde un formulario conecta
`zodResolver` con React Hook Form. Los schemas que se le pasan describen
"¿está el campo obligatorio?, ¿es un número?, ¿el string mide lo que tiene que
medir?" — nunca una fórmula de precio. El cálculo sigue siendo enteramente de
`lib/domain/precios`: un campo puede exigir "tiene que haber un número" pero
jamás "el total tiene que dar tanto". Esa separación es la misma razón por la
que las líneas de presupuesto llevan su total ya calculado (ver decisión 1):
domain calcula, la capa de formulario solo valida forma.

---

## 9 · Auditoría de seguridad de la pantalla de Catálogo (Fase 4)

**Fecha:** Fase 4 · **Estado:** aplicada — sin cambios de código, hallazgo documentado

Antes de dar por cerrada la Fase 4 se auditó específicamente lo que la
pantalla de Catálogo toca (no la aplicación entera). Verificado contra el
proyecto real, no contra la teoría:

- **Sin RLS no hay lectura**: una request sin `Authorization` a
  `catalogo_items` devuelve `200 []`, no los datos — confirmado en vivo contra
  el proyecto de Supabase configurado. `anon` no matchea ninguna policy (son
  todas `to authenticated`), así que RLS lo filtra en silencio, como el resto
  de la app espera (ver el comentario sobre `actualizarPresupuesto` en
  lib/presupuestos.ts para el mismo patrón).
- **No hay policy de `delete`** sobre `catalogo_items` (ver
  migration_catalogo_items.sql): ni la pantalla nueva ni el puente legacy
  pueden borrar una fila aunque quisieran. `activo=false` ("De baja") es la
  única forma de sacar un ítem de la vista, y es reversible.
- **`updated_by` nunca se lee** desde el cliente: `listarItemsCatalogo` no lo
  selecciona, así que el id de quien tocó cada fila por última vez no llega al
  navegador de otro usuario.
- **`clave`/`tipo` son de solo lectura en la pantalla nueva**: `CambiosItemCatalogo`
  no los declara, así que TypeScript impide armar un `update` que los toque.
  Importa porque el puente legacy referencia cada fila por el par
  `(tipo, clave)` — cambiarlos por esta pantalla correría el catálogo de abajo
  de una calculadora en producción sin que nada avise.

**Lo que se verificó y NO se tocó, porque ya era así antes de la Fase 4 y
cambiarlo es una decisión de producto, no un bug de esta fase:** la policy de
`update` de `catalogo_items` es `using (true) with check (true)` para
cualquier usuario autenticado — cualquiera del equipo puede editar el precio
de cualquier ítem, no sólo el suyo. Es intencional y está documentado desde
`migration_catalogo_items.sql`/`lib/catalogo.ts` original: el catálogo es
compartido a propósito ("actualizar para todos los presupuestos futuros"), a
diferencia de `presupuestos` (que sí es por dueño, ver
`migration_perfiles_ownership.sql`). La pantalla de Fase 4 no amplía este
permiso — expone con una UI más clara una capacidad que el popup legacy ya
daba. Si en algún momento se quiere un rol "admin de catálogo" distinto de
"vendedor", hace falta antes un sistema de roles que hoy no existe en el
schema (no hay tabla de roles ni columna en `perfiles`); no se inventó acá
porque sería una decisión de negocio, no una corrección técnica.

---

## 10 · La Fase 5 migra cálculo + snapshot primero; documento/fotos quedan para después

**Fecha:** Fase 5 · **Estado:** en curso, alcance acotado a propósito

Cada `public/<tipo>-calc.js` legacy son ~1750-1950 líneas que hacen mucho más
que calcular: arman el documento Word con `docx`, el PDF por impresión del
navegador, suben y recortan fotos con `html2canvas`, sincronizan contra el
catálogo compartido y arman el link de WhatsApp. Migrar TODO eso de las 5
calculadoras a React en una sola pasada no es realista sin arriesgar
precisamente lo que la Fase 2 puso como prioridad número uno: no romper
presupuestos ni el documento final que recibe el cliente.

La decisión: cada calculadora se migra primero como **formulario + motor +
resultado + snapshot** (React + RHF/Zod + `lib/domain/precios/*` +
`PresupuestoV1`, guardado en `presupuestos` igual que hoy), montada en una
ruta nueva (`/dashboard/<tipo>/nuevo`) que **no reemplaza** la ruta de
producción. La calculadora legacy (con Word/PDF/fotos funcionando) sigue
siendo la única que un vendedor ve y usa hasta que:

1. la versión React tenga paridad demostrada contra el oráculo (Lote 2 de
   cada calculadora, como se hizo con cercos);
2. se porte (no se reinvente) la generación de documento — probablemente
   reusando las funciones de `docx`/`html2canvas` ya extraídas del CDN en la
   Fase 0, alimentadas por el snapshot nuevo en vez del estado del DOM viejo;
3. recién ahí se reemplaza la ruta y se borra el `-calc.js` correspondiente,
   nunca antes (ver la "Regla sobre legacy" del prompt de Fase 5).

Cortar la fase en este punto y reportarlo así — en vez de declarar "Fase 5
cerrada" con el documento sin migrar — es intencional: cerrar la fase
implica también poder borrar el legacy, y borrarlo sin la exportación
funcionando sería la clase de regresión que ninguna de las fases anteriores
se permitió.

**Actualización:** cercos, cobertores, piscinas y revestimientos completaron
el patrón entero (cálculo + snapshot + Word + PDF + fotos + reemplazo de
ruta + baja del legacy) y quedaron cerrados. Sigue pendiente losetas — ver
decisión 11.

---

## 11 · Losetas queda fuera de esta pasada de la Fase 5, a propósito

**Fecha:** Fase 5 · **Estado:** pendiente, alcance deliberadamente acotado

El propio comentario que ya vivía en `tests/unit/oraculo-losetas.test.ts`
desde antes de este trabajo lo anticipaba: *"Es el módulo con la reescritura
más grande por delante (Fase 7)"*. Auditado ahora, se confirma por qué:

- No genera un documento con líneas de precio como las otras cuatro — su
  salida es un **plano SVG interactivo** (`drawSvg()`, ~230 líneas): grilla
  de medidas, luces arrastrables con drag & drop (`initLuzDrag`), colores de
  agua/loseta editables, posición de escalera, "espejo de agua" para piletas
  de fibra con labios, y export a **imagen PNG** vía `html2canvas` — no a
  Word. No hay `imprimirConNombre`/PDF tampoco.
- Su snapshot no encaja en `LineaPresupuesto`/`NaturalezaLinea`: no hay
  "líneas" ni "totales", hay dos m² (incluidos/a cotizar) y una tarjeta de
  costo por material. Migrarlo exige decidir cómo se ve ese dato en
  `PresupuestoV1.medidas`, no sólo portar un formulario.
- Es interactivo de una forma que ninguna otra calculadora es (arrastrar un
  punto en un SVG y que se guarde su posición normalizada) — ese
  comportamiento no tiene equivalente en los componentes de Fase 3.

Migrar esto con la misma prisa que las otras cuatro, al final de una sesión
ya larga, es exactamente el tipo de decisión que arriesga la prioridad
número uno de toda la migración (no romper presupuestos). El motor puro
(`lib/domain/precios/losetas.ts`) ya existe y ya está verificado contra el
oráculo (`tests/unit/oraculo-losetas.test.ts`) desde antes de esta fase —
lo que falta es la UI/documento, y eso merece su propia pasada enfocada.

## 12 · Losetas migrada como editor gráfico, no como una quinta variación del documento — Fase 5 cerrada

**Fecha:** Fase 5 · **Estado:** hecho — 5/5 calculadoras migradas

Retomando la decisión 11: losetas se migró en su propia pasada, tratándola
como lo que la auditoría dijo que era — un editor SVG interactivo, no un
documento con líneas de precio — en vez de forzarla dentro del molde de
`LineaPresupuesto`/`DocumentoXxx.tsx` de las otras cuatro.

- **Geometría como dato, no como HTML.** `lib/domain/plano/losetas.ts` es la
  contraparte gráfica de `lib/domain/precios/losetas.ts`: puro, sin DOM,
  transcribe `drawSvg()` pero devolviendo una lista de primitivas
  (`rect`/`line`/`circle`/`text` con sus coordenadas ya calculadas) en vez de
  un template string. `components/calculadoras/losetas/PlanoLosetasSvg.tsx`
  sólo mapea esas primitivas a JSX — nunca hay `innerHTML` ni
  `querySelector`, así que el estado del plano vive donde tiene que vivir: en
  React, no en el DOM. Verificado contra los mismos casos que ya protegía
  `tests/unit/oraculo-losetas.test.ts` (ahora borrado junto con el arnés
  legacy que levantaba) — ver `lib/domain/plano/losetas.test.ts`.
- **El arrastre se resuelve con `getBoundingClientRect`, no con
  `getScreenCTM`.** El legacy convertía coordenadas de pantalla a
  coordenadas SVG con `getScreenCTM().inverse()`. El plano nuevo se sigue
  sirviendo a `width:100%` sin alto propio (mismo criterio que el legacy), así
  que su alto en pantalla sigue siempre la proporción del `viewBox` — no hay
  letterboxing que compensar, y una escala uniforme (`viewBox.width /
  rect.width`) alcanza. Más simple de razonar y de testear con
  Testing Library que un cálculo con matrices.
- **`PresupuestoV1.medidas` alcanza como snapshot propio — no hizo falta
  inventar un tipo aparte.** `medidas` ya es un `z.record` abierto (pensado
  para que cada calculadora meta lo suyo); ahí entran dimensiones, colores,
  posición de cada luz, escalera, espejo de agua y las etiquetas de cada
  lado, sin depender del catálogo ni de `LineaPresupuesto`. `lineas` y
  `totales` quedan vacíos a propósito: losetas nunca imprimió un documento
  con precios, y forzar una línea ahí sólo para llenar el campo hubiera sido
  la clase de "quinta variación" que esta decisión evita.
- **Los materiales NO viajan en el snapshot.** Es fidelidad al legacy, no un
  recorte: `getState()` nunca los incluía — cada plano abría siempre con los
  mismos dos materiales en $0. Se preservó tal cual (ver el comentario en
  `LosetasCalculadora.tsx`).
- **Sin edición de catálogo inline.** El legacy tenía un popup
  "¿guardar como precio permanente?" al perder foco de un precio de
  material (`confirmarPrecioMaterial`, vía `public/catalogo-modal.js`). Las
  otras cuatro calculadoras, al migrar, ya habían dejado esa función
  exclusivamente para la pantalla de administración del catálogo
  (`/dashboard/catalogo`, Fase 4) — ninguna volvió a ofrecer edición inline.
  Losetas nunca estuvo sembrada en `catalogo_items` (sin seed inicial,
  comentario ya existente en `lib/catalogo.ts`) y no aparece en la pantalla
  de catálogo: sumarle ahí un flujo que las otras cuatro no tienen hubiera
  sido inconsistente con la arquitectura que dejaron las Fases 2-4, así que
  se lo dejó afuera a propósito.
- **Adaptador v0 completado, no sólo el de medidas base.** `adaptadores.ts`
  ya traducía `largo/ancho/inc/solar/opuesto/lateral1/lateral2` desde antes
  de esta pasada, pero un plano guardado por el legacy real también tenía
  colores, luces, escalera, solar húmedo y revestimiento — y su campo de
  cliente se llama `nombre`, no `cliente` (único caso entre las 5). Sin
  completar esto, abrir un plano viejo perdía todo lo que no fueran las
  medidas del borde. Cubierto en `adaptadores.test.ts`.
- **Legacy eliminado en el mismo lote.** `app/dashboard/losetas/{calculator,
  markup,script,styles}.ts`, `components/calculadora/{Calculadora.tsx,
  puente.ts,calc.css}`, `public/{catalogo-modal,nombre-archivo}.js` y el
  arnés `tests/oracle/harness.ts` (+ `oraculo-losetas.test.ts`) se borraron:
  losetas era su último consumidor. `tests/unit/dependencias.test.ts` y
  `tests/assets.spec.ts` se actualizaron para dejar de exigir ese contrato.
