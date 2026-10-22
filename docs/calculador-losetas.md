# Calculadora de losetas (herramienta interna)

Vive dentro del generador del plano (`Nuevo → Plano de Piscina`), en una sección plegable
"Calculadora de losetas". **Cuenta piezas, no precios**: no suma a ningún total y no aparece en la imagen,
el PDF ni el Word que se le entregan al cliente. Tiene su propio estado (no se guarda con el plano).

Código: `lib/domain/plano/calculoLosetas.ts` (cálculo puro, con tests) y
`components/calculadoras/losetas/CalculadoraLosetasInterna.tsx` (la pantalla).

## Qué había antes (historial de git)

`lib/domain/precios/losetas.ts`, borrado en el commit `c9ecc1d` ("sacar el banner de marca y el costeo de m²"),
calculaba **metros cuadrados**, no piezas:

- m² incluidos = (largo + 2·borde) × (ancho + 2·borde)
- m² finales = (largo + solar + opuesto) × (ancho + lateral1 + lateral2)
- m² a cotizar = máx(0, finales − incluidos)

Se sacó porque mezclaba "generar el plano" con "cotizar losetas". No se recupera tal cual: lo que se pide ahora
es otra cosa (cantidad de piezas de borde y planas).

## Lógica adoptada

```
área del borde   = (largo + 2·vereda) × (ancho + 2·vereda) − largo × ancho
losetas de borde = ⌈ área del borde ÷ área de una loseta × (1 + desperdicio) ⌉
losetas planas   = valor editable (escalera y accesos), 6 por defecto
total            = losetas de borde + losetas planas
```

Entradas: largo, ancho y profundidad (la profundidad es sólo de referencia: no cambia la cantidad), tipo
(hormigón o fibra; en fibra se cargan a mano las medidas reales del modelo), medida de la loseta (0,50 × 0,50 por
defecto), ancho de vereda (0,50 m por defecto) y desperdicio (0 % por defecto). El detalle del cálculo queda a la vista.

**Decisiones tomadas** (hay que confirmarlas con quien conoce el oficio):

- "Losetas planas" se modeló como un número fijo editable, porque en la hoja "Artículos" vale 6 para todos los
  tamaños (no depende de las medidas).
- El desperdicio arranca en 0 % para poder comparar con la hoja; se puede subir (por ejemplo 5 o 10 %).
- La vereda se calcula como una banda de ancho uniforme; con loseta y vereda de 0,50 coincide con contar la
  corona de losetas con sus cuatro esquinas.

## Comparación con la hoja "Artículos" de la planilla

La planilla no se tocó. Losetas de borde (la columna "planas" da 6 en todas, igual que la hoja):

| Tamaño | Hoja | Calculadora | Diferencia |
|---|---|---|---|
| 5×3 | 38 | 36 | −2 |
| 6×3 | 38 | 40 | +2 |
| 7×3 | 44 | 44 | 0 |
| 7×3,5 | 46 | 46 | 0 |
| 7×4 | 47 | 48 | +1 |
| 8×3 | 47 | 48 | +1 |
| 8×4 | 50 | 52 | +2 |
| 9×3 | 50 | 52 | +2 |
| 9×4 | 54 | 56 | +2 |
| 10×4 | 60 | 60 | 0 |
| 6,5×2,5 | 38 | 40 | +2 |

Coincide en 3 de 11 y difiere de 1 a 2 losetas en el resto. Dos filas llaman la atención: **5×3 y 6×3 tienen el mismo
valor (38) en la hoja**, algo imposible para una vereda de ancho fijo (una pileta más larga lleva más losetas), y
el resto de la hoja va 1 o 2 losetas por debajo de la geometría. Es consistente con que algunas cantidades de la hoja
sean estimaciones. Conviene revisar esas filas con el instalador antes de usar la calculadora como referencia.
