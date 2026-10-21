-- =============================================================================
-- ANULAR EN LUGAR DE BORRAR: presupuestos y pedidos
-- =============================================================================
--
-- Un presupuesto o un pedido ya no se borra: se ANULA, con un motivo, y queda
-- visible y exportable pero congelado.
--
--   * Columnas anulado_at, anulado_por, anulado_motivo (las tres vacías, o
--     anulado_at + motivo de 3 a 500 caracteres: CHECK `*_anulacion_consistente`).
--   * Trigger BEFORE UPDATE `controlar_anulacion()`:
--       (a) rechaza CUALQUIER modificación de un registro ya anulado (editarlo
--           o intentar revertir la anulación);
--       (b) al pasar a anulado, fija anulado_at = now() y anulado_por = auth.uid()
--           desde el servidor, ignorando lo que mande el cliente;
--       (c) al anular no deja cambiar ningún otro dato en el mismo UPDATE.
--   * Sin DELETE: se eliminan las policies y se revoca el privilegio a anon y
--     authenticated. (Desde el SQL Editor, como superusuario, un DELETE sigue
--     siendo posible, pero queda registrado en `auditoria`.)
--
-- Quién puede anular: quien ya puede hacer UPDATE. En presupuestos, sólo su
-- creador (policy "Users can update their own presupuestos"); en pedidos,
-- cualquier usuario autenticado, igual que el borrado que reemplaza.
--
-- Requiere 20261021000100_auditoria.sql (los triggers de auditoría ya
-- conocen la columna anulado_motivo como sensible). Idempotente. No borra datos.
--
-- ROLLBACK:
--   drop trigger if exists trg_anulacion_presupuestos on public.presupuestos;
--   drop trigger if exists trg_anulacion_pedidos on public.pedidos;
--   drop function if exists public.controlar_anulacion();
--   alter table public.presupuestos drop constraint if exists presupuestos_anulacion_consistente;
--   alter table public.pedidos drop constraint if exists pedidos_anulacion_consistente;
--   -- Las columnas anulado_* se pueden dejar (sin datos no estorban); si se
--   -- quieren quitar: alter table ... drop column anulado_at, anulado_por, anulado_motivo;
--   create policy "Users can delete their own presupuestos" on public.presupuestos
--     for delete to authenticated using (created_by = auth.uid());
--   create policy "Authenticated users can delete pedidos" on public.pedidos
--     for delete to authenticated using (true);
--   grant delete on public.presupuestos, public.pedidos to authenticated;
-- =============================================================================

-- ── Columnas ─────────────────────────────────────────────────────────────────
alter table public.presupuestos
  add column if not exists anulado_at timestamptz,
  add column if not exists anulado_por uuid references auth.users (id),
  add column if not exists anulado_motivo text;

alter table public.pedidos
  add column if not exists anulado_at timestamptz,
  add column if not exists anulado_por uuid references auth.users (id),
  add column if not exists anulado_motivo text;

-- ── Consistencia ─────────────────────────────────────────────────────────────
-- (anulado_por puede ser null si se anuló desde el SQL Editor: no hay auth.uid().)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'presupuestos_anulacion_consistente') then
    alter table public.presupuestos
      add constraint presupuestos_anulacion_consistente
      check (
        (anulado_at is null and anulado_por is null and anulado_motivo is null)
        or (anulado_at is not null
            and anulado_motivo is not null
            and char_length(btrim(anulado_motivo)) between 3 and 500)
      );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pedidos_anulacion_consistente') then
    alter table public.pedidos
      add constraint pedidos_anulacion_consistente
      check (
        (anulado_at is null and anulado_por is null and anulado_motivo is null)
        or (anulado_at is not null
            and anulado_motivo is not null
            and char_length(btrim(anulado_motivo)) between 3 and 500)
      );
  end if;
end $$;

create index if not exists idx_presupuestos_anulado on public.presupuestos (anulado_at)
  where anulado_at is not null;
create index if not exists idx_pedidos_anulado on public.pedidos (anulado_at)
  where anulado_at is not null;

-- ── Trigger ──────────────────────────────────────────────────────────────────
create or replace function public.controlar_anulacion()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  -- Columnas que pueden cambiar en el UPDATE que anula (updated_* los toca el sistema o el cliente).
  permitidas constant text[] := array['anulado_at', 'anulado_por', 'anulado_motivo', 'updated_at', 'updated_by'];
begin
  -- (a) Un registro anulado no se toca más: ni se edita ni se "desanula".
  if old.anulado_at is not null then
    raise exception 'El registro está anulado y no se puede modificar.'
      using errcode = '42501';
  end if;

  -- ¿Este UPDATE intenta anular? (cualquiera de las tres columnas con valor)
  if new.anulado_at is not null or new.anulado_por is not null or new.anulado_motivo is not null then
    if new.anulado_motivo is null or char_length(btrim(new.anulado_motivo)) not between 3 and 500 then
      raise exception 'Para anular hace falta un motivo de entre 3 y 500 caracteres.'
        using errcode = '23514';
    end if;

    -- (c) Anular no es editar: ningún otro dato puede cambiar en el mismo UPDATE.
    if (to_jsonb(new) - permitidas) is distinct from (to_jsonb(old) - permitidas) then
      raise exception 'Al anular no se puede modificar ningún otro dato.'
        using errcode = '42501';
    end if;

    -- (b) Quién y cuándo los pone el servidor, no el cliente.
    new.anulado_motivo := btrim(new.anulado_motivo);
    new.anulado_at := now();
    new.anulado_por := auth.uid();
  end if;

  return new;
end;
$$;

revoke all on function public.controlar_anulacion() from public, anon, authenticated;

drop trigger if exists trg_anulacion_presupuestos on public.presupuestos;
create trigger trg_anulacion_presupuestos
  before update on public.presupuestos
  for each row
  execute function public.controlar_anulacion();

drop trigger if exists trg_anulacion_pedidos on public.pedidos;
create trigger trg_anulacion_pedidos
  before update on public.pedidos
  for each row
  execute function public.controlar_anulacion();

-- ── Sin DELETE ───────────────────────────────────────────────────────────────
drop policy if exists "Users can delete their own presupuestos" on public.presupuestos;
drop policy if exists "Authenticated users can delete presupuestos" on public.presupuestos;
drop policy if exists "Authenticated users can delete pedidos" on public.pedidos;

revoke delete, truncate on public.presupuestos from anon, authenticated;
revoke delete, truncate on public.pedidos from anon, authenticated;
