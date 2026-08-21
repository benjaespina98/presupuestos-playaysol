# Reglas de negocio encontradas en el código

Levantado durante la Fase 1 de la migración, leyendo `public/*-calc.js` y
`app/dashboard/losetas/script.ts`, y verificado ejecutando las calculadoras
reales (ver `tests/oracle/`).

**Esto describe lo que el sistema hace hoy, no lo que debería hacer.** Cada
regla marcada con ⚠️ es algo que llama la atención y que hay que confirmar con
el negocio. Ninguna se corrige durante la migración: primero paridad, después
mejora.

Los números entre paréntesis son los precios por defecto que trae el código.
El catálogo compartido (`catalogo_items`) los pisa cuando existe la fila.

---

## Cercos

**Total** = `metros lineales × precio por ml` + `Σ adicionales`

Dos precios base, compartidos por todo el equipo:

| Concepto | Por defecto |
|---|---|
| Precio por ml sin instalación | 63.500 |
| Precio por ml con instalación | 79.500 |

El campo "¿Qué mostrar en el presupuesto?" elige si el documento muestra el
total sin instalación, el con instalación, o los dos.

⚠️ **Los opcionales de cercos no suman al total.** Aparecen en el documento
como información, pero el total no los incluye. Es coherente con el catálogo
—los tres opcionales de cercos vienen con precio `null`, es decir "a cotizar"—
pero conviene confirmar que es lo buscado y no un olvido.
Verificado en `tests/oracle/fixtures/cercos.json`: el caso "24 ml con un
opcional incluido" da el mismo total que sin él.

---

## Cobertores

**m²** = `largo × ancho` + `adicional de m²`
**Total** = `m² × precio` + `Σ adicionales` (+ `instalación` si corresponde)

El precio por m² **cambia según la superficie**:

| Superficie | Precio por m² |
|---|---|
| Hasta 15 m² (incluido) | 10.903 |
| Más de 15 m² | 9.902 |
| Instalación (costo fijo) | 100.000 |

El corte es `m² > 15`: exactamente 15 m² paga el precio **caro**.

⚠️ **El salto de precio genera una discontinuidad: agrandar la pileta puede
salir más barato.** Medido con el oráculo:

| Superficie | Total sin instalación |
|---|---|
| 14,5 m² | $ 158.093,50 |
| 15,0 m² | $ 163.545,00 |
| **15,5 m²** | **$ 153.481,00** |

Un cobertor de 15,5 m² sale **$ 10.064 menos** que uno de 15,0 m². Hay un rango
—entre 15 y unos 16,5 m²— donde el cliente paga menos por más superficie.
Puede ser deliberado (descuento por volumen), pero la forma actual lo vuelve un
escalón hacia abajo en lugar de una transición. **A confirmar.**

⚠️ **Sin medidas cargadas, el total con instalación es $ 100.000.** Un cobertor
de 0 m² se cotiza igual, porque la instalación es un costo fijo que se suma
aparte. A confirmar si se prefiere que no muestre nada.

---

## Piscinas

**Total** = `subtotal` + `Σ adicionales`

El `subtotal` **lo escribe una persona a mano**: no hay cálculo. La calculadora
de piscinas no deriva precios de medidas.

⚠️ **La línea TOTAL sólo aparece si hay adicionales cargados.** Sin ellos, el
documento muestra únicamente SUBTOTAL y ningún total. Verificado en
`tests/oracle/fixtures/piscinas.json`. Para un presupuesto que se le entrega a
un cliente, que no diga "TOTAL" en ningún lado es raro. **A confirmar.**

**Los opcionales se muestran todos, siempre.** El catálogo completo sale en el
documento; lo que cambia por presupuesto es si están tildados:

- tildado y con precio cargado → se muestra el precio
- sin tildar, o sin precio → se muestra "No incluye"

Los opcionales **no suman al total**: son un anexo de cotización.

---

## Revestimientos

**m² a revestir** = `piso` + `paredes` + `escalera` + `desperdicio` + `adicionales de m²`

- `piso` = `largo × ancho`
- `paredes` = `2 × profundidad_promedio × (largo + ancho)`
- `profundidad_promedio` = si se cargan *desde* y *hasta*, el promedio de los
  dos; si sólo se carga *desde*, ese valor.

**Total** = `Σ opcionales incluidos` + `Σ adicionales`, donde cada opcional
aporta `precio × m²` o `precio fijo` si está marcado como **cobro por obra**.

⚠️ **Con dos revestimientos incluidos se muestran dos totales separados, no una
suma.** El documento presenta alternativas para que el cliente elija, no un
presupuesto acumulado. Verificado con el oráculo:

