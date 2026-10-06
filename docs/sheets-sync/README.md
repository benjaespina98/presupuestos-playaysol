# Sincronizar la planilla de costos con el catálogo web

El **catálogo web es la fuente de verdad**. La planilla "Playa_y_Sol_Pedidos_y_Costos" se
actualiza sola a partir de él (cada 5 minutos, o al instante con un botón).

```
 Catálogo web (Supabase)  ──►  /api/sheets/catalogo  ──►  script de la planilla  ──►  hojas
  proveedores, materiales        (protegida con token)      (Apps Script, cada 5')
  y precios de venta
```

## Qué se sincroniza

| Hoja de la planilla | Qué se escribe | Qué NO se toca |
|---|---|---|
| **Proveedores** | Columnas A a G, desde la fila 6 | — |
| **Artículos** | Columnas A a T, desde la fila 6. En los artículos cotizados en dólares queda la fórmula `=USD × tipo de cambio` en la columna D | El tipo de cambio (`B3`), formatos y colores |
| **Precios y margen** | La columna B (precio de venta) de las filas que se reconocen por su nombre: tamaños de piscina, modelos Indusplast y la lista de adicionales | Cualquier celda con fórmula, y las filas que no están en el catálogo |
| Presupuesto, Pedido, Mensaje, Calc | Nada | Todo |

Los dados de baja en el catálogo **no** van a la planilla. Un precio sin cargar aparece como
**A cotizar**.

> ⚠️ Lo que se escriba a mano en las celdas que se sincronizan **se pisa** en la próxima
> actualización. Para cambiar un proveedor, un material o un precio de venta, hacelo en el
> catálogo web.

## Puesta en marcha (una sola vez)

### 0. Antes de empezar: una copia de seguridad
En la planilla: **Archivo → Hacer una copia**. El script reescribe celdas; una copia es el seguro.

### 1. Cargar dos variables en Vercel
Vercel → tu proyecto → **Settings → Environment Variables**. Agregá estas dos para
**Production** (y para Preview si querés probar ahí):

| Nombre | Valor |
|---|---|
| `SHEETS_SYNC_TOKEN` | Una clave larga que inventás vos. Para generarla, en PowerShell: `[guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → **Project Settings → API → `service_role`** (la clave *secreta*, no la `anon`) |

Después hacé un **Redeploy** para que las tome.

La clave `service_role` da acceso total a la base: va **sólo** en Vercel. No la pegues en la
planilla, en el chat, ni en ningún archivo del repositorio (que es público).

### 2. Probar que la web responde
En PowerShell, con tu dirección y tu token:

```powershell
Invoke-RestMethod -Uri "https://TU-SITIO.vercel.app/api/sheets/catalogo" -Headers @{ Authorization = "Bearer TU_TOKEN" } | Select-Object version, generado
```

- Devuelve una `version` y un `generado` → funciona.
- `401` → el token no coincide con el de Vercel.
- `503` → falta una de las dos variables, o no se hizo el Redeploy.
- `502` → falta correr `migration_proveedores_materiales.sql` en Supabase.

### 3. Instalar el script en la planilla
1. En la planilla: **Extensiones → Apps Script**.
2. Borrá lo que haya en `Código.gs` y pegá **todo** el contenido de
   [`Sincronizar.gs`](./Sincronizar.gs). Guardá (💾).
3. Volvé a la planilla y **recargá la página**: aparece el menú **Catálogo web**.
4. **Catálogo web → Configurar conexión**: pegá la dirección
   (`https://TU-SITIO.vercel.app/api/sheets/catalogo`) y después el token.
5. **Catálogo web → Actualizar ahora**. La primera vez Google pide permisos: es normal (el
   script lee la web y escribe en esta planilla). Aceptá. Debe avisar cuántos proveedores y
   materiales cargó.
6. **Catálogo web → Activar actualización automática**. Desde ahí se actualiza sola cada 5 minutos.

## Uso diario
No hay nada que hacer: se cambia el catálogo web y la planilla lo refleja en unos minutos.
Para verlo ya mismo: **Catálogo web → Actualizar ahora**. **Catálogo web → Estado** muestra
cuándo fue la última actualización y si hubo algún error.

## Si algo falla
- **"El catálogo rechazó el token (401)"** → volvé a **Configurar conexión** y pegá el token
  exacto de Vercel.
- **"El catálogo no tiene proveedores o materiales: no se actualiza"** → es una protección:
  el catálogo web vino vacío y la planilla no se borra. Revisá que se haya importado la planilla.
- **"Hay N materiales y la planilla admite 150"** → las fórmulas de la planilla leen hasta la
  fila 155 de Artículos; hay que ampliarlas antes de pasar de 150 materiales.
- **No se actualiza una fila de "Precios y margen"** → sólo se sincronizan las filas cuyo
  nombre coincide con el del catálogo (ver `ETIQUETAS_PRECIO` en `Sincronizar.gs`). Si se
  renombra una fila en la planilla, hay que renombrarla también ahí.

## Para desarrolladores
- Ruta: `app/api/sheets/catalogo/route.ts`. Responde `503` si no están las variables, `401`
  sin token válido, `502` si la base falla. Siempre `Cache-Control: no-store`.
- Qué se exporta: `lib/sheets/exportar.ts` (puro, con tests). El script y su comportamiento
  están probados contra una planilla simulada en `lib/sheets/script.test.ts`.
- La planilla no tiene sesión de usuario, por eso se usa un token compartido y la clave de
  servicio de Supabase (sólo del lado del servidor).
