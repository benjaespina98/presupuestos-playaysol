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
npx supabase test db    # corre los tests pgTAP de supabase/tests/database
npx supabase stop       # detiene SOLO este proyecto (sin --all)
```

`db reset` y `test db` actúan contra la base local; no hace falta (ni conviene)
tener el proyecto "linkeado" a producción para correrlos.
