-- Tests de la tabla `auditoria` y de sus triggers.
-- Se corren contra la base LOCAL:  npx supabase test db
begin;
select no_plan();

-- ── Datos de prueba (todo se deshace con el rollback del final) ─────────────────
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local');

-- ── Un anónimo no lee ni escribe nada ───────────────────────────────────────────
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok('select * from public.auditoria', '42501', null, 'anon no puede leer auditoria');
select throws_ok('insert into public.auditoria (tabla, registro_id, accion) values (''x'', gen_random_uuid(), ''INSERT'')', '42501', null, 'anon no puede escribir en auditoria');
select is_empty('select * from public.presupuestos', 'anon no ve ningún presupuesto');
select is_empty('select * from public.pedidos', 'anon no ve ningún pedido');
select is_empty('select * from public.catalogo_items', 'anon no ve el catálogo');
select is_empty('select * from public.proveedores', 'anon no ve proveedores');
select is_empty('select * from public.materiales', 'anon no ve materiales');
select throws_ok(
  'insert into public.presupuestos (tipo, cliente_nombre, datos) values (''cercos'', ''Intruso'', ''{}'')',
  '42501', null, 'anon no puede crear presupuestos');
select throws_ok(
  'insert into public.catalogo_items (tipo, clave, precio) values (''cercos'', ''intruso'', 1)',
  '42501', null, 'anon no puede escribir en el catálogo');
select throws_ok(
  'insert into public.proveedores (nombre) values (''Intruso'')',
  '42501', null, 'anon no puede crear proveedores');

reset role;

-- ── Un autenticado lee la auditoría pero no puede tocarla ───────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select lives_ok('select * from public.auditoria', 'un autenticado puede leer auditoria');
select throws_ok('insert into public.auditoria (tabla, registro_id, accion) values (''x'', gen_random_uuid(), ''INSERT'')', '42501', null, 'authenticated no puede insertar en auditoria');
select throws_ok('update public.auditoria set tabla = ''x''', '42501', null, 'authenticated no puede modificar auditoria');
select throws_ok('delete from public.auditoria', '42501', null, 'authenticated no puede borrar auditoria');
select throws_ok('truncate public.auditoria', '42501', null, 'authenticated no puede vaciar auditoria');

reset role;

-- ── INSERT y UPDATE se auditan, con el usuario correcto ─────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

insert into public.presupuestos (id, tipo, cliente_nombre, datos, created_by)
values ('00000000-0000-0000-0000-00000000c001', 'cercos', 'Juan Pérez Secretísimo',
        '{"cliente":{"domicilio":"Calle Falsa 123","telefono":"3534999888"},"totales":[1234567]}',
        '00000000-0000-0000-0000-0000000000a1');

select is(
  (select count(*) from public.auditoria where tabla = 'presupuestos' and registro_id = '00000000-0000-0000-0000-00000000c001' and accion = 'INSERT'),
  1::bigint, 'el alta de un presupuesto genera una fila INSERT en auditoria');
select is(
  (select usuario_id from public.auditoria where tabla = 'presupuestos' and registro_id = '00000000-0000-0000-0000-00000000c001' and accion = 'INSERT'),
  '00000000-0000-0000-0000-0000000000a1'::uuid, 'la fila guarda el usuario que hizo el alta (auth.uid())');

update public.presupuestos set tipo = 'cobertores' where id = '00000000-0000-0000-0000-00000000c001';

select is(
  (select columnas_cambiadas from public.auditoria where registro_id = '00000000-0000-0000-0000-00000000c001' and accion = 'UPDATE'),
  array['tipo'], 'el UPDATE registra sólo la columna que cambió (updated_at no cuenta)');
select is(
  (select valores from public.auditoria where registro_id = '00000000-0000-0000-0000-00000000c001' and accion = 'UPDATE'),
  '{"antes": {"tipo": "cercos"}, "despues": {"tipo": "cobertores"}}'::jsonb, 'guarda antes y después de las columnas no sensibles');

-- Un UPDATE que no cambia nada no es un hecho que auditar.
update public.presupuestos set tipo = 'cobertores' where id = '00000000-0000-0000-0000-00000000c001';
select is(
  (select count(*) from public.auditoria where registro_id = '00000000-0000-0000-0000-00000000c001' and accion = 'UPDATE'),
  1::bigint, 'un UPDATE sin cambios no genera fila');

-- ── Las columnas sensibles: sólo el nombre, nunca el valor ──────────────────────
update public.presupuestos
   set cliente_nombre = 'Otro Nombre Reservado',
       datos = '{"cliente":{"domicilio":"Avenida Nueva 999"},"totales":[7654321]}'
 where id = '00000000-0000-0000-0000-00000000c001';

