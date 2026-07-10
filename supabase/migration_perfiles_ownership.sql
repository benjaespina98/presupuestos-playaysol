-- Ownership real de presupuestos + tabla de perfiles visibles desde el cliente.
--
-- Hoy cualquier usuario autenticado puede editar o borrar el presupuesto de
-- CUALQUIER otro usuario (las policies de update/delete en presupuestos.sql
-- usan `using (true)`, sin mirar created_by). Esto reemplaza esas dos policies
-- por unas que solo dejan tocar la fila al dueño (created_by = auth.uid()).
--
-- Además, el cliente (browser) no puede leer auth.users directamente — no es
-- una tabla expuesta por PostgREST/RLS normal. Por eso esta migración crea
-- "perfiles", una tabla espejo con (id, email, nombre) que sí es legible desde
-- el Historial para mostrar "creado por" y armar el filtro por usuario.
--
-- Correr esto UNA vez en el SQL Editor de Supabase (Dashboard → SQL Editor).
-- Es seguro re-ejecutar: todo usa `if not exists` / `or replace` / `on conflict`.

-- 1) Tabla de perfiles ------------------------------------------------------
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

-- Cada usuario solo puede tocar su propia fila (para que en el futuro puedan
-- editar su "nombre" desde algún ajuste de cuenta, si se agrega esa pantalla).
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

-- 2) Alta automática: cuando se crea un usuario nuevo en auth.users, se le
--    crea su fila en perfiles con el email como nombre por defecto. Así no
--    hay que acordarse de esto manualmente cada vez que se invita a alguien.
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

-- 3) Seed: completar perfiles con los usuarios que YA existen hoy (el
--    trigger de arriba solo dispara para altas futuras). El "nombre" arranca
--    igual al email; para ponerle un nombre lindo a cada uno, correr después:
--      update public.perfiles set nombre = 'Nombre real' where email = 'x@x.com';
insert into public.perfiles (id, email, nombre)
select id, email, email from auth.users
on conflict (id) do nothing;

-- 4) Ownership real en presupuestos: solo el dueño edita/borra su fila -------
drop policy if exists "Authenticated users can update presupuestos" on public.presupuestos;
create policy "Users can update their own presupuestos"
  on public.presupuestos for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "Authenticated users can delete presupuestos" on public.presupuestos;
create policy "Users can delete their own presupuestos"
  on public.presupuestos for delete
  to authenticated
  using (created_by = auth.uid());

-- Lectura e inserción quedan como estaban (cualquier autenticado ve todo y
-- puede crear presupuestos propios) — no hace falta tocarlas.
