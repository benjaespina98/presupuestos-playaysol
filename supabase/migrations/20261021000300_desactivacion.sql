-- =============================================================================
-- DESACTIVAR EN LUGAR DE BORRAR: catálogo de precios, proveedores y materiales
-- =============================================================================
--
-- Estas tres tablas YA tienen `activo boolean not null default true` ("dado de
-- baja" en la interfaz vieja). Se reutiliza esa columna y se le suma quién y
-- cuándo lo desactivó:
--
--   * Columnas desactivado_at y desactivado_por en catalogo_items, proveedores
--     y materiales. Las fija un trigger desde el servidor: lo que mande el
--     cliente se ignora.
--   * Trigger BEFORE INSERT OR UPDATE `controlar_desactivacion()`:
--       activo true  -> false : desactivado_at = now(), desactivado_por = auth.uid()
--       activo false -> true  : se limpian las dos (reactivar; queda en `auditoria`)
--       sin cambio de `activo`: se conservan las que ya había (no se pueden falsificar)
--   * Sin DELETE: se eliminan las policies y se revoca el privilegio a anon y
--     authenticated. (Desde el SQL Editor, como superusuario, un DELETE sigue
--     siendo posible, pero queda registrado en `auditoria`.)
--
-- Los ítems que ya estaban dados de baja antes de esta migración quedan con
-- desactivado_at = null (no se sabe cuándo se desactivaron). `activo` sigue
-- siendo la fuente de verdad.
--
-- Los presupuestos ya guardados no cambian: cada uno congela sus precios.
--
-- Idempotente. No borra datos.
--
-- ROLLBACK:
--   drop trigger if exists trg_desactivacion_catalogo_items on public.catalogo_items;
--   drop trigger if exists trg_desactivacion_proveedores on public.proveedores;
--   drop trigger if exists trg_desactivacion_materiales on public.materiales;
--   drop function if exists public.controlar_desactivacion();
--   -- (las columnas desactivado_* se pueden dejar; si no: alter table ... drop column ...)
--   create policy "Authenticated users can delete catalogo_items" on public.catalogo_items
--     for delete to authenticated using (clave not like '\_\_%');
--   create policy "Authenticated users can delete proveedores" on public.proveedores
--     for delete to authenticated using (true);
--   create policy "Authenticated users can delete materiales" on public.materiales
--     for delete to authenticated using (true);
--   grant delete on public.catalogo_items, public.proveedores, public.materiales to authenticated;
-- =============================================================================

alter table public.catalogo_items
  add column if not exists desactivado_at timestamptz,
  add column if not exists desactivado_por uuid references auth.users (id);

alter table public.proveedores
  add column if not exists desactivado_at timestamptz,
  add column if not exists desactivado_por uuid references auth.users (id);

alter table public.materiales
  add column if not exists desactivado_at timestamptz,
  add column if not exists desactivado_por uuid references auth.users (id);

create or replace function public.controlar_desactivacion()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.activo then
      new.desactivado_at := null;
      new.desactivado_por := null;
    else
      new.desactivado_at := now();
      new.desactivado_por := auth.uid();
    end if;
  elsif old.activo and not new.activo then
    -- Se desactiva ahora: quién y cuándo los pone el servidor.
    new.desactivado_at := now();
    new.desactivado_por := auth.uid();
  elsif not old.activo and new.activo then
    -- Se reactiva: ya no está desactivado.
    new.desactivado_at := null;
    new.desactivado_por := null;
  else
    -- `activo` no cambió: lo que ya estaba no se toca ni se puede pisar desde el cliente.
    new.desactivado_at := old.desactivado_at;
    new.desactivado_por := old.desactivado_por;
  end if;
  return new;
end;
$$;

revoke all on function public.controlar_desactivacion() from public, anon, authenticated;

drop trigger if exists trg_desactivacion_catalogo_items on public.catalogo_items;
create trigger trg_desactivacion_catalogo_items
  before insert or update on public.catalogo_items
  for each row
  execute function public.controlar_desactivacion();

drop trigger if exists trg_desactivacion_proveedores on public.proveedores;
create trigger trg_desactivacion_proveedores
  before insert or update on public.proveedores
  for each row
  execute function public.controlar_desactivacion();

drop trigger if exists trg_desactivacion_materiales on public.materiales;
create trigger trg_desactivacion_materiales
  before insert or update on public.materiales
  for each row
  execute function public.controlar_desactivacion();

-- ── Sin DELETE ───────────────────────────────────────────────────────────────
drop policy if exists "Authenticated users can delete catalogo_items" on public.catalogo_items;
drop policy if exists "Authenticated users can delete proveedores" on public.proveedores;
drop policy if exists "Authenticated users can delete materiales" on public.materiales;

revoke delete, truncate on public.catalogo_items from anon, authenticated;
revoke delete, truncate on public.proveedores from anon, authenticated;
revoke delete, truncate on public.materiales from anon, authenticated;
