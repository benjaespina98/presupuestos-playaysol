-- Pedidos de materiales guardados (historial con número correlativo y estado).
--
-- Correr UNA vez en el SQL Editor de Supabase, DESPUÉS de
-- migration_proveedores_materiales.sql. Es seguro re-ejecutarla.
--
-- Cada pedido guarda una FOTO de lo que se pidió (líneas con su proveedor,
-- cantidad y precio del momento): si después cambia un precio o se da de baja un
-- material, el pedido de ayer sigue diciendo lo que se pidió. Esta migración sólo
-- crea la tabla y sus permisos: NO trae datos.

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  -- Correlativo: 1, 2, 3... Lo asigna la base; en pantalla se ve como PED-0001.
  numero bigint generated always as identity,
  obra text not null default '',
  solicitante text not null default '',
  -- Tamaño de pileta, obras, borde, luces, etc. con que se calculó.
  parametros jsonb not null,
  -- Las líneas pedidas, cada una con su proveedor, cantidad, unidad y precio.
  lineas jsonb not null default '[]'::jsonb,
  costo numeric not null default 0 check (costo >= 0),
  estado text not null default 'borrador'
    check (estado in ('borrador', 'enviado', 'recibido', 'cancelado')),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create unique index if not exists pedidos_numero_unico on public.pedidos (numero);
create index if not exists pedidos_estado_idx on public.pedidos (estado);
create index if not exists pedidos_creado_idx on public.pedidos (created_at desc);

drop trigger if exists trg_pedidos_updated_at on public.pedidos;
create trigger trg_pedidos_updated_at
  before update on public.pedidos
  for each row
  execute function public.set_updated_at();

-- Permisos: el equipo (usuarios autenticados) lee y edita todo.
alter table public.pedidos enable row level security;

do $$
declare
  op text;
begin
  foreach op in array array['select', 'insert', 'update', 'delete'] loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'pedidos'
        and policyname = 'Authenticated users can ' || op || ' pedidos'
    ) then
      if op = 'select' or op = 'delete' then
        execute format(
          'create policy %I on public.pedidos for %s to authenticated using (true)',
          'Authenticated users can ' || op || ' pedidos', op);
      elsif op = 'insert' then
        execute format(
          'create policy %I on public.pedidos for insert to authenticated with check (true)',
          'Authenticated users can insert pedidos');
      else
        execute format(
          'create policy %I on public.pedidos for update to authenticated using (true) with check (true)',
          'Authenticated users can update pedidos');
      end if;
    end if;
  end loop;
end $$;
