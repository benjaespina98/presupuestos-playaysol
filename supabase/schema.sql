-- Tabla principal de presupuestos
create table if not exists public.presupuestos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('piscinas', 'revestimientos', 'cobertores', 'cercos', 'losetas')),
  cliente_nombre text not null,
  datos jsonb not null,
  imagen_url text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mantiene updated_at al día en cada UPDATE
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_presupuestos_updated_at on public.presupuestos;
create trigger trg_presupuestos_updated_at
  before update on public.presupuestos
  for each row
  execute function public.set_updated_at();

create index if not exists idx_presupuestos_tipo on public.presupuestos (tipo);
create index if not exists idx_presupuestos_created_at on public.presupuestos (created_at desc);

-- Row Level Security: solo usuarios autenticados pueden leer/escribir
alter table public.presupuestos enable row level security;

create policy "Authenticated users can read presupuestos"
  on public.presupuestos for select
  to authenticated
  using (true);

create policy "Authenticated users can insert presupuestos"
  on public.presupuestos for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update presupuestos"
  on public.presupuestos for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can delete presupuestos"
  on public.presupuestos for delete
  to authenticated
  using (true);

-- Storage: bucket público de solo lectura para las imágenes de presupuestos
insert into storage.buckets (id, name, public)
values ('presupuestos', 'presupuestos', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload presupuesto images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'presupuestos');

create policy "Authenticated users can update presupuesto images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'presupuestos');

create policy "Anyone can view presupuesto images"
  on storage.objects for select
  to public
  using (bucket_id = 'presupuestos');
