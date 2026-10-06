-- Proveedores y materiales (la parte de "abastecimiento" del catálogo).
--
-- Correr UNA vez en el SQL Editor de Supabase. Es seguro re-ejecutarla.
--
-- Hasta ahora esto vivía sólo en la planilla de costos (hojas Proveedores y
-- Artículos). Pasa al catálogo web, que es la fuente única; la planilla se
-- actualiza desde acá.
--
-- Esta migración sólo crea las tablas y sus permisos: NO trae datos. Los datos
-- reales (nombres, teléfonos, precios de costo) no se guardan en el repo, que
-- es público: se cargan aparte, desde la pantalla o con un SQL de importación.

-- 1) Proveedores --------------------------------------------------------------
create table if not exists public.proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  rubro text,
  contacto text,
  telefono text,
  forma_pago text,
  plazo text,
  notas text,
  -- false = dado de baja: deja de ofrecerse al cargar un material, no se borra.
  activo boolean not null default true,
  orden integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create unique index if not exists proveedores_nombre_unico
  on public.proveedores (lower(nombre));

drop trigger if exists trg_proveedores_updated_at on public.proveedores;
create trigger trg_proveedores_updated_at
  before update on public.proveedores
  for each row
  execute function public.set_updated_at();

-- 2) Materiales ---------------------------------------------------------------
create table if not exists public.materiales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  -- Si se elimina el proveedor, el material queda sin proveedor (no se pierde).
  proveedor_id uuid references public.proveedores(id) on delete set null,
  unidad text,
  -- null = precio a confirmar con el proveedor.
  precio numeric check (precio is null or precio >= 0),
  precio_actualizado date,
  rubro text,
  -- Cuándo entra en el pedido: Siempre, Losetas, Deck, Luz, Luz (fija), ...
  aplica text,
  -- Precio de referencia en dólares, si el proveedor cotiza en USD.
  usd_ref numeric check (usd_ref is null or usd_ref >= 0),
  notas text,
  -- Cantidad a pedir por tamaño de pileta: {"5x3": 50, "6x3": 60, ...}
  cantidades jsonb not null default '{}'::jsonb,
  activo boolean not null default true,
  orden integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create unique index if not exists materiales_nombre_unico
  on public.materiales (lower(nombre));
create index if not exists materiales_proveedor_idx
  on public.materiales (proveedor_id);

drop trigger if exists trg_materiales_updated_at on public.materiales;
create trigger trg_materiales_updated_at
  before update on public.materiales
  for each row
  execute function public.set_updated_at();

-- 3) Permisos: el equipo (usuarios autenticados) lee y edita todo --------------
alter table public.proveedores enable row level security;
alter table public.materiales enable row level security;

do $$
declare
  t text;
  op text;
begin
  foreach t in array array['proveedores', 'materiales'] loop
    foreach op in array array['select', 'insert', 'update', 'delete'] loop
      if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = t
          and policyname = 'Authenticated users can ' || op || ' ' || t
      ) then
        if op = 'select' or op = 'delete' then
          execute format(
            'create policy %I on public.%I for %s to authenticated using (true)',
            'Authenticated users can ' || op || ' ' || t, t, op);
        elsif op = 'insert' then
          execute format(
            'create policy %I on public.%I for insert to authenticated with check (true)',
            'Authenticated users can insert ' || t, t);
        else
          execute format(
            'create policy %I on public.%I for update to authenticated using (true) with check (true)',
            'Authenticated users can update ' || t, t);
        end if;
      end if;
    end loop;
  end loop;
end $$;
