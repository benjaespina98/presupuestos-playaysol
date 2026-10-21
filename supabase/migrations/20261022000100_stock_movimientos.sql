-- =============================================================================
-- STOCK CON MOVIMIENTOS: libro append-only + funciones atómicas
-- =============================================================================
--
-- Hasta ahora el stock era un contador editable (`catalogo_items.stock`) que el
-- navegador escribía con un valor absoluto: dos personas a la vez se pisaban y no
-- quedaba historia. Ahora:
--
--   * `movimientos_stock` es el LIBRO: sólo se agregan filas, nunca se editan ni
--     se borran. Corregir un error es agregar otro movimiento (ajuste o anulación,
--     que es un contra-asiento).
--   * `catalogo_items.stock` pasa a ser un CACHÉ de la suma del libro, mantenido
--     por un trigger. Nadie lo escribe directo.
--   * Todo cambio de stock entra por TRES funciones atómicas (bloquean la fila del
--     ítem con FOR UPDATE antes de leer el stock):
--       registrar_movimiento_stock(item, 'ingreso'|'venta', cantidad, clave, ...)
--       ajustar_stock(item, stock_contado, motivo, clave)   -- la BASE calcula la diferencia
--       anular_movimiento_stock(movimiento, motivo, clave)  -- contra-asiento
--     y son idempotentes: la misma clave dos veces no aplica nada la segunda vez.
--
-- DECISIONES
--   * Un solo local. Un ítem lleva stock si `catalogo_items.stock` no es null.
--     (La tabla no guardaba stock por local, no había nada que sumar.)
--   * El stock NEGATIVO está permitido: la venta que lo deja así se hace y se
--     avisa (`stock_negativo = true` en la respuesta), no se bloquea. Por eso esta
--     migración ELIMINA el CHECK `catalogo_items_stock_no_negativo` (creado por
--     migration_stock_piscinas.sql: `check (stock is null or stock >= 0)`).
--   * Errores con SQLSTATE propios (el cliente los traduce a mensajes claros):
--       ST002 ítem inexistente · ST003 el ítem no lleva stock · ST004 datos
--       inválidos · ST005 clave de idempotencia reutilizada con otros datos ·
--       ST006 movimiento que no se puede anular · ST007 ya anulado ·
--       ST010 escritura directa del stock · ST011 ítem nuevo con stock.
--
-- ORDEN DE ESTA MIGRACIÓN (importa): tablas y funciones, aperturas de los ítems
-- que ya tienen stock, y RECIÉN DESPUÉS los triggers de caché y de protección
-- (si estuvieran antes, cada apertura volvería a sumarse). Al final se aborta si
-- el caché no coincide con el libro.
--
-- Antes de aplicarla en producción, correr supabase/diagnostics/stock.sql
-- (sólo lectura) para ver qué ítems tienen stock y su CHECK actual.
--
-- Idempotente (re-ejecutable). No borra datos.
--
-- ROLLBACK (el libro y sus aperturas se pierden; el stock queda como estaba en el caché):
--   drop trigger if exists trg_catalogo_items_proteger_stock on public.catalogo_items;
--   drop trigger if exists trg_movimientos_stock_cache on public.movimientos_stock;
--   drop function if exists public.proteger_stock_cache();
--   drop function if exists public.actualizar_cache_stock();
--   drop function if exists public.verificar_consistencia_stock();
--   drop function if exists public.crear_aperturas_stock();
--   drop function if exists public.registrar_movimiento_stock(uuid, text, integer, text, text, text);
--   drop function if exists public.ajustar_stock(uuid, integer, text, text);
--   drop function if exists public.anular_movimiento_stock(uuid, text, text);
--   drop function if exists public.stock_resultado_json(public.movimientos_stock, boolean);
--   drop table if exists public.movimientos_stock;
--   -- sólo si NO hay stock negativo:
--   alter table public.catalogo_items add constraint catalogo_items_stock_no_negativo
--     check (stock is null or stock >= 0);
-- =============================================================================

