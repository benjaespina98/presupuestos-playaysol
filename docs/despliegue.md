# Despliegue a producción — paso a paso

Para ejecutar **a mano**, en este orden. Incluye las migraciones de las fases 1 y 2 (auditoría, anulación,
desactivación y stock con movimientos) y el código que las usa.

> **Secretos:** la contraseña de la base y las claves de Supabase **no se pegan** en este archivo, en el repo,
> en un chat ni en un comando que quede en el historial. Si el CLI te pide la contraseña, escribila en la terminal.
> Los respaldos tienen datos de clientes: **nunca** se suben al repositorio (que es público). La carpeta `respaldo/`
> ya está en `.gitignore`.

Los flags de este documento se verificaron con `--help` de la versión **2.121.0** del CLI
(`npx supabase@2.121.0 <comando> --help`). Si usás otra versión, volvé a mirar el `--help`.
En los ejemplos `npx supabase@2.121.0` se escribe `supabase` para abreviar.

## 0. Antes de empezar

- [ ] Elegí un momento **sin uso** (4 personas: avisales). Entre el paso 7 (migraciones) y el 8 (código nuevo) el portal
      viejo anda mal: ya no puede borrar ni escribir el stock directo. Son unos minutos si vas seguido.
- [ ] Tené a mano el *project ref* (Supabase → Project Settings → General) y la contraseña de la base
      (Project Settings → Database). Las dos son tuyas: no las compartas.
- [ ] Verificá que las dos migraciones de higiene ya están aplicadas (SQL Editor):
      ```sql
      select policyname from pg_policies where tablename = 'presupuestos' and cmd = 'INSERT';   -- debe decir "Users can insert presupuestos as themselves"
      select count(*) from pg_policies where tablename = 'objects' and policyname = 'Authenticated users can update presupuesto images';  -- debe dar 0
      ```
- [ ] Tené el código listo: la rama `chore/cierre-predespliegue` (incluye `feat/base-auditoria` y
      `feat/stock-movimientos`) con lint, tests y build en verde.

## 1. Respaldo nuevo (dos copias)

El plan Free no tiene respaldos restaurables: **este es tu único respaldo**.

```powershell
mkdir respaldo
supabase link --project-ref <TU-PROJECT-REF>          # te puede pedir la contraseña de la base
supabase db dump --linked -f respaldo\esquema.sql
supabase db dump --linked --data-only --use-copy -f respaldo\datos.sql
supabase db dump --linked --role-only -f respaldo\roles.sql
```

(`--data-only` vuelca solo los datos; `--use-copy` usa `COPY` en lugar de `INSERT`, más rápido de restaurar.)

Controles:

```powershell
Get-Item respaldo\*.sql | Select-Object Name, Length                 # ninguno puede pesar 0
Select-String -Path respaldo\datos.sql -Pattern "COPY public.presupuestos" | Select-Object -First 1
Get-FileHash respaldo\*.sql -Algorithm SHA256 | Format-Table Hash, Path
```

- **Segunda copia** en otro lugar físico o en la nube que no sea esta PC (disco externo, Drive privado). Comparale el hash
  (`Get-FileHash`) con el de la primera.
- **Las fotos** (bucket `presupuestos`) **no** van en el dump: el dump trae solo la lista de archivos. Las migraciones
  **no las tocan**, así que no corren riesgo, pero si querés una copia bajalas desde Supabase → Storage.
- Anotá la fecha y hora del respaldo.

## 2. Diagnóstico del stock (solo lectura)

Supabase → SQL Editor → pegá el contenido de `supabase/diagnostics/stock.sql` y ejecutalo. Mirá:

- **Consulta 1 y 2:** cuántos ítems llevan stock y cuántos tienen unidades. Cada ítem con unidades recibirá **un**
  movimiento de apertura; el total de unidades **no cambia**.
- **Consulta 3:** ítems con stock que **no** son piscinas de fibra Indusplast. La migración los conserva; decidí si es lo esperado.
- **Consulta 4:** stock negativo. Hoy el CHECK lo impide, así que tiene que estar vacía.
- **Consulta 5:** el CHECK de stock que existe (`catalogo_items_stock_no_negativo`); la migración lo elimina.
- **Consulta 6:** la columna `stock` tiene que existir. Si no, falta `migration_stock_piscinas.sql`: **frená**.

Si algo no es lo esperado, no sigas hasta entenderlo.

## 3. Limpieza pendiente de producción

Producción todavía tiene la columna `presupuestos.imagen_url` y le falta el índice `idx_presupuestos_created_by`. Esa limpieza
se aplica **antes** de marcar la baseline como aplicada (la baseline ya la da por hecha).

SQL Editor → pegá `supabase/migration_limpieza.sql` y ejecutalo (es idempotente). Verificá:

```sql
select count(*) from information_schema.columns where table_name = 'presupuestos' and column_name = 'imagen_url';  -- 0
select count(*) from pg_indexes where indexname = 'idx_presupuestos_created_by';                                   -- 1
```

