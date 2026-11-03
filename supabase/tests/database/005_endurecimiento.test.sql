-- Tests del endurecimiento: autoría que fija el servidor, permisos y topes.
-- Se corren contra la base LOCAL:  npx supabase test db
begin;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local');

-- ── anon no tiene ningún permiso, ni siquiera bloqueado por RLS ──────────────
select ok(not has_table_privilege('anon', 'public.materiales', 'select'), 'anon no puede leer materiales (costos)');
select ok(not has_table_privilege('anon', 'public.proveedores', 'select'), 'anon no puede leer proveedores');
select ok(not has_table_privilege('anon', 'public.pedidos', 'select'), 'anon no puede leer pedidos');
select ok(not has_table_privilege('anon', 'public.presupuestos', 'select'), 'anon no puede leer presupuestos');
select ok(not has_table_privilege('anon', 'public.catalogo_items', 'insert'), 'anon no puede escribir el catálogo');
select ok(not has_table_privilege('anon', 'public.perfiles', 'select'), 'anon no puede leer perfiles');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

-- ── updated_by no se puede falsear ───────────────────────────────────────────
insert into public.materiales (id, nombre, updated_by)
values ('00000000-0000-0000-0000-00000000f001', 'Material Autor', '00000000-0000-0000-0000-0000000000b2');
select is((select updated_by from public.materiales where id = '00000000-0000-0000-0000-00000000f001'),
  '00000000-0000-0000-0000-0000000000a1'::uuid, 'al crear, updated_by es quien está en la sesión');

update public.materiales set precio = 10, updated_by = '00000000-0000-0000-0000-0000000000b2'
 where id = '00000000-0000-0000-0000-00000000f001';
select is((select updated_by from public.materiales where id = '00000000-0000-0000-0000-00000000f001'),
  '00000000-0000-0000-0000-0000000000a1'::uuid, 'al editar tampoco se puede poner a otro como autor');

-- ── Pedidos: autoría y fecha de creación ─────────────────────────────────────
insert into public.pedidos (id, parametros, created_by, updated_by, created_at)
values ('00000000-0000-0000-0000-00000000c001', '{}', '00000000-0000-0000-0000-0000000000b2',
        '00000000-0000-0000-0000-0000000000b2', '2000-01-01T00:00:00Z');
select is((select created_by from public.pedidos where id = '00000000-0000-0000-0000-00000000c001'),
  '00000000-0000-0000-0000-0000000000a1'::uuid, 'created_by del pedido es quien está en la sesión');
select ok((select created_at > now() - interval '1 minute' from public.pedidos where id = '00000000-0000-0000-0000-00000000c001'),
  'created_at del pedido es la hora del servidor');

update public.pedidos set created_by = '00000000-0000-0000-0000-0000000000b2', created_at = '2000-01-01T00:00:00Z'
 where id = '00000000-0000-0000-0000-00000000c001';
select is((select created_by from public.pedidos where id = '00000000-0000-0000-0000-00000000c001'),
  '00000000-0000-0000-0000-0000000000a1'::uuid, 'created_by del pedido no se puede reescribir');
select ok((select created_at > now() - interval '1 minute' from public.pedidos where id = '00000000-0000-0000-0000-00000000c001'),
  'created_at del pedido no se puede reescribir');

-- Cambiar el estado (lo que hace la pantalla) sigue andando.
update public.pedidos set estado = 'enviado' where id = '00000000-0000-0000-0000-00000000c001';
select is((select estado from public.pedidos where id = '00000000-0000-0000-0000-00000000c001'), 'enviado', 'el estado se sigue cambiando');

-- ── Topes ────────────────────────────────────────────────────────────────────
select throws_ok(
  $$ insert into public.materiales (nombre, precio) values ('Precio NaN', 'NaN') $$,
  '23514', null, 'un precio NaN no entra');
select throws_ok(
  $$ insert into public.catalogo_items (tipo, clave, precio) values ('cercos', 'item_caro', 1e14) $$,
  '23514', null, 'un precio absurdo no entra en el catálogo');
select throws_ok(
  $$ insert into public.materiales (nombre) values (repeat('x', 301)) $$,
  '23514', null, 'un nombre de material gigante no entra');
select throws_ok(
  $$ insert into public.pedidos (parametros, lineas) values ('{}', '{"no":"es un array"}') $$,
  '23514', null, 'las líneas de un pedido tienen que ser una lista');
select lives_ok(
  $$ insert into public.materiales (nombre, precio) values ('Material Normal', 12500.5) $$,
  'un material normal entra');

-- ── perfiles: el email no se cambia desde el cliente ─────────────────────────
select throws_ok(
  $$ update public.perfiles set email = 'b@test.local' where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '42501', null, 'el email del perfil no se puede cambiar');
select lives_ok(
  $$ update public.perfiles set nombre = 'Otro Nombre' where id = '00000000-0000-0000-0000-0000000000a1' $$,
  'el nombre propio sí');
select throws_ok(
  $$ insert into public.perfiles (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'x@test.local') $$,
  '42501', null, 'el cliente no crea perfiles');

reset role;

-- ── Bucket de fotos ──────────────────────────────────────────────────────────
select is((select file_size_limit from storage.buckets where id = 'presupuestos'), 10485760::bigint, 'las fotos tienen tope de 10 MB');
select ok((select not ('text/html' = any(allowed_mime_types)) from storage.buckets where id = 'presupuestos'), 'no se pueden subir páginas HTML');
select ok((select not ('image/svg+xml' = any(allowed_mime_types)) from storage.buckets where id = 'presupuestos'), 'ni SVG (puede llevar scripts)');
select ok((select 'image/jpeg' = any(allowed_mime_types) from storage.buckets where id = 'presupuestos'), 'las fotos JPEG sí');

select * from finish();
rollback;
