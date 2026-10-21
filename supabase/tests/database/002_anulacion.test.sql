-- Tests de "anular en lugar de borrar" (presupuestos y pedidos).
-- Se corren contra la base LOCAL:  npx supabase test db
begin;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local');

-- Datos de partida, creados por el usuario A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

insert into public.presupuestos (id, tipo, cliente_nombre, datos, created_by) values
  ('00000000-0000-0000-0000-00000000c001', 'cercos', 'Cliente Uno', '{}', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000c002', 'cercos', 'Cliente Dos', '{}', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000c003', 'cercos', 'Cliente Tres', '{}', '00000000-0000-0000-0000-0000000000a1');
insert into public.pedidos (id, obra, parametros) values
  ('00000000-0000-0000-0000-00000000a0a1', 'Obra Uno', '{"tamano":"8x4"}'),
  ('00000000-0000-0000-0000-00000000a0a2', 'Obra Dos', '{"tamano":"8x4"}');
insert into public.catalogo_items (id, tipo, clave, precio) values ('00000000-0000-0000-0000-00000000d001', 'cercos', 'item_anulacion', 1);
insert into public.proveedores (id, nombre) values ('00000000-0000-0000-0000-00000000e001', 'Proveedor Anulacion');
insert into public.materiales (id, nombre) values ('00000000-0000-0000-0000-00000000f001', 'Material Anulacion');

-- ── No se puede borrar físicamente nada de esto ─────────────────────────────────
select throws_ok('delete from public.presupuestos where id = ''00000000-0000-0000-0000-00000000c001''', '42501', null, 'no se puede borrar un presupuesto (ni siquiera el dueño)');
select throws_ok('delete from public.pedidos where id = ''00000000-0000-0000-0000-00000000a0a1''', '42501', null, 'no se puede borrar un pedido');
select throws_ok('delete from public.catalogo_items where id = ''00000000-0000-0000-0000-00000000d001''', '42501', null, 'no se puede borrar un ítem del catálogo');
select throws_ok('delete from public.proveedores where id = ''00000000-0000-0000-0000-00000000e001''', '42501', null, 'no se puede borrar un proveedor');
select throws_ok('delete from public.materiales where id = ''00000000-0000-0000-0000-00000000f001''', '42501', null, 'no se puede borrar un material');
select throws_ok('truncate public.presupuestos', '42501', null, 'no se puede vaciar presupuestos');

-- ── Anular exige un motivo de 3 a 500 caracteres ────────────────────────────────
select throws_ok('update public.presupuestos set anulado_motivo = '''' where id = ''00000000-0000-0000-0000-00000000c001''', '23514', null, 'motivo vacío: no anula');
select throws_ok('update public.presupuestos set anulado_motivo = ''   '' where id = ''00000000-0000-0000-0000-00000000c001''', '23514', null, 'motivo de sólo espacios: no anula');
select throws_ok('update public.presupuestos set anulado_motivo = ''ab'' where id = ''00000000-0000-0000-0000-00000000c001''', '23514', null, 'motivo de 2 caracteres: no anula');
select throws_ok('update public.presupuestos set anulado_motivo = repeat(''a'', 501) where id = ''00000000-0000-0000-0000-00000000c001''', '23514', null, 'motivo de 501 caracteres: no anula');
select throws_ok('update public.presupuestos set anulado_at = now() where id = ''00000000-0000-0000-0000-00000000c001''', '23514', null, 'anulado_at sin motivo: no anula');
select throws_ok('update public.pedidos set anulado_motivo = ''x'' where id = ''00000000-0000-0000-0000-00000000a0a1''', '23514', null, 'pedido: motivo muy corto, no anula');
select is((select anulado_at from public.presupuestos where id = '00000000-0000-0000-0000-00000000c001'), null, 'tras los intentos fallidos sigue sin anular');

-- Con motivo de 3 y de 500 caracteres sí.
update public.presupuestos set anulado_motivo = 'abc' where id = '00000000-0000-0000-0000-00000000c003';
select ok((select anulado_at is not null from public.presupuestos where id = '00000000-0000-0000-0000-00000000c003'), 'un motivo de 3 caracteres anula');

-- ── anulado_por y anulado_at los pone el servidor: no se pueden falsificar ──────
update public.presupuestos
   set anulado_motivo = '  Se cargó dos veces  ',
       anulado_por = '00000000-0000-0000-0000-0000000000b2',
       anulado_at = '2000-01-01T00:00:00Z'
 where id = '00000000-0000-0000-0000-00000000c001';

