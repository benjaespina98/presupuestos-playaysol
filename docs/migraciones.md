# Migraciones de la base de datos

La base es Supabase (Postgres). Hasta ahora los cambios se escribían como
`supabase/migration_*.sql` y se pegaban a mano en el SQL Editor, sin registro de
cuál corrió. Desde ahora hay **migraciones versionadas** en `supabase/migrations/`.

> Los `migration_*.sql` y `schema.sql` viejos **no se tocan ni se borran**: son
> el historial de cómo se llegó hasta acá. Las migraciones nuevas van sólo en
> `supabase/migrations/`.

## Convención

- Carpeta: `supabase/migrations/`.
- Nombre: `AAAAMMDDHHMMSS_descripcion_corta.sql` (hora UTC, minúsculas y guiones
  bajos). El orden de aplicación es el orden alfabético, o sea el del timestamp.
- Cada migración debe ser, mientras sea razonable, **idempotente**
  (`create ... if not exists`, `drop policy if exists` + `create policy`,
  `create or replace function`) y **nunca borrar datos** (sin `drop table` ni
  `drop column`).
- Cada migración termina con un comentario `ROLLBACK:` con las sentencias para
  deshacerla. El rollback no se aplica solo: es una receta.
- Funciones `SECURITY DEFINER`: siempre con `set search_path = public, pg_temp`,
  `revoke all ... from public, anon` y `grant execute` sólo a `authenticated`
  cuando la función se llama desde el cliente. Las funciones de trigger no se
  llaman desde el cliente, no necesitan `grant`.
- Toda tabla nueva lleva `alter table ... enable row level security`.

## Migraciones actuales

| Archivo | Qué hace |
|---|---|
| `20261021000000_baseline.sql` | Reconstrucción del esquema actual (ver abajo). **No se ejecuta en producción.** |
| `20261021000100_auditoria.sql` | Tabla `auditoria` (sólo agregar) y triggers en presupuestos, pedidos, catálogo, proveedores y materiales. |
| `20261021000200_anulacion.sql` | Anular presupuestos y pedidos con motivo; sin DELETE. |
| `20261021000300_desactivacion.sql` | Desactivar (no borrar) catálogo, proveedores y materiales, con quién y cuándo; sin DELETE. |

`supabase/seed.sql` carga el catálogo de precios inicial en la base **local**
(se corre solo con `supabase db reset`; nunca en producción).

## La baseline

`20261021000000_baseline.sql` es lo que el repo dice que hay en producción:
tablas, índices, RLS, funciones, triggers, el bucket `presupuestos` y sus
policies, incluidas las dos migraciones de higiene (`migration_presupuestos_insert_autor`
y `migration_storage_sin_update`). **Es una reconstrucción**, no un volcado.

### Comparar la baseline con tu esquema real

Objetivo: confirmar que la baseline describe lo mismo que producción, antes de
marcarla como aplicada. Todo se hace en tu máquina; no pegues el esquema en
ningún chat ni lo subas al repo.

1. Sacá el esquema de producción a un archivo local (por ejemplo `esquema.sql`)
   fuera del repo, con el método que ya usaste (`pg_dump --schema-only` o el
   volcado del panel de Supabase). Si el archivo tiene la clave de conexión en
   algún comentario, borrala.
2. Armá el esquema de la baseline en una base local:

   ```bash
   npx supabase start
   npx supabase db reset
   npx supabase db dump --local --schema public -f esquema_baseline.sql
   ```

   (`--local` apunta al Postgres de Docker en `127.0.0.1:54322`; nunca uses
   `--linked` ni `db push` para esto.)
3. Compará, ignorando orden y comentarios:

   ```bash
   diff <(grep -v '^--' esquema.sql | sort) <(grep -v '^--' esquema_baseline.sql | sort) | less
   ```

   Un diff de texto crudo va a mostrar ruido (orden, nombres de constraints
   autogenerados, `SET`s del volcado). Lo que importa: **tablas, columnas y
   tipos, policies, triggers y funciones**. Cualquier diferencia real se corrige
   **en la baseline** (no en producción).
4. Dos cosas puntuales que el repo no puede confirmar:
   - Si existe la policy `Anyone can view presupuesto images` en `storage.objects`.
   - Si la columna `catalogo_items.stock` y su CHECK existen.

### Marcarla como aplicada en producción

Recién cuando el diff esté limpio. Esto **no ejecuta el SQL**, sólo registra que
esa versión ya está:

```bash
npx supabase link --project-ref <tu-project-ref>
npx supabase migration repair --status applied 20261021000000
```

## Probar en local (Docker)

Necesita Docker. El `project_id` de este proyecto es `playaysol-presupuestos`
(`supabase/config.toml`): los contenedores locales se llaman
`supabase_*_playaysol-presupuestos` y usan los puertos 54321–54329. Si tenés
otros proyectos en Docker, no se tocan.

```bash
npx supabase start      # levanta SOLO este proyecto
npx supabase db reset   # recrea la base local: migraciones en orden + seed.sql
npx supabase test db    # corre los tests pgTAP de supabase/tests/database (usa un contenedor pg_prove efímero)
npx supabase stop       # detiene SOLO este proyecto (sin --all)
```

`db reset` y `test db` actúan contra la base local; no hace falta (ni conviene)
tener el proyecto "linkeado" a producción para correrlos.

## Auditoría: ver el historial de un registro

La tabla `auditoria` (migración `20261021000100_auditoria.sql`) es de sólo
agregar. La llenan triggers sobre `presupuestos`, `pedidos`, `catalogo_items`,
`proveedores` y `materiales`. De las columnas sensibles (datos de clientes,
montos de pedidos, teléfonos) guarda **sólo el nombre**, nunca el valor: la lista
está en el encabezado de la migración. Por ahora no hay pantalla; se consulta en
el SQL Editor:

```sql
-- Historial de un registro (cambiar tabla e id)
select a.fecha, a.accion, p.nombre as usuario, a.columnas_cambiadas, a.valores
from public.auditoria a
left join public.perfiles p on p.id = a.usuario_id
where a.tabla = 'catalogo_items'
  and a.registro_id = '00000000-0000-0000-0000-000000000000'
order by a.fecha desc, a.id desc;

-- Cambios de precio del catálogo (antes y después)
select a.fecha, p.nombre as usuario, c.clave,
       a.valores #>> '{antes,precio}'   as precio_antes,
       a.valores #>> '{despues,precio}' as precio_despues
from public.auditoria a
join public.catalogo_items c on c.id = a.registro_id
left join public.perfiles p on p.id = a.usuario_id
where a.tabla = 'catalogo_items' and 'precio' = any (a.columnas_cambiadas)
order by a.fecha desc;
```

`usuario_id` es `null` cuando el cambio se hizo desde el SQL Editor o con la
clave de servicio (por ejemplo, la sincronización con la planilla no escribe,
pero un script manual sí aparecería así).

## Orden de aplicación en producción

1. `supabase migration repair --status applied 20261021000000` (la baseline **no** se ejecuta).
2. Con un respaldo nuevo hecho antes, y recién cuando se despliegue a `main` el código que usa anular/desactivar:
   `20261021000100_auditoria.sql`, `20261021000200_anulacion.sql`, `20261021000300_desactivacion.sql`, **en ese orden**.
   El código nuevo ya no borra: aplicar las migraciones antes que el código rompería el borrado del código viejo, y aplicarlas después deja
   al código nuevo sin las columnas `anulado_*`. Por eso van juntos.
