-- =============================================================================
-- AUDITORÍA: quién cambió qué y cuándo (append-only)
-- =============================================================================
--
-- Una tabla `auditoria` que sólo crece y un trigger genérico que la llena desde
-- presupuestos, pedidos, catalogo_items, proveedores y materiales.
--
-- QUÉ SE GUARDA
--   * tabla, registro_id, accion (INSERT/UPDATE/DELETE), usuario_id (auth.uid(),
--     null si el cambio vino del SQL Editor o de una clave de servicio) y fecha.
--   * columnas_cambiadas: los NOMBRES de las columnas que cambiaron (en un
--     INSERT/DELETE, todas). Se ignora `updated_at`: cambia siempre, es ruido.
--   * valores: {"antes": {...}, "despues": {...}} sólo de las columnas que
--     cambiaron Y que no son sensibles. En INSERT sólo "despues", en DELETE sólo
--     "antes".
--
-- QUÉ NUNCA SE GUARDA: el valor de una columna sensible. De esas queda sólo el
-- nombre en columnas_cambiadas ("cliente_nombre cambió", no a qué). Cada trigger
-- recibe por argumento la lista de columnas sensibles de su tabla:
--   presupuestos : cliente_nombre, datos (datos del cliente y montos), anulado_motivo
--   pedidos      : obra, solicitante, parametros, lineas, costo, notas, anulado_motivo
--   proveedores  : contacto, telefono, notas
--   materiales   : notas
--   catalogo_items: (ninguna) — los precios de venta SÍ se registran, antes y después.
--   Para materiales el costo (`precio`) tampoco es sensible: es justamente lo
--   que interesa ver cambiar, y ya lo puede leer todo usuario autenticado.
--
-- SEGURIDAD
--   * RLS activada: SELECT para authenticated, sin policies de escritura.
--   * REVOKE de INSERT/UPDATE/DELETE/TRUNCATE a anon y authenticated.
--   * Triggers que rechazan UPDATE, DELETE y TRUNCATE incluso del dueño de la
--     tabla (para borrarla habría que eliminar el trigger a propósito).
--   * La función de auditoría es SECURITY DEFINER (escribe aunque el usuario no
--     pueda), con search_path fijo. Es función de trigger: no se puede llamar
--     desde el cliente, por eso no lleva GRANT EXECUTE.
--
-- Idempotente. No borra datos.
--
-- ROLLBACK (en este orden):
--   drop trigger if exists trg_auditoria_presupuestos on public.presupuestos;
--   drop trigger if exists trg_auditoria_pedidos on public.pedidos;
--   drop trigger if exists trg_auditoria_catalogo_items on public.catalogo_items;
--   drop trigger if exists trg_auditoria_proveedores on public.proveedores;
--   drop trigger if exists trg_auditoria_materiales on public.materiales;
--   drop function if exists public.auditar_cambios();
--   drop trigger if exists trg_auditoria_solo_agregar on public.auditoria;
--   drop trigger if exists trg_auditoria_sin_truncate on public.auditoria;
--   drop function if exists public.auditoria_solo_agregar();
--   drop table if exists public.auditoria;   -- ¡pierde todo el historial!
-- =============================================================================

create table if not exists public.auditoria (
  id bigint generated always as identity primary key,
  tabla text not null,
  registro_id uuid not null,
  accion text not null check (accion in ('INSERT', 'UPDATE', 'DELETE')),
  usuario_id uuid,
  fecha timestamptz not null default now(),
  columnas_cambiadas text[] not null default '{}',
  valores jsonb
);

create index if not exists idx_auditoria_registro
  on public.auditoria (tabla, registro_id, fecha desc);
create index if not exists idx_auditoria_fecha
  on public.auditoria (fecha desc);

alter table public.auditoria enable row level security;

drop policy if exists "Authenticated users can read auditoria" on public.auditoria;
create policy "Authenticated users can read auditoria"
  on public.auditoria for select
  to authenticated
  using (true);

-- Supabase otorga todo por defecto a anon y authenticated sobre las tablas nuevas de public.
revoke all on public.auditoria from public, anon, authenticated;
revoke truncate on public.auditoria from public, anon, authenticated;
grant select on public.auditoria to authenticated;

-- ── Append-only ──────────────────────────────────────────────────────────────
create or replace function public.auditoria_solo_agregar()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'La tabla auditoria es de sólo agregar: no se admite % (registro histórico inmutable).', tg_op
    using errcode = '42501';
end;
$$;

