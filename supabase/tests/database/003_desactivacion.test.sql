-- Tests de "desactivar en lugar de borrar" (catálogo, proveedores y materiales).
-- Se corren contra la base LOCAL:  npx supabase test db
begin;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

insert into public.catalogo_items (id, tipo, clave, precio) values ('00000000-0000-0000-0000-00000000d001', 'cercos', 'item_desactivar', 1);
insert into public.proveedores (id, nombre) values ('00000000-0000-0000-0000-00000000e001', 'Proveedor Desactivar');
insert into public.materiales (id, nombre) values ('00000000-0000-0000-0000-00000000f001', 'Material Desactivar');

select is((select activo from public.proveedores where id = '00000000-0000-0000-0000-00000000e001'), true, 'un proveedor nuevo nace activo');
select is((select desactivado_at from public.proveedores where id = '00000000-0000-0000-0000-00000000e001'), null, 'y sin fecha de desactivación');

-- ── Desactivar fija quién y cuándo, desde el servidor ───────────────────────────
update public.proveedores
   set activo = false,
       desactivado_por = '00000000-0000-0000-0000-0000000000b2',
       desactivado_at = '2000-01-01T00:00:00Z'
 where id = '00000000-0000-0000-0000-00000000e001';

select is((select activo from public.proveedores where id = '00000000-0000-0000-0000-00000000e001'), false, 'se desactiva');
select is(
  (select desactivado_por from public.proveedores where id = '00000000-0000-0000-0000-00000000e001'),
  '00000000-0000-0000-0000-0000000000a1'::uuid, 'desactivado_por es quien lo desactivó (A), no lo que mandó el cliente');
select ok(
  (select desactivado_at > now() - interval '1 minute' from public.proveedores where id = '00000000-0000-0000-0000-00000000e001'),
  'desactivado_at es la hora del servidor');

-- Sin cambiar `activo`, lo ya registrado no se puede pisar.
update public.proveedores
   set nombre = 'Proveedor Renombrado',
       desactivado_por = '00000000-0000-0000-0000-0000000000b2',
       desactivado_at = '2001-01-01T00:00:00Z'
 where id = '00000000-0000-0000-0000-00000000e001';
select is(
  (select desactivado_por from public.proveedores where id = '00000000-0000-0000-0000-00000000e001'),
  '00000000-0000-0000-0000-0000000000a1'::uuid, 'editar otra cosa no permite falsificar desactivado_por');
select ok(
  (select desactivado_at > now() - interval '1 minute' from public.proveedores where id = '00000000-0000-0000-0000-00000000e001'),
  'ni desactivado_at');

-- Un activo no puede aparecer con "desactivado por" inventado.
update public.materiales
   set notas = 'x', desactivado_por = '00000000-0000-0000-0000-0000000000b2', desactivado_at = now()
 where id = '00000000-0000-0000-0000-00000000f001';
select is((select desactivado_por from public.materiales where id = '00000000-0000-0000-0000-00000000f001'), null, 'un material activo no puede traer desactivado_por');
select is((select desactivado_at from public.materiales where id = '00000000-0000-0000-0000-00000000f001'), null, 'ni desactivado_at');

-- ── Reactivar limpia las marcas ─────────────────────────────────────────────────
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);

update public.proveedores set activo = true where id = '00000000-0000-0000-0000-00000000e001';
select is((select activo from public.proveedores where id = '00000000-0000-0000-0000-00000000e001'), true, 'se reactiva');
select is((select desactivado_at from public.proveedores where id = '00000000-0000-0000-0000-00000000e001'), null, 'reactivar limpia desactivado_at');
select is((select desactivado_por from public.proveedores where id = '00000000-0000-0000-0000-00000000e001'), null, 'y desactivado_por');

-- ── Lo mismo en materiales y en el catálogo ─────────────────────────────────────
update public.materiales set activo = false where id = '00000000-0000-0000-0000-00000000f001';
select is((select desactivado_por from public.materiales where id = '00000000-0000-0000-0000-00000000f001'), '00000000-0000-0000-0000-0000000000b2'::uuid, 'material: desactivar registra quién');
update public.materiales set activo = true where id = '00000000-0000-0000-0000-00000000f001';
select is((select desactivado_at from public.materiales where id = '00000000-0000-0000-0000-00000000f001'), null, 'material: reactivar limpia');

update public.catalogo_items set activo = false where id = '00000000-0000-0000-0000-00000000d001';
select is((select desactivado_por from public.catalogo_items where id = '00000000-0000-0000-0000-00000000d001'), '00000000-0000-0000-0000-0000000000b2'::uuid, 'catálogo: desactivar registra quién');
select ok((select desactivado_at is not null from public.catalogo_items where id = '00000000-0000-0000-0000-00000000d001'), 'catálogo: y cuándo');
update public.catalogo_items set activo = true where id = '00000000-0000-0000-0000-00000000d001';
select is((select desactivado_at from public.catalogo_items where id = '00000000-0000-0000-0000-00000000d001'), null, 'catálogo: reactivar limpia');

-- Un alta ya desactivada también queda registrada.
insert into public.proveedores (id, nombre, activo) values ('00000000-0000-0000-0000-00000000e002', 'Nace Desactivado', false);
select is((select desactivado_por from public.proveedores where id = '00000000-0000-0000-0000-00000000e002'), '00000000-0000-0000-0000-0000000000b2'::uuid, 'un alta con activo = false registra quién');

-- ── Desactivar y reactivar quedan auditados ─────────────────────────────────────
reset role;
select ok(
  (select count(*) >= 2 from public.auditoria
    where tabla = 'proveedores' and registro_id = '00000000-0000-0000-0000-00000000e001'
      and accion = 'UPDATE' and 'activo' = any (columnas_cambiadas)),
  'desactivar y reactivar un proveedor quedan en auditoria');
select is(
  (select valores from public.auditoria
    where tabla = 'proveedores' and registro_id = '00000000-0000-0000-0000-00000000e001'
      and accion = 'UPDATE' and 'activo' = any (columnas_cambiadas) order by id limit 1) -> 'antes' -> 'activo',
  'true'::jsonb, 'la auditoría guarda el valor anterior de activo');
select is(
  (select usuario_id from public.auditoria
    where tabla = 'materiales' and registro_id = '00000000-0000-0000-0000-00000000f001'
      and accion = 'UPDATE' and 'activo' = any (columnas_cambiadas) order by id limit 1),
  '00000000-0000-0000-0000-0000000000b2'::uuid, 'y quién lo hizo');
select ok(
  (select count(*) >= 2 from public.auditoria
    where tabla = 'catalogo_items' and registro_id = '00000000-0000-0000-0000-00000000d001'
      and accion = 'UPDATE' and 'activo' = any (columnas_cambiadas)),
  'lo mismo en el catálogo');

select * from finish();
rollback;