-- ── 1) El CHECK de stock no negativo se elimina ──────────────────────────────
alter table public.catalogo_items drop constraint if exists catalogo_items_stock_no_negativo;

-- ── 2) El libro ──────────────────────────────────────────────────────────────
create table if not exists public.movimientos_stock (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.catalogo_items (id) on delete restrict,
  tipo text not null check (tipo in ('apertura', 'ingreso', 'venta', 'ajuste', 'anulacion')),
  -- Con signo: ingreso/apertura suman, venta resta; ajuste y anulación según el caso.
  cantidad integer not null check (cantidad <> 0),
  stock_resultante integer not null,
  motivo text check (motivo is null or char_length(btrim(motivo)) between 3 and 500),
  referencia text check (referencia is null or char_length(referencia) <= 200),
  idempotency_key text not null unique check (char_length(idempotency_key) between 8 and 100),
  anula_a uuid unique references public.movimientos_stock (id) on delete restrict,
  creado_por uuid references auth.users (id),
  creado_at timestamptz not null default now(),
  constraint movimientos_stock_signo_por_tipo check (
    (tipo in ('ingreso', 'apertura') and cantidad > 0)
    or (tipo = 'venta' and cantidad < 0)
    or tipo in ('ajuste', 'anulacion')
  ),
  constraint movimientos_stock_motivo_obligatorio check (
    tipo not in ('ajuste', 'anulacion') or motivo is not null
  ),
  constraint movimientos_stock_anula_coherente check ((tipo = 'anulacion') = (anula_a is not null))
);

create index if not exists idx_movimientos_stock_item
  on public.movimientos_stock (item_id, creado_at desc);

alter table public.movimientos_stock enable row level security;

drop policy if exists "Authenticated users can read movimientos_stock" on public.movimientos_stock;
create policy "Authenticated users can read movimientos_stock"
  on public.movimientos_stock for select
  to authenticated
  using (true);

-- Sin escritura directa: sólo las funciones de abajo (SECURITY DEFINER) insertan.
revoke all on public.movimientos_stock from public, anon, authenticated;
grant select on public.movimientos_stock to authenticated;

-- Append-only: ni siquiera el dueño de la tabla puede reescribir el libro.
create or replace function public.movimientos_stock_solo_agregar()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'El libro de movimientos de stock es de sólo agregar: no se admite %. Para corregir, creá un ajuste o una anulación.', tg_op
    using errcode = '42501';
end;
$$;

drop trigger if exists trg_movimientos_stock_solo_agregar on public.movimientos_stock;
create trigger trg_movimientos_stock_solo_agregar
  before update or delete on public.movimientos_stock
  for each row
  execute function public.movimientos_stock_solo_agregar();

drop trigger if exists trg_movimientos_stock_sin_truncate on public.movimientos_stock;
create trigger trg_movimientos_stock_sin_truncate
  before truncate on public.movimientos_stock
  for each statement
  execute function public.movimientos_stock_solo_agregar();

-- ── 3) Piezas internas ───────────────────────────────────────────────────────
-- La respuesta común de las tres funciones.
create or replace function public.stock_resultado_json(m public.movimientos_stock, repetido boolean)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'movimiento_id', m.id,
    'tipo', m.tipo,
    'cantidad', m.cantidad,
    'stock_resultante', m.stock_resultante,
    'stock_negativo', m.stock_resultante < 0,
    'repetido', repetido
  );
$$;

revoke all on function public.stock_resultado_json(public.movimientos_stock, boolean) from public, anon, authenticated;

