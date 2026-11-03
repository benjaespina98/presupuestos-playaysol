-- =============================================================================
-- Endurecimiento (auditoría 2026-11-03). No cambia quién puede hacer qué dentro
-- del equipo: los roles siguen sin existir. Cierra lo que el cliente podía falsear
-- o mandar fuera de rango saltándose la pantalla (la anon key es pública):
--
--   1. anon sin ningún permiso sobre las tablas (hasta ahora sólo lo frenaba RLS).
--   2. updated_by / created_by no se pueden falsear: si el cliente intenta poner
--      un autor, queda el usuario de la sesión. created_at no se reescribe.
--   3. perfiles: el email no se puede cambiar desde el cliente (se mostraría como
--      autor de los presupuestos); los perfiles sólo los crea el trigger de alta.
--   4. Topes de valores y largos en la base, con NOT VALID: valen para lo que se
--      escribe de acá en adelante y no revisan ni rompen lo que ya existe. El tope
--      de precio además rechaza 'NaN', que `precio >= 0` deja pasar en Postgres.
--   5. Bucket de fotos: sólo imágenes y hasta 10 MB. Es público, así que un HTML o
--      un SVG subido ahí se podía servir desde el dominio de Supabase.
--   6. search_path fijo en las dos funciones de la baseline que no lo tenían.
--
-- Sin auth.uid() (SQL Editor, clave de servicio) los triggers no intervienen.
--
-- ROLLBACK:
--   drop trigger if exists trg_autor_catalogo_items on public.catalogo_items;
--   drop trigger if exists trg_autor_proveedores on public.proveedores;
--   drop trigger if exists trg_autor_materiales on public.materiales;
--   drop trigger if exists trg_autor_pedidos on public.pedidos;
--   drop trigger if exists trg_autoria_pedidos on public.pedidos;
--   drop trigger if exists trg_autoria_presupuestos on public.presupuestos;
--   drop function if exists public.fijar_updated_by();
--   drop function if exists public.fijar_autoria();
--   grant insert, update on public.perfiles to authenticated;
--   alter table public.catalogo_items drop constraint if exists catalogo_items_valores_razonables;
--   alter table public.materiales drop constraint if exists materiales_valores_razonables;
--   alter table public.proveedores drop constraint if exists proveedores_valores_razonables;
--   alter table public.pedidos drop constraint if exists pedidos_valores_razonables;
--   alter table public.presupuestos drop constraint if exists presupuestos_valores_razonables;
--   update storage.buckets set file_size_limit = null, allowed_mime_types = null where id = 'presupuestos';
--   grant select, insert, update, delete on public.presupuestos, public.perfiles, public.catalogo_items,
--     public.proveedores, public.materiales, public.pedidos to anon;
-- =============================================================================

-- ── 1. anon sin permisos sobre las tablas ────────────────────────────────────
revoke all on public.presupuestos, public.perfiles, public.catalogo_items,
  public.proveedores, public.materiales, public.pedidos from anon;

-- ── 2. Autoría que fija el servidor ──────────────────────────────────────────
-- Sólo interviene cuando el cliente intenta cambiar el autor: el caché de stock
-- (que no toca updated_by) no ensucia el autor del último cambio de precio.
create or replace function public.fijar_updated_by()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null
     and (tg_op = 'INSERT' or new.updated_by is distinct from old.updated_by) then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

revoke all on function public.fijar_updated_by() from public, anon, authenticated;

drop trigger if exists trg_autor_catalogo_items on public.catalogo_items;
create trigger trg_autor_catalogo_items
  before insert or update on public.catalogo_items
  for each row execute function public.fijar_updated_by();

drop trigger if exists trg_autor_proveedores on public.proveedores;
create trigger trg_autor_proveedores
  before insert or update on public.proveedores
  for each row execute function public.fijar_updated_by();

drop trigger if exists trg_autor_materiales on public.materiales;
create trigger trg_autor_materiales
  before insert or update on public.materiales
  for each row execute function public.fijar_updated_by();

drop trigger if exists trg_autor_pedidos on public.pedidos;
create trigger trg_autor_pedidos
  before insert or update on public.pedidos
  for each row execute function public.fijar_updated_by();

-- Quién creó un registro y cuándo no cambian nunca. En presupuestos la policy ya
-- obliga a created_by = auth.uid(); esto agrega created_at y cubre pedidos.
create or replace function public.fijar_autoria()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

revoke all on function public.fijar_autoria() from public, anon, authenticated;

drop trigger if exists trg_autoria_pedidos on public.pedidos;
create trigger trg_autoria_pedidos
  before insert or update on public.pedidos
  for each row execute function public.fijar_autoria();

drop trigger if exists trg_autoria_presupuestos on public.presupuestos;
create trigger trg_autoria_presupuestos
  before insert or update on public.presupuestos
  for each row execute function public.fijar_autoria();

-- ── 3. perfiles ──────────────────────────────────────────────────────────────
-- El portal sólo los lee; el alta la hace handle_new_user (security definer).
revoke insert, update on public.perfiles from authenticated;
grant update (nombre) on public.perfiles to authenticated;

-- ── 4. Topes de valores y largos ─────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'catalogo_items_valores_razonables') then
    alter table public.catalogo_items add constraint catalogo_items_valores_razonables check (
      (precio is null or (precio >= 0 and precio < 1e13))
      and char_length(clave) <= 200
      and char_length(coalesce(descripcion, '')) <= 20000
    ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'materiales_valores_razonables') then
    alter table public.materiales add constraint materiales_valores_razonables check (
      (precio is null or precio < 1e13)
      and (usd_ref is null or usd_ref < 1e10)
      and char_length(nombre) <= 300
      and char_length(coalesce(notas, '')) <= 2000
      and jsonb_typeof(cantidades) = 'object'
    ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'proveedores_valores_razonables') then
    alter table public.proveedores add constraint proveedores_valores_razonables check (
      char_length(nombre) <= 200
      and char_length(coalesce(notas, '')) <= 2000
    ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'pedidos_valores_razonables') then
    alter table public.pedidos add constraint pedidos_valores_razonables check (
      costo < 1e13
      and char_length(obra) <= 500
      and char_length(solicitante) <= 200
      and char_length(coalesce(notas, '')) <= 2000
      and jsonb_typeof(lineas) = 'array'
      and jsonb_typeof(parametros) = 'object'
      and pg_column_size(lineas) < 2000000
    ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'presupuestos_valores_razonables') then
    alter table public.presupuestos add constraint presupuestos_valores_razonables check (
      jsonb_typeof(datos) = 'object'
      and pg_column_size(datos) < 5000000
    ) not valid;
  end if;
end $$;

-- ── 5. Bucket de fotos ───────────────────────────────────────────────────────
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'presupuestos';

-- ── 6. search_path fijo ──────────────────────────────────────────────────────
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.handle_new_user() set search_path = public, pg_temp;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