select ok(
  (select columnas_cambiadas @> array['cliente_nombre', 'datos'] from public.auditoria
    where registro_id = '00000000-0000-0000-0000-00000000c001' and accion = 'UPDATE' order by id desc limit 1),
  'de las columnas sensibles queda el NOMBRE en columnas_cambiadas');
select is(
  (select valores from public.auditoria
    where registro_id = '00000000-0000-0000-0000-00000000c001' and accion = 'UPDATE' order by id desc limit 1),
  null, 'si sólo cambiaron columnas sensibles, valores queda en null');
select is(
  (select count(*) from public.auditoria
    where valores::text ~* 'Pérez|Secret|Falsa|3534999888|1234567|Reservado|Avenida|7654321'),
  0::bigint, 'ningún dato del cliente ni monto aparece en valores');
select ok(
  (select not (valores -> 'despues' ? 'datos') and not (valores -> 'despues' ? 'cliente_nombre')
     from public.auditoria where registro_id = '00000000-0000-0000-0000-00000000c001' and accion = 'INSERT'),
  'el INSERT no vuelca ni datos ni cliente_nombre');

reset role;

-- ── Catálogo: los cambios de precio quedan, antes y después ─────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);

insert into public.catalogo_items (id, tipo, clave, descripcion, precio)
values ('00000000-0000-0000-0000-00000000d001', 'cercos', 'item_auditoria', 'Un ítem', 1000);
update public.catalogo_items set precio = 1500 where id = '00000000-0000-0000-0000-00000000d001';

select is(
  (select valores from public.auditoria where tabla = 'catalogo_items' and registro_id = '00000000-0000-0000-0000-00000000d001' and accion = 'UPDATE'),
  '{"antes": {"precio": 1000}, "despues": {"precio": 1500}}'::jsonb, 'el cambio de precio del catálogo guarda antes y después');
select is(
  (select usuario_id from public.auditoria where tabla = 'catalogo_items' and registro_id = '00000000-0000-0000-0000-00000000d001' and accion = 'UPDATE'),
  '00000000-0000-0000-0000-0000000000b2'::uuid, 'y quién lo cambió');

reset role;

-- ── Proveedores, materiales y pedidos: sensibles sólo por nombre ────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

insert into public.proveedores (id, nombre, contacto, telefono, notas)
values ('00000000-0000-0000-0000-00000000e001', 'Corralón Auditado', 'Contacto Reservado', '3534777666', 'nota reservada');
update public.proveedores set telefono = '3534111222' where id = '00000000-0000-0000-0000-00000000e001';

insert into public.materiales (id, nombre, precio, notas)
values ('00000000-0000-0000-0000-00000000f001', 'Material Auditado', 100, 'nota material reservada');
update public.materiales set precio = 120 where id = '00000000-0000-0000-0000-00000000f001';

insert into public.pedidos (id, obra, solicitante, parametros, costo)
values ('00000000-0000-0000-0000-00000000a0a1', 'Obra Reservada', 'Solicitante Reservado', '{"tamano":"8x4"}', 987654);

select is(
  (select valores from public.auditoria where tabla = 'materiales' and registro_id = '00000000-0000-0000-0000-00000000f001' and accion = 'UPDATE'),
  '{"antes": {"precio": 100}, "despues": {"precio": 120}}'::jsonb, 'el costo de un material sí se registra: es lo que interesa ver cambiar');
select is(
  (select columnas_cambiadas from public.auditoria where tabla = 'proveedores' and registro_id = '00000000-0000-0000-0000-00000000e001' and accion = 'UPDATE'),
  array['telefono'], 'cambiar el teléfono de un proveedor queda como "telefono cambió"');
select is(
  (select count(*) from public.auditoria
    where valores::text ~* 'Reservado|Reservada|3534777666|3534111222|987654'),
  0::bigint, 'contacto, teléfono, notas, obra, solicitante y costo del pedido nunca aparecen en valores');
select is(
  (select count(*) from public.auditoria where tabla = 'pedidos' and registro_id = '00000000-0000-0000-0000-00000000a0a1' and accion = 'INSERT'),
  1::bigint, 'el alta de un pedido se audita');

reset role;

-- ── Append-only: ni siquiera el dueño de la tabla puede reescribir la historia ──
select throws_ok('update public.auditoria set tabla = ''x''', '42501', null, 'el trigger rechaza UPDATE aun como superusuario');
select throws_ok('delete from public.auditoria', '42501', null, 'el trigger rechaza DELETE aun como superusuario');
select throws_ok('truncate public.auditoria', '42501', null, 'el trigger rechaza TRUNCATE aun como superusuario');

select * from finish();
rollback;