-- ── 4) registrar_movimiento_stock: ingreso y venta ───────────────────────────
create or replace function public.registrar_movimiento_stock(
  p_item uuid,
  p_tipo text,
  p_cantidad integer,
  p_idempotency_key text,
  p_referencia text default null,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_ref text := nullif(btrim(coalesce(p_referencia, '')), '');
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_stock integer;
  v_firmada integer;
  v_prev public.movimientos_stock;
  v_mov public.movimientos_stock;
begin
  if v_uid is null then
    raise exception 'Necesitás iniciar sesión.' using errcode = '42501';
  end if;
  if p_tipo is null or p_tipo not in ('ingreso', 'venta') then
    raise exception 'El tipo de movimiento tiene que ser ingreso o venta.' using errcode = 'ST004';
  end if;
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 10000 then
    raise exception 'La cantidad tiene que ser un número entero de 1 a 10000.' using errcode = 'ST004';
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 100 then
    raise exception 'La clave de idempotencia tiene que tener entre 8 y 100 caracteres.' using errcode = 'ST004';
  end if;
  if v_ref is not null and char_length(v_ref) > 200 then
    raise exception 'La referencia es demasiado larga (máximo 200 caracteres).' using errcode = 'ST004';
  end if;
  if v_motivo is not null and char_length(v_motivo) not between 3 and 500 then
    raise exception 'El motivo tiene que tener entre 3 y 500 caracteres.' using errcode = 'ST004';
  end if;

  -- Se bloquea la fila del ítem ANTES de leer el stock: dos llamadas simultáneas se ordenan acá.
  select stock into v_stock from public.catalogo_items where id = p_item for update;
  if not found then
    raise exception 'El ítem no existe.' using errcode = 'ST002';
  end if;

  -- Idempotencia: la misma clave con los mismos datos devuelve el movimiento original.
  select * into v_prev from public.movimientos_stock where idempotency_key = p_idempotency_key;
  if found then
    if v_prev.item_id = p_item and v_prev.tipo = p_tipo and abs(v_prev.cantidad) = p_cantidad
       and v_prev.referencia is not distinct from v_ref and v_prev.motivo is not distinct from v_motivo
       and v_prev.creado_por is not distinct from v_uid then
      return public.stock_resultado_json(v_prev, true);
    end if;
    raise exception 'Esa operación ya se registró con otros datos (clave repetida).' using errcode = 'ST005';
  end if;

  if v_stock is null then
    raise exception 'Este ítem no lleva stock.' using errcode = 'ST003';
  end if;

  v_firmada := case when p_tipo = 'venta' then -p_cantidad else p_cantidad end;

  begin
    insert into public.movimientos_stock (item_id, tipo, cantidad, stock_resultante, motivo, referencia, idempotency_key, creado_por)
    values (p_item, p_tipo, v_firmada, v_stock + v_firmada, v_motivo, v_ref, p_idempotency_key, v_uid)
    returning * into v_mov;
  exception when unique_violation then
    -- Carrera: otra llamada con la misma clave (sobre otro ítem, que no compartía el bloqueo) ganó.
    select * into v_prev from public.movimientos_stock where idempotency_key = p_idempotency_key;
    if found and v_prev.item_id = p_item and v_prev.tipo = p_tipo and abs(v_prev.cantidad) = p_cantidad
       and v_prev.referencia is not distinct from v_ref and v_prev.motivo is not distinct from v_motivo
       and v_prev.creado_por is not distinct from v_uid then
      return public.stock_resultado_json(v_prev, true);
    end if;
    raise exception 'Esa operación ya se registró con otros datos (clave repetida).' using errcode = 'ST005';
  end;

  return public.stock_resultado_json(v_mov, false);
end;
$$;

-- ── 5) ajustar_stock: el cliente manda el CONTEO, la base calcula la diferencia ─
create or replace function public.ajustar_stock(
  p_item uuid,
  p_stock_contado integer,
  p_motivo text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_stock integer;
  v_dif integer;
  v_prev public.movimientos_stock;
  v_mov public.movimientos_stock;
begin
  if v_uid is null then
    raise exception 'Necesitás iniciar sesión.' using errcode = '42501';
  end if;
  if p_stock_contado is null or p_stock_contado < 0 or p_stock_contado > 1000000 then
    raise exception 'El conteo tiene que ser un número entero de 0 en adelante.' using errcode = 'ST004';
  end if;
  if v_motivo is null or char_length(v_motivo) not between 3 and 500 then
    raise exception 'El ajuste necesita un motivo de entre 3 y 500 caracteres.' using errcode = 'ST004';
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 100 then
    raise exception 'La clave de idempotencia tiene que tener entre 8 y 100 caracteres.' using errcode = 'ST004';
  end if;

  select stock into v_stock from public.catalogo_items where id = p_item for update;
  if not found then
    raise exception 'El ítem no existe.' using errcode = 'ST002';
  end if;

  select * into v_prev from public.movimientos_stock where idempotency_key = p_idempotency_key;
  if found then
    -- En un ajuste, stock_resultante ES el conteo que se había pedido.
    if v_prev.item_id = p_item and v_prev.tipo = 'ajuste' and v_prev.stock_resultante = p_stock_contado
       and v_prev.motivo is not distinct from v_motivo and v_prev.creado_por is not distinct from v_uid then
      return public.stock_resultado_json(v_prev, true);
    end if;
    raise exception 'Esa operación ya se registró con otros datos (clave repetida).' using errcode = 'ST005';
  end if;

  if v_stock is null then
    raise exception 'Este ítem no lleva stock.' using errcode = 'ST003';
  end if;

  -- La diferencia se calcula ACÁ, con la fila bloqueada: si el stock cambió mientras
  -- la persona contaba, el ajuste igual deja el stock en lo que contó.
  v_dif := p_stock_contado - v_stock;
  if v_dif = 0 then
    return jsonb_build_object(
      'movimiento_id', null, 'tipo', 'ajuste', 'cantidad', 0,
      'stock_resultante', v_stock, 'stock_negativo', v_stock < 0, 'repetido', false);
  end if;

  begin
    insert into public.movimientos_stock (item_id, tipo, cantidad, stock_resultante, motivo, idempotency_key, creado_por)
    values (p_item, 'ajuste', v_dif, p_stock_contado, v_motivo, p_idempotency_key, v_uid)
    returning * into v_mov;
  exception when unique_violation then
    select * into v_prev from public.movimientos_stock where idempotency_key = p_idempotency_key;
    if found and v_prev.item_id = p_item and v_prev.tipo = 'ajuste' and v_prev.stock_resultante = p_stock_contado
       and v_prev.motivo is not distinct from v_motivo and v_prev.creado_por is not distinct from v_uid then
      return public.stock_resultado_json(v_prev, true);
    end if;
    raise exception 'Esa operación ya se registró con otros datos (clave repetida).' using errcode = 'ST005';
  end;

  return public.stock_resultado_json(v_mov, false);
end;
$$;

-- ── 6) anular_movimiento_stock: contra-asiento ───────────────────────────────
create or replace function public.anular_movimiento_stock(
  p_movimiento uuid,
  p_motivo text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_orig public.movimientos_stock;
  v_stock integer;
  v_prev public.movimientos_stock;
  v_mov public.movimientos_stock;
begin
  if v_uid is null then
    raise exception 'Necesitás iniciar sesión.' using errcode = '42501';
  end if;
  if v_motivo is null or char_length(v_motivo) not between 3 and 500 then
    raise exception 'La anulación necesita un motivo de entre 3 y 500 caracteres.' using errcode = 'ST004';
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 100 then
    raise exception 'La clave de idempotencia tiene que tener entre 8 y 100 caracteres.' using errcode = 'ST004';
  end if;

  select * into v_orig from public.movimientos_stock where id = p_movimiento;
  if not found then
    raise exception 'El movimiento no existe.' using errcode = 'ST002';
  end if;

  select stock into v_stock from public.catalogo_items where id = v_orig.item_id for update;

  select * into v_prev from public.movimientos_stock where idempotency_key = p_idempotency_key;
  if found then
    if v_prev.tipo = 'anulacion' and v_prev.anula_a = p_movimiento
       and v_prev.motivo is not distinct from v_motivo and v_prev.creado_por is not distinct from v_uid then
      return public.stock_resultado_json(v_prev, true);
    end if;
    raise exception 'Esa operación ya se registró con otros datos (clave repetida).' using errcode = 'ST005';
  end if;

  if v_orig.tipo in ('anulacion', 'apertura') then
    raise exception 'Una anulación o una apertura no se anula: para corregir el stock usá un ajuste.' using errcode = 'ST006';
  end if;
  -- Con el ítem bloqueado, esta lectura ya ve cualquier anulación concurrente.
  if exists (select 1 from public.movimientos_stock where anula_a = p_movimiento) then
    raise exception 'Este movimiento ya está anulado.' using errcode = 'ST007';
  end if;
  if v_stock is null then
    raise exception 'Este ítem no lleva stock.' using errcode = 'ST003';
  end if;

  begin
    insert into public.movimientos_stock (item_id, tipo, cantidad, stock_resultante, motivo, idempotency_key, anula_a, creado_por)
    values (v_orig.item_id, 'anulacion', -v_orig.cantidad, v_stock - v_orig.cantidad, v_motivo, p_idempotency_key, p_movimiento, v_uid)
    returning * into v_mov;
  exception when unique_violation then
    select * into v_prev from public.movimientos_stock where idempotency_key = p_idempotency_key;
    if found and v_prev.tipo = 'anulacion' and v_prev.anula_a = p_movimiento
       and v_prev.motivo is not distinct from v_motivo and v_prev.creado_por is not distinct from v_uid then
      return public.stock_resultado_json(v_prev, true);
    end if;
    raise exception 'Este movimiento ya está anulado.' using errcode = 'ST007';
  end;

  return public.stock_resultado_json(v_mov, false);
end;
$$;

-- Sólo usuarios autenticados llaman a las funciones públicas.
revoke all on function public.registrar_movimiento_stock(uuid, text, integer, text, text, text) from public, anon;
revoke all on function public.ajustar_stock(uuid, integer, text, text) from public, anon;
revoke all on function public.anular_movimiento_stock(uuid, text, text) from public, anon;
grant execute on function public.registrar_movimiento_stock(uuid, text, integer, text, text, text) to authenticated;
grant execute on function public.ajustar_stock(uuid, integer, text, text) to authenticated;
grant execute on function public.anular_movimiento_stock(uuid, text, text) to authenticated;

-- ── 7) Consistencia: el caché tiene que ser la suma del libro ────────────────
create or replace function public.verificar_consistencia_stock()
returns table (item_id uuid, clave text, stock_cache integer, suma_movimientos bigint)
language sql
stable
set search_path = public, pg_temp
as $$
  select c.id, c.clave, c.stock, coalesce(m.suma, 0)
  from public.catalogo_items c
  left join (
    select item_id, sum(cantidad) as suma from public.movimientos_stock group by item_id
  ) m on m.item_id = c.id
  where (c.stock is not null and c.stock <> coalesce(m.suma, 0))
     or (c.stock is null and coalesce(m.suma, 0) <> 0);
