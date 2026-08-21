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