## 4. Comparar la baseline con producción

Seguí "Comparar la baseline con tu esquema real" de `docs/migraciones.md` con el `esquema.sql` del paso 1.
Las diferencias de texto sin importancia (orden, `SET`s) se ignoran; las de tablas, columnas, policies,
triggers o funciones se corrigen **en la baseline** (no en producción) y se vuelve a probar con `supabase db reset`.
Seguí recién con el diff limpio.

## 5. Marcar la baseline como aplicada (no ejecuta SQL)

```powershell
supabase migration repair --status applied 20261021000000 --linked
supabase migration list --linked
```

`migration list --linked` tiene que mostrar `20261021000000` como aplicada en **Remote**, y las otras cinco
(`20261021000100`, `…200`, `…300`, `20261022000000`, `20261022000100`) solo en **Local**.

## 6. Ensayo (`--dry-run`)

```powershell
supabase db push --linked --dry-run
```

No aplica nada. Tiene que listar **exactamente** esas 5 migraciones, en ese orden. Si lista otra cosa (por ejemplo la
baseline), **frená** y revisá el paso 5.

## 7. Aplicar las migraciones

```powershell
supabase db push --linked
```

Cada archivo corre en una transacción: si uno falla, ese archivo no queda a medias. La de stock **aborta sola** si el caché
no coincidiera con el libro. Si todo sale bien, mostrá la lista:

```powershell
supabase migration list --linked      # las seis, aplicadas en Remote
```

> A partir de acá, el portal viejo está en transición. Seguí con el paso 8 sin demorar.

## 8. Código nuevo a `master` (inmediatamente después)

Tu flujo es `feature → develop → master`, con los tests en verde en cada merge:

```powershell
git switch develop
git merge --no-ff chore/cierre-predespliegue
npm test                       # tiene que dar todo verde antes de seguir
git switch master
git merge --no-ff develop
git push origin master         # Vercel despliega solo
```

Esperá a que Vercel termine el despliegue (panel de Vercel → Deployments → "Ready"; suele tardar un par de minutos).

## 9. Prueba rápida en producción

Con tu usuario, en `presupuestos-playaysol.vercel.app`:

1. Entrá. **Catálogo:** una piscina de fibra muestra su stock y los botones Ingreso, Venta, Ajustar conteo e Historial;
   un ítem de hormigón dice "A pedido" y no tiene botones.
2. **Historial** de una piscina con unidades: aparece "Stock inicial" con la cantidad que tenía.
3. **Ajustar conteo** con el **mismo** número que ya tiene: tiene que decir que no hubo cambios (no crea movimiento).
4. Si querés probar escritura real: un **Ingreso de 1** en una piscina y después, desde su Historial, **Anular** ese ingreso.
   (Queda en el libro; es parte de la prueba.)
5. **Historial de presupuestos:** abrí uno viejo; se ve igual que antes. No anules uno real.
6. **Pedidos:** "Armar pedido" carga sin errores.
7. Abrí la consola del navegador (F12): sin errores rojos.

## 10. Chequeo final en la base

SQL Editor:

```sql
select * from verificar_consistencia_stock();                                   -- 0 filas
select count(*) from movimientos_stock where tipo = 'apertura';                 -- = ítems con unidades del paso 2
select count(*) from auditoria;                                                 -- crece con cada cambio
select clave, stock from catalogo_items where stock is not null order by clave; -- iguales a los del paso 2 (más lo que hiciste en la prueba)
```

## 11. Plan de reversa

- **Falla en el paso 7 (`db push`):** esa migración se deshace sola. No hay código nuevo desplegado, así que el portal sigue
  funcionando. Si ya se aplicaron algunas, las migraciones tienen su receta de `ROLLBACK:` en el encabezado: se ejecutan
  **en orden inverso** (`20261022000100`, `20261022000000`, `20261021000300`, `20261021000200`, `20261021000100`).
  Ojo: deshacer `20261022000100` borra el libro de movimientos (el stock queda como estaba en el caché).
- **Falla el código ya desplegado (paso 8 o 9):** en Vercel → Deployments, **Promote** el despliegue anterior para volver el código al
  instante. Pero el código viejo **no** funciona del todo con la base nueva (no puede borrar ni escribir el stock directo),
  así que si el problema es de la aplicación lo más sano es **corregir hacia adelante** y no volver atrás.
- **Volver todo al estado anterior (último recurso):** restaurar el respaldo del paso 1. Primero probá la restauración en una
  base **de prueba** (un proyecto de Supabase nuevo o local) con `esquema.sql` y después `datos.sql`
  (`psql` contra esa base), y verificá que los datos estén. Restaurar sobre producción borra lo que se cargó después del respaldo:
  hacelo solo si no hay otra salida, con el portal sin uso, y guardá antes un dump nuevo del estado actual.
- Las fotos del bucket no se tocan en ningún paso, así que no hace falta restaurarlas.