$$;

revoke all on function public.verificar_consistencia_stock() from public, anon;
grant execute on function public.verificar_consistencia_stock() to authenticated;

-- ── 8) Aperturas: el stock que ya existe entra al libro ──────────────────────
-- Una función (y no un bloque anónimo) para poder probarla. Idempotente: sólo
-- toca ítems con stock distinto de 0 y que todavía no tienen ningún movimiento.
-- Corre ANTES de crear los triggers de caché y de protección (ver más abajo).
create or replace function public.crear_aperturas_stock()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_creadas integer;
begin
  with nuevas as (
    insert into public.movimientos_stock (item_id, tipo, cantidad, stock_resultante, motivo, idempotency_key, creado_por)
    select c.id, 'apertura', c.stock, c.stock, 'Stock inicial al pasar al libro de movimientos', 'apertura-' || c.id::text, null
    from public.catalogo_items c
    where c.stock is not null and c.stock <> 0
      and not exists (select 1 from public.movimientos_stock m where m.item_id = c.id)
    on conflict (idempotency_key) do nothing
    returning 1
  )
  select count(*) into v_creadas from nuevas;
  return v_creadas;
end;
$$;

revoke all on function public.crear_aperturas_stock() from public, anon, authenticated;

do $$
declare
  v_creadas integer;
  v_otros text;