select is(
  (select anulado_por from public.presupuestos where id = '00000000-0000-0000-0000-00000000c001'),
  '00000000-0000-0000-0000-0000000000a1'::uuid, 'anulado_por es quien anuló de verdad, no lo que mandó el cliente');
select ok(
  (select anulado_at > now() - interval '1 minute' from public.presupuestos where id = '00000000-0000-0000-0000-00000000c001'),
  'anulado_at es la hora del servidor, no la que mandó el cliente');
select is(
  (select anulado_motivo from public.presupuestos where id = '00000000-0000-0000-0000-00000000c001'),
  'Se cargó dos veces', 'el motivo se guarda recortado');

-- ── Un registro anulado no se puede editar ni revertir ──────────────────────────
select throws_ok('update public.presupuestos set cliente_nombre = ''Otro'' where id = ''00000000-0000-0000-0000-00000000c001''', '42501', null, 'un presupuesto anulado no se puede editar');
select throws_ok('update public.presupuestos set datos = ''{"x":1}'' where id = ''00000000-0000-0000-0000-00000000c001''', '42501', null, 'ni cambiarle los datos');
select throws_ok('update public.presupuestos set anulado_at = null, anulado_por = null, anulado_motivo = null where id = ''00000000-0000-0000-0000-00000000c001''', '42501', null, 'ni revertir la anulación');
select throws_ok('update public.presupuestos set anulado_motivo = ''Otro motivo distinto'' where id = ''00000000-0000-0000-0000-00000000c001''', '42501', null, 'ni anularlo de nuevo con otro motivo');

-- Anular no es editar: no se puede cambiar otro dato en el mismo UPDATE.
select throws_ok(
  'update public.presupuestos set anulado_motivo = ''Motivo válido'', cliente_nombre = ''Cambiado'' where id = ''00000000-0000-0000-0000-00000000c002''',
  '42501', null, 'al anular no se puede modificar otro dato a la vez');
select is((select anulado_at from public.presupuestos where id = '00000000-0000-0000-0000-00000000c002'), null, 'y ese presupuesto quedó sin anular');

-- ── Pedidos: lo mismo, y cualquier usuario autenticado puede anular ─────────────
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);

update public.pedidos
   set anulado_motivo = 'Se pidió dos veces', anulado_por = '00000000-0000-0000-0000-0000000000a1'
 where id = '00000000-0000-0000-0000-00000000a0a1';
select is(
  (select anulado_por from public.pedidos where id = '00000000-0000-0000-0000-00000000a0a1'),
  '00000000-0000-0000-0000-0000000000b2'::uuid, 'pedido: anulado_por es quien lo anuló (B), aunque haya mandado A');
select throws_ok('update public.pedidos set estado = ''recibido'' where id = ''00000000-0000-0000-0000-00000000a0a1''', '42501', null, 'un pedido anulado no cambia de estado');
select throws_ok('update public.pedidos set anulado_at = null, anulado_motivo = null, anulado_por = null where id = ''00000000-0000-0000-0000-00000000a0a1''', '42501', null, 'un pedido anulado no se puede reactivar');
select lives_ok('update public.pedidos set estado = ''enviado'' where id = ''00000000-0000-0000-0000-00000000a0a2''', 'un pedido sin anular sigue editándose');

-- ── Un presupuesto ajeno no lo puede anular otro usuario (RLS) ──────────────────
update public.presupuestos set anulado_motivo = 'Intento ajeno' where id = '00000000-0000-0000-0000-00000000c002';
reset role;
select is((select anulado_at from public.presupuestos where id = '00000000-0000-0000-0000-00000000c002'), null, 'B no puede anular el presupuesto de A');

-- ── La anulación queda auditada, sin volcar el motivo ───────────────────────────
select ok(
  (select columnas_cambiadas @> array['anulado_at', 'anulado_por', 'anulado_motivo'] from public.auditoria
    where tabla = 'presupuestos' and registro_id = '00000000-0000-0000-0000-00000000c001' and accion = 'UPDATE'),
  'la anulación queda en auditoria');
select is(
  (select count(*) from public.auditoria where valores::text ~* 'Se cargó dos veces|Se pidió dos veces|Intento ajeno'),
  0::bigint, 'pero el texto del motivo no se copia a auditoria');
select is(
  (select usuario_id from public.auditoria where tabla = 'pedidos' and registro_id = '00000000-0000-0000-0000-00000000a0a1' and accion = 'UPDATE' and 'anulado_at' = any (columnas_cambiadas)),
  '00000000-0000-0000-0000-0000000000b2'::uuid, 'y quién anuló el pedido');

select * from finish();
rollback;