| Escenario | Documento |
|---|---|
| 1 revestimiento | `TOTAL REVESTIMIENTO $ 7.616.000` |
| 2 revestimientos | `TOTAL revestimiento con Cerámico Bali Brasil $ 7.616.000`<br>`TOTAL revestimiento con Venecitas Premium España $ 9.520.000` |

Es intencional (viene del commit `7d1201a`, "un total por cada revestimiento"),
pero es una regla que hay que respetar sí o sí al migrar: es fácil convertirla
sin querer en una suma.

⚠️ **Sin ningún revestimiento tildado, el total es $ 0** aunque los m² estén
calculados. El documento sale con superficie y sin precio.

---

## Plano de Piscina (losetas)

**m² incluidos** = `(largo + 2 × borde_incluido) × (ancho + 2 × borde_incluido)`
**m² finales** = `(largo + solar + opuesto) × (ancho + lateral1 + lateral2)`
**m² a cotizar** = `máximo(0, finales − incluidos)`

El costo por material = `m² a cotizar × precio del material`.

El ancho de loseta se carga **terminado por lado**, incluyendo el borde que ya
viene de fábrica. El "borde incluido" se resta una sola vez, como perímetro
completo.

⚠️ **Los labios de una pileta de fibra no afectan el cálculo.** Sólo cambian el
dibujo del espejo de agua dentro de la medida exterior. Está dicho en la
interfaz, pero conviene confirmarlo.

---

## Reglas que valen para todas

### Los precios no se guardan con el presupuesto

`quoteToPlainState()` guarda medidas, datos del cliente y **qué** opcionales
estaban incluidos (por slug), pero **no cuánto costaban**. Al reabrir un
presupuesto se re-cotiza con los precios de hoy.

Es deliberado y está comentado en el código
(`public/cercos-calc.js`, en `aplicarPresupuestoAlState`). **Cambia en la Fase 2**:
los presupuestos nuevos van a congelar sus precios. Los anteriores no tienen ese
dato y van a seguir re-cotizando, con un aviso visible en pantalla.

### El formato numérico argentino rompe los precios

El sistema imprime `$ 2.650.000` pero si le tipean eso mismo entiende `2,65`.
Congelado en `tests/unit/formato-numerico.test.ts`. **Se corrige después de la
Fase 4**, no antes.

### Tres fuentes para un mismo precio

Un precio puede venir de tres lugares, en este orden de precedencia al arrancar:

1. Valor por defecto hardcodeado en el `-calc.js`
2. `localStorage` de esa computadora (lo pisa)
3. `catalogo_items` de Supabase (lo pisa, si existe la fila)

Como la escritura a `localStorage` ocurre **en cada tecla**, una edición local
que el usuario "canceló" en el popup igual queda guardada en esa máquina. Si esa
clave no existe en `catalogo_items`, dos vendedores pueden ver precios distintos.
**Se resuelve en las Fases 2 y 4.**

### La tabla de catálogo guarda dos cosas distintas

Además de productos, `catalogo_items` usa claves reservadas `__legal` y
`__footer_*` para los textos compartidos del documento. La pantalla de Catálogo
tiene que excluirlas.

### Un mismo material puede estar dos veces, con precios distintos

`revestimiento_ceramico_bali` existe en `piscinas` y en `revestimientos`. No es
un duplicado: en piscinas es el revestimiento completo instalado de una pileta
nueva, en revestimientos es el precio por m² de un trabajo suelto. **No hay que
unificarlos.**

### Lo que no existe

- **No hay descuentos.** Cero ocurrencias en todo el código.
- **No hay cálculo de IVA.** Sólo se lo menciona en el texto legal.

Si hacen falta, son funcionalidad nueva y van después de la migración.

---

## Los seis puntos, y qué se decidió

Regla general vigente: **paridad primero**. Ninguno se corrige durante la
migración. Lo que se decida acá cambia qué hacemos DESPUÉS, no qué construimos
en el dominio: todos se preservan tal cual están.

| # | Regla | Dónde | Estado |
|---|---|---|---|
| 1 | El escalón a los 15 m² hace que un cobertor más grande salga más barato | Cobertores | ⏳ **A decidir** — se revisa junto con el resto antes de tocar nada |
| 2 | La línea TOTAL no aparece si no hay adicionales | Piscinas | ✅ **Se conserva el cálculo.** Después se mejora la presentación para que el documento siempre muestre TOTAL con claridad |
| 3 | Los opcionales no suman al total | Cercos, piscinas | ⏳ **A confirmar** |
| 4 | Cobertor de 0 m² cotiza $ 100.000 de instalación | Cobertores | ⏳ **A confirmar** |
| 5 | Dos revestimientos = dos totales alternativos, no una suma | Revestimientos | ✅ **Se mantiene exactamente.** Son alternativas para que el cliente elija |
| 6 | Los labios de fibra no afectan los m² | Losetas | ⏳ **A confirmar** |