begin
  -- Ítems que NO son piscinas de fibra Indusplast pero llevan stock: no se tocan, se listan.
  select string_agg(tipo || ':' || clave || '=' || stock, ', ' order by tipo, clave) into v_otros
    from public.catalogo_items
   where stock is not null and not (tipo = 'piscinas' and clave like 'indusplast\_%');
  if v_otros is not null then
    raise notice 'Ítems con stock que NO son fibra Indusplast (se conservan tal cual): %', v_otros;
  end if;

  v_creadas := public.crear_aperturas_stock();
  raise notice 'Movimientos de apertura creados: %', v_creadas;
end $$;

-- ── 9) Triggers de caché y de protección (RECIÉN ACÁ) ────────────────────────
-- Caché: cada movimiento nuevo deja el stock del ítem igual a la suma del libro.
create or replace function public.actualizar_cache_stock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.catalogo_items
     set stock = (select coalesce(sum(cantidad), 0) from public.movimientos_stock where item_id = new.item_id)
   where id = new.item_id;
  return null;
end;
$$;

revoke all on function public.actualizar_cache_stock() from public, anon, authenticated;

drop trigger if exists trg_movimientos_stock_cache on public.movimientos_stock;
create trigger trg_movimientos_stock_cache
  after insert on public.movimientos_stock
  for each row
  execute function public.actualizar_cache_stock();

