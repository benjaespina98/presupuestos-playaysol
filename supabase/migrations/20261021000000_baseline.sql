-- =============================================================================
-- BASELINE — reconstrucción del esquema actual a partir de los archivos del repo
-- =============================================================================
--
--   ██  NO EJECUTAR EN PRODUCCIÓN.  ██
--
-- El esquema que describe este archivo YA EXISTE en producción. Ejecutarlo allá
-- no destruiría datos (todo es idempotente y no hay DROP de tablas ni de
-- columnas), pero tampoco hace falta, y puede pisar policies que se hayan
-- ajustado a mano. En producción esta migración se MARCA como aplicada, sin
-- correrla:
--
--     supabase migration repair --status applied 20261021000000
--
-- (ver docs/migraciones.md). Sólo sirve para levantar una base desde cero en
-- local (`supabase db reset`) y como punto de partida de las migraciones
-- siguientes.
--
-- Es una RECONSTRUCCIÓN, no un volcado de producción: se armó leyendo, en este
-- orden, los archivos supabase/schema.sql, migration_catalogo_items,
-- migration_perfiles_ownership, migration_limpieza, migration_catalogo_categorias,
-- migration_catalogo_eliminar, migration_proveedores_materiales,
-- migration_pedidos, migration_stock_piscinas, y las dos de higiene
-- (migration_presupuestos_insert_autor y migration_storage_sin_update). Las
-- migraciones sólo de DATOS (listas de piscinas, cascada, USD ref.) no están
-- acá: los datos de ejemplo para local viven en supabase/seed.sql.
-- Hay que compararla con el esquema real (docs/migraciones.md) antes de marcarla.
--
-- A CONFIRMAR contra producción (el repo no lo dice):
--   * "Anyone can view presupuesto images" (select público sobre el bucket): acá
--     figura porque schema.sql la crea. migration_limpieza.sql sugiere borrarla
--     (permite LISTAR las fotos); si ya la borraste en producción, el diff va a
--     mostrarlo y ese es el estado correcto.
--   * Que migration_stock_piscinas.sql (columna stock y su CHECK) esté aplicada.
--
-- ROLLBACK: no aplica (es el estado base). En local, `supabase db reset`.
-- =============================================================================

-- ── Función compartida de updated_at ─────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── presupuestos ─────────────────────────────────────────────────────────────
create table if not exists public.presupuestos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('piscinas', 'revestimientos', 'cobertores', 'cercos', 'losetas')),
  cliente_nombre text not null,
  datos jsonb not null,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_presupuestos_updated_at on public.presupuestos;
create trigger trg_presupuestos_updated_at
  before update on public.presupuestos
  for each row
  execute function public.set_updated_at();

create index if not exists idx_presupuestos_tipo on public.presupuestos (tipo);
create index if not exists idx_presupuestos_created_at on public.presupuestos (created_at desc);
create index if not exists idx_presupuestos_created_by on public.presupuestos (created_by);

alter table public.presupuestos enable row level security;

drop policy if exists "Authenticated users can read presupuestos" on public.presupuestos;
create policy "Authenticated users can read presupuestos"
  on public.presupuestos for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert presupuestos" on public.presupuestos;
drop policy if exists "Users can insert presupuestos as themselves" on public.presupuestos;
create policy "Users can insert presupuestos as themselves"
  on public.presupuestos for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "Authenticated users can update presupuestos" on public.presupuestos;
drop policy if exists "Users can update their own presupuestos" on public.presupuestos;
create policy "Users can update their own presupuestos"
  on public.presupuestos for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "Authenticated users can delete presupuestos" on public.presupuestos;
drop policy if exists "Users can delete their own presupuestos" on public.presupuestos;
create policy "Users can delete their own presupuestos"
  on public.presupuestos for delete
  to authenticated
  using (created_by = auth.uid());

-- ── perfiles ─────────────────────────────────────────────────────────────────
create table if not exists public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  nombre text
);

alter table public.perfiles enable row level security;

drop policy if exists "Authenticated users can read perfiles" on public.perfiles;
create policy "Authenticated users can read perfiles"
  on public.perfiles for select
  to authenticated
  using (true);

drop policy if exists "Users can upsert their own perfil" on public.perfiles;
create policy "Users can upsert their own perfil"
  on public.perfiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "Users can update their own perfil" on public.perfiles;
create policy "Users can update their own perfil"
  on public.perfiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, email, nombre)
  values (new.id, new.email, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

insert into public.perfiles (id, email, nombre)
select id, email, email from auth.users
on conflict (id) do nothing;

-- ── catalogo_items ───────────────────────────────────────────────────────────
create table if not exists public.catalogo_items (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('piscinas', 'cercos', 'cobertores', 'revestimientos', 'losetas')),
  clave text not null,
  descripcion text,
  precio numeric,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  categoria text,
  unidad text,
  activo boolean not null default true,
  orden integer,
  stock integer,
  unique (tipo, clave)
);