drop trigger if exists trg_auditoria_solo_agregar on public.auditoria;
create trigger trg_auditoria_solo_agregar
  before update or delete on public.auditoria
  for each row
  execute function public.auditoria_solo_agregar();

drop trigger if exists trg_auditoria_sin_truncate on public.auditoria;
create trigger trg_auditoria_sin_truncate
  before truncate on public.auditoria
  for each statement
  execute function public.auditoria_solo_agregar();

-- ── Trigger genérico ─────────────────────────────────────────────────────────
-- Argumentos del trigger (tg_argv): los nombres de las columnas sensibles.
create or replace function public.auditar_cambios()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sensibles constant text[] := coalesce(tg_argv, '{}'::text[]);
  -- Cambia en cada UPDATE por el trigger set_updated_at: no aporta información.
  ignoradas constant text[] := array['updated_at'];
  v_antes jsonb;
  v_despues jsonb;
  v_cambiadas text[];
  v_valores jsonb;
  v_id uuid;
begin
  if tg_op = 'INSERT' then
    v_despues := to_jsonb(new);
    v_id := (v_despues ->> 'id')::uuid;
    select coalesce(array_agg(k order by k), '{}') into v_cambiadas
      from jsonb_object_keys(v_despues) as k
      where k <> all (ignoradas);
    v_valores := jsonb_build_object('despues', v_despues - sensibles - ignoradas);

  elsif tg_op = 'UPDATE' then
    v_antes := to_jsonb(old);
    v_despues := to_jsonb(new);
    v_id := (v_despues ->> 'id')::uuid;
    select coalesce(array_agg(k order by k), '{}') into v_cambiadas
      from jsonb_object_keys(v_despues) as k
      where k <> all (ignoradas)
        and (v_antes -> k) is distinct from (v_despues -> k);
    -- Un UPDATE que no cambió nada (aparte de updated_at) no es un hecho que auditar.
    if coalesce(array_length(v_cambiadas, 1), 0) = 0 then
      return null;
    end if;
    -- Sólo las columnas que cambiaron y no son sensibles.
    select jsonb_build_object(
             'antes',   coalesce(jsonb_object_agg(k, v_antes -> k), '{}'::jsonb),
             'despues', coalesce(jsonb_object_agg(k, v_despues -> k), '{}'::jsonb))
      into v_valores
      from unnest(v_cambiadas) as k
      where k <> all (sensibles);
    if v_valores = '{"antes": {}, "despues": {}}'::jsonb then
      v_valores := null;
    end if;

  else -- DELETE
    v_antes := to_jsonb(old);
    v_id := (v_antes ->> 'id')::uuid;
    select coalesce(array_agg(k order by k), '{}') into v_cambiadas
      from jsonb_object_keys(v_antes) as k
      where k <> all (ignoradas);
    v_valores := jsonb_build_object('antes', v_antes - sensibles - ignoradas);
  end if;

  insert into public.auditoria (tabla, registro_id, accion, usuario_id, columnas_cambiadas, valores)
  values (tg_table_name, v_id, tg_op, auth.uid(), v_cambiadas, v_valores);

  return null; -- trigger AFTER: el valor de retorno se ignora
end;
$$;

revoke all on function public.auditar_cambios() from public, anon, authenticated;

-- ── Triggers por tabla ───────────────────────────────────────────────────────
drop trigger if exists trg_auditoria_presupuestos on public.presupuestos;
create trigger trg_auditoria_presupuestos
  after insert or update or delete on public.presupuestos
  for each row
  execute function public.auditar_cambios('cliente_nombre', 'datos', 'anulado_motivo');

drop trigger if exists trg_auditoria_pedidos on public.pedidos;
create trigger trg_auditoria_pedidos
  after insert or update or delete on public.pedidos
  for each row
  execute function public.auditar_cambios('obra', 'solicitante', 'parametros', 'lineas', 'costo', 'notas', 'anulado_motivo');

drop trigger if exists trg_auditoria_catalogo_items on public.catalogo_items;
create trigger trg_auditoria_catalogo_items
  after insert or update or delete on public.catalogo_items
  for each row
  execute function public.auditar_cambios();

drop trigger if exists trg_auditoria_proveedores on public.proveedores;
create trigger trg_auditoria_proveedores
  after insert or update or delete on public.proveedores
  for each row
  execute function public.auditar_cambios('contacto', 'telefono', 'notas');

drop trigger if exists trg_auditoria_materiales on public.materiales;
create trigger trg_auditoria_materiales
  after insert or update or delete on public.materiales
  for each row
  execute function public.auditar_cambios('notas');