-- Protección: el stock sólo lo cambia el trigger de arriba.
--
-- Cómo se distingue: `pg_trigger_depth()` cuenta cuántos triggers están anidados.
-- Un UPDATE directo de un usuario ejecuta ESTE trigger a profundidad 1; el que hace
-- `actualizar_cache_stock()` (él mismo un trigger) lo ejecuta a profundidad 2.
-- Límite conocido: otro trigger futuro que haga UPDATE de stock también pasaría;
-- por eso las funciones públicas son la única vía y hay un test que lo vigila.
-- Se permite una sola excepción directa: activar o desactivar "llevar stock"
-- (null -> 0, y 0 -> null), porque el interruptor del catálogo lo necesita.
-- Desde el SQL Editor (superusuario) un UPDATE de stock también se rechaza; para
-- cargar datos de prueba se puede usar `set session_replication_role = replica`.
create or replace function public.proteger_stock_cache()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.stock is not null and new.stock <> 0 then
      raise exception 'Un ítem nuevo sólo puede crearse sin stock o con stock 0: cargá las unidades con un ingreso.'
        using errcode = 'ST011';
    end if;
  elsif new.stock is distinct from old.stock and pg_trigger_depth() <= 1 then
    if not ((old.stock is null and new.stock = 0) or (old.stock = 0 and new.stock is null)) then
      raise exception 'El stock no se modifica directamente: usá Ingreso, Venta o Ajustar conteo.'
        using errcode = 'ST010';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.proteger_stock_cache() from public, anon, authenticated;

drop trigger if exists trg_catalogo_items_proteger_stock on public.catalogo_items;
create trigger trg_catalogo_items_proteger_stock
  before insert or update on public.catalogo_items
  for each row
  execute function public.proteger_stock_cache();

-- ── 10) Última barrera: si el caché no coincide con el libro, esta migración se aborta ──
do $$
declare
  v_malos text;
begin
  select string_agg(clave || ' (caché ' || coalesce(stock_cache::text, 'null') || ' ≠ libro ' || suma_movimientos || ')', ', ')
    into v_malos
    from public.verificar_consistencia_stock();
  if v_malos is not null then
    raise exception 'Stock inconsistente después de las aperturas: %', v_malos;
  end if;
end $$;