-- Por si la tabla ya existía con menos columnas (re-ejecución sobre una base vieja).
alter table public.catalogo_items
  add column if not exists categoria text,
  add column if not exists unidad    text,
  add column if not exists activo    boolean not null default true,
  add column if not exists orden     integer,
  add column if not exists stock     integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'catalogo_items_categoria_valida') then
    alter table public.catalogo_items
      add constraint catalogo_items_categoria_valida
      check (categoria is null or categoria in (
        'Piscinas', 'Filtración', 'Revestimientos', 'Iluminación', 'Cobertores',
        'Cercos', 'Accesorios', 'Mano de obra', 'Otros'
      ));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'catalogo_items_stock_no_negativo') then
    alter table public.catalogo_items
      add constraint catalogo_items_stock_no_negativo
      check (stock is null or stock >= 0);
  end if;
end $$;

create index if not exists idx_catalogo_items_categoria
  on public.catalogo_items (categoria) where activo;

drop trigger if exists trg_catalogo_items_updated_at on public.catalogo_items;
create trigger trg_catalogo_items_updated_at
  before update on public.catalogo_items
  for each row
  execute function public.set_updated_at();

alter table public.catalogo_items enable row level security;

drop policy if exists "Authenticated users can read catalogo_items" on public.catalogo_items;
create policy "Authenticated users can read catalogo_items"
  on public.catalogo_items for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert catalogo_items" on public.catalogo_items;
create policy "Authenticated users can insert catalogo_items"
  on public.catalogo_items for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update catalogo_items" on public.catalogo_items;
create policy "Authenticated users can update catalogo_items"
  on public.catalogo_items for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete catalogo_items" on public.catalogo_items;
create policy "Authenticated users can delete catalogo_items"
  on public.catalogo_items for delete
  to authenticated
  using (clave not like '\_\_%');

-- ── proveedores ──────────────────────────────────────────────────────────────
create table if not exists public.proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  rubro text,
  contacto text,
  telefono text,
  forma_pago text,
  plazo text,
  notas text,
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

-- ── materiales ───────────────────────────────────────────────────────────────
create table if not exists public.materiales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  unidad text,
  precio numeric check (precio is null or precio >= 0),
  precio_actualizado date,
  rubro text,
  aplica text,
  usd_ref numeric check (usd_ref is null or usd_ref >= 0),
  notas text,
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

alter table public.proveedores enable row level security;
alter table public.materiales enable row level security;

drop policy if exists "Authenticated users can select proveedores" on public.proveedores;
create policy "Authenticated users can select proveedores"
  on public.proveedores for select to authenticated using (true);
drop policy if exists "Authenticated users can delete proveedores" on public.proveedores;
create policy "Authenticated users can delete proveedores"
  on public.proveedores for delete to authenticated using (true);
drop policy if exists "Authenticated users can insert proveedores" on public.proveedores;
create policy "Authenticated users can insert proveedores"
  on public.proveedores for insert to authenticated with check (true);
drop policy if exists "Authenticated users can update proveedores" on public.proveedores;
create policy "Authenticated users can update proveedores"
  on public.proveedores for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can select materiales" on public.materiales;
create policy "Authenticated users can select materiales"
  on public.materiales for select to authenticated using (true);
drop policy if exists "Authenticated users can delete materiales" on public.materiales;
create policy "Authenticated users can delete materiales"
  on public.materiales for delete to authenticated using (true);
drop policy if exists "Authenticated users can insert materiales" on public.materiales;
create policy "Authenticated users can insert materiales"
  on public.materiales for insert to authenticated with check (true);
drop policy if exists "Authenticated users can update materiales" on public.materiales;
create policy "Authenticated users can update materiales"
  on public.materiales for update to authenticated using (true) with check (true);

-- ── pedidos ──────────────────────────────────────────────────────────────────
create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  obra text not null default '',
  solicitante text not null default '',
  parametros jsonb not null,
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

alter table public.pedidos enable row level security;

drop policy if exists "Authenticated users can select pedidos" on public.pedidos;
create policy "Authenticated users can select pedidos"
  on public.pedidos for select to authenticated using (true);
drop policy if exists "Authenticated users can delete pedidos" on public.pedidos;
create policy "Authenticated users can delete pedidos"
  on public.pedidos for delete to authenticated using (true);
drop policy if exists "Authenticated users can insert pedidos" on public.pedidos;
create policy "Authenticated users can insert pedidos"
  on public.pedidos for insert to authenticated with check (true);
drop policy if exists "Authenticated users can update pedidos" on public.pedidos;
create policy "Authenticated users can update pedidos"
  on public.pedidos for update to authenticated using (true) with check (true);

-- ── Storage: bucket de fotos de presupuestos ─────────────────────────────────
insert into storage.buckets (id, name, public)
values ('presupuestos', 'presupuestos', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can upload presupuesto images" on storage.objects;
create policy "Authenticated users can upload presupuesto images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'presupuestos');

-- Sin policy de update (migration_storage_sin_update.sql).
drop policy if exists "Authenticated users can update presupuesto images" on storage.objects;

drop policy if exists "Anyone can view presupuesto images" on storage.objects;
create policy "Anyone can view presupuesto images"
  on storage.objects for select
  to public
  using (bucket_id = 'presupuestos');
