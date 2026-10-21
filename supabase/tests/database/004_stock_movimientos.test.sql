-- Tests del libro de movimientos de stock.
-- Se corren contra la base LOCAL:  npx supabase test db
begin;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local');

-- Un ítem que lleva stock (nace en 0) y uno que no (stock null). Los crea el usuario A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

insert into public.catalogo_items (id, tipo, clave, descripcion, precio, stock) values
  ('00000000-0000-0000-0000-0000000005a1', 'piscinas', 'indusplast_test_100', 'Piscina de prueba', 1000, 0),
  ('00000000-0000-0000-0000-0000000005a2', 'cercos', 'item_sin_stock', 'Sin stock', 1000, null);

reset role;

-- ── Anónimo: nada de nada ───────────────────────────────────────────────────────
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok('select * from public.movimientos_stock', '42501', null, 'anon no lee el libro');
select throws_ok($$select public.registrar_movimiento_stock('00000000-0000-0000-0000-0000000005a1', 'ingreso', 1, 'clave-anonima-1')$$, '42501', null, 'anon no puede registrar movimientos');
select throws_ok($$select public.ajustar_stock('00000000-0000-0000-0000-0000000005a1', 5, 'motivo de prueba', 'clave-anonima-2')$$, '42501', null, 'anon no puede ajustar');
select throws_ok($$select * from public.verificar_consistencia_stock()$$, '42501', null, 'anon no puede verificar la consistencia');

reset role;

-- ── Autenticado: lee el libro, pero no escribe directo ──────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select lives_ok('select * from public.movimientos_stock', 'authenticated lee el libro');
select throws_ok($$insert into public.movimientos_stock (item_id, tipo, cantidad, stock_resultante, idempotency_key) values ('00000000-0000-0000-0000-0000000005a1', 'ingreso', 5, 5, 'insercion-directa-1')$$, '42501', null, 'INSERT directo en el libro rechazado');
select throws_ok('update public.movimientos_stock set cantidad = 1', '42501', null, 'UPDATE directo en el libro rechazado');
select throws_ok('delete from public.movimientos_stock', '42501', null, 'DELETE directo en el libro rechazado');
select throws_ok('truncate public.movimientos_stock', '42501', null, 'TRUNCATE directo en el libro rechazado');

-- ── Ingreso y venta: signos, saldo y caché ──────────────────────────────────────
select is(
  (public.registrar_movimiento_stock('00000000-0000-0000-0000-0000000005a1', 'ingreso', 10, 'ingreso-prueba-01', 'Remito 123', null)) ->> 'stock_resultante',
  '10', 'un ingreso de 10 deja el saldo en 10');
select is((select stock from public.catalogo_items where id = '00000000-0000-0000-0000-0000000005a1'), 10, 'el caché de catalogo_items es 10');
select is(
  (select cantidad from public.movimientos_stock where idempotency_key = 'ingreso-prueba-01'),
  10, 'el ingreso se guarda con signo positivo');
select is(
  (select creado_por from public.movimientos_stock where idempotency_key = 'ingreso-prueba-01'),
  '00000000-0000-0000-0000-0000000000a1'::uuid, 'y con quién lo hizo (auth.uid())');
select is(
  (select referencia from public.movimientos_stock where idempotency_key = 'ingreso-prueba-01'),
  'Remito 123', 'y la referencia');

select is(
  (public.registrar_movimiento_stock('00000000-0000-0000-0000-0000000005a1', 'venta', 3, 'venta-prueba-001')) ->> 'cantidad',
  '-3', 'una venta de 3 se guarda con signo negativo');
select is((select stock from public.catalogo_items where id = '00000000-0000-0000-0000-0000000005a1'), 7, 'y el caché baja a 7');

-- ── Venta mayor al stock: se permite y se avisa ─────────────────────────────────
select is(
  (public.registrar_movimiento_stock('00000000-0000-0000-0000-0000000005a1', 'venta', 20, 'venta-prueba-002')) ->> 'stock_negativo',
  'true', 'vender más que el stock se permite y devuelve stock_negativo = true');
select is((select stock from public.catalogo_items where id = '00000000-0000-0000-0000-0000000005a1'), -13, 'el stock queda en -13');
select is(
  (public.registrar_movimiento_stock('00000000-0000-0000-0000-0000000005a1', 'venta', 1, 'venta-prueba-003')) ->> 'stock_resultante',
  '-14', 'se puede seguir vendiendo en negativo');
select is(
  (public.anular_movimiento_stock((select id from public.movimientos_stock where idempotency_key = 'venta-prueba-003'), 'Error de carga', 'anula-venta-003')) ->> 'stock_resultante',
  '-13', 'anular esa venta devuelve el stock a -13');

-- ── Datos inválidos ─────────────────────────────────────────────────────────────
select throws_ok($$select public.registrar_movimiento_stock('00000000-0000-0000-0000-0000000005a1', 'ingreso', 0, 'cantidad-cero-001')$$, 'ST004', null, 'cantidad 0 rechazada');
select throws_ok($$select public.registrar_movimiento_stock('00000000-0000-0000-0000-0000000005a1', 'ingreso', -5, 'cantidad-neg-0001')$$, 'ST004', null, 'cantidad negativa rechazada (la función aplica el signo)');
select throws_ok($$select public.registrar_movimiento_stock('00000000-0000-0000-0000-0000000005a1', 'ingreso', 10001, 'cantidad-tope-001')$$, 'ST004', null, 'cantidad sobre el tope rechazada');
select throws_ok($$select public.registrar_movimiento_stock('00000000-0000-0000-0000-0000000005a1', 'ajuste', 5, 'tipo-ajuste-0001')$$, 'ST004', null, 'registrar_movimiento_stock no acepta el tipo ajuste');
select throws_ok($$select public.registrar_movimiento_stock('00000000-0000-0000-0000-0000000005a1', 'ingreso', 5, 'corta')$$, 'ST004', null, 'clave de idempotencia de menos de 8 caracteres rechazada');
select throws_ok($$select public.registrar_movimiento_stock('00000000-0000-0000-0000-0000000005a1', 'ingreso', 5, 'referencia-larga-1', repeat('x', 201))$$, 'ST004', null, 'referencia de más de 200 caracteres rechazada');
select throws_ok($$select public.registrar_movimiento_stock('00000000-0000-0000-0000-0000000005a1', 'ingreso', 5, 'motivo-corto-0001', null, 'ab')$$, 'ST004', null, 'motivo de 2 caracteres rechazado');
select throws_ok($$select public.registrar_movimiento_stock('00000000-0000-0000-0000-0000000005ff', 'ingreso', 5, 'item-inexistente1')$$, 'ST002', null, 'un ítem que no existe se rechaza');

-- ── Ítem que no lleva stock ─────────────────────────────────────────────────────
select throws_ok($$select public.registrar_movimiento_stock('00000000-0000-0000-0000-0000000005a2', 'ingreso', 5, 'sin-stock-0000001')$$, 'ST003', null, 'ingreso sobre un ítem sin stock rechazado');
select throws_ok($$select public.ajustar_stock('00000000-0000-0000-0000-0000000005a2', 5, 'motivo de prueba', 'sin-stock-0000002')$$, 'ST003', null, 'ajuste sobre un ítem sin stock rechazado');

-- ── Ajuste: la base calcula la diferencia ───────────────────────────────────────
-- A cuenta 25 unidades mientras el sistema decía -13. Antes de que A confirme, B ingresa 5.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is(
  (public.registrar_movimiento_stock('00000000-0000-0000-0000-0000000005a1', 'ingreso', 5, 'ingreso-de-b-0001')) ->> 'stock_resultante',
  '-8', 'B ingresa 5 mientras A cuenta: el stock pasa a -8');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is(
  (public.ajustar_stock('00000000-0000-0000-0000-0000000005a1', 25, 'Conteo físico', 'ajuste-prueba-001')) ->> 'cantidad',
  '33', 'la diferencia es 33 (25 - (-8)), calculada en la base, no los 38 que vio A al contar');
select is((select stock from public.catalogo_items where id = '00000000-0000-0000-0000-0000000005a1'), 25, 'y el stock queda en lo que contó A: 25');
select is(
  (select stock_resultante from public.movimientos_stock where idempotency_key = 'ajuste-prueba-001'),
  25, 'el ajuste guarda el conteo como saldo');

select is(
  (public.ajustar_stock('00000000-0000-0000-0000-0000000005a1', 25, 'Conteo igual', 'ajuste-prueba-002')) ->> 'movimiento_id',
  null, 'si el conteo coincide no se crea movimiento');
select is(
  (select count(*) from public.movimientos_stock where idempotency_key = 'ajuste-prueba-002'),
  0::bigint, 'y no queda ninguna fila');

select throws_ok($$select public.ajustar_stock('00000000-0000-0000-0000-0000000005a1', 10, null, 'ajuste-sinmotivo1')$$, 'ST004', null, 'ajuste sin motivo (null) rechazado');
select throws_ok($$select public.ajustar_stock('00000000-0000-0000-0000-0000000005a1', 10, '   ', 'ajuste-sinmotivo2')$$, 'ST004', null, 'ajuste con motivo de espacios rechazado');
select throws_ok($$select public.ajustar_stock('00000000-0000-0000-0000-0000000005a1', 10, 'ab', 'ajuste-sinmotivo3')$$, 'ST004', null, 'ajuste con motivo de 2 caracteres rechazado');
select throws_ok($$select public.ajustar_stock('00000000-0000-0000-0000-0000000005a1', -1, 'Conteo negativo', 'ajuste-negativo-1')$$, 'ST004', null, 'un conteo negativo se rechaza');

-- ── Idempotencia ────────────────────────────────────────────────────────────────
select is(
  (public.registrar_movimiento_stock('00000000-0000-0000-0000-0000000005a1', 'ingreso', 10, 'ingreso-prueba-01', 'Remito 123', null)) ->> 'repetido',
  'true', 'la misma clave con los mismos datos devuelve repetido = true');
select is(
  (public.registrar_movimiento_stock('00000000-0000-0000-0000-0000000005a1', 'ingreso', 10, 'ingreso-prueba-01', 'Remito 123', null)) ->> 'movimiento_id',
  (select id::text from public.movimientos_stock where idempotency_key = 'ingreso-prueba-01'), 'y es el movimiento original');
select is(
  (select count(*) from public.movimientos_stock where idempotency_key = 'ingreso-prueba-01'),
  1::bigint, 'hay un solo movimiento con esa clave');
select is((select stock from public.catalogo_items where id = '00000000-0000-0000-0000-0000000005a1'), 25, 'el stock no cambió con los reintentos');
select throws_ok($$select public.registrar_movimiento_stock('00000000-0000-0000-0000-0000000005a1', 'ingreso', 11, 'ingreso-prueba-01', 'Remito 123', null)$$, 'ST005', null, 'la misma clave con otra cantidad es un error');
select throws_ok($$select public.registrar_movimiento_stock('00000000-0000-0000-0000-0000000005a1', 'venta', 10, 'ingreso-prueba-01', 'Remito 123', null)$$, 'ST005', null, 'la misma clave con otro tipo es un error');
select is(
  (public.ajustar_stock('00000000-0000-0000-0000-0000000005a1', 25, 'Conteo físico', 'ajuste-prueba-001')) ->> 'repetido',
  'true', 'un ajuste repetido con la misma clave también es idempotente');
select throws_ok($$select public.ajustar_stock('00000000-0000-0000-0000-0000000005a1', 30, 'Conteo físico', 'ajuste-prueba-001')$$, 'ST005', null, 'un ajuste con la misma clave y otro conteo es un error');

-- ── Anulación: contra-asiento ───────────────────────────────────────────────────
select is(
  (public.anular_movimiento_stock((select id from public.movimientos_stock where idempotency_key = 'venta-prueba-001'), 'Se cargó dos veces', 'anula-venta-001')) ->> 'cantidad',
  '3', 'anular una venta de 3 crea un contra-asiento de +3');
select is(
  (select anula_a from public.movimientos_stock where idempotency_key = 'anula-venta-001'),
  (select id from public.movimientos_stock where idempotency_key = 'venta-prueba-001'), 'que apunta al movimiento anulado');
select is((select stock from public.catalogo_items where id = '00000000-0000-0000-0000-0000000005a1'), 28, 'el stock sube a 28');
select throws_ok(
  $$select public.anular_movimiento_stock((select id from public.movimientos_stock where idempotency_key = 'venta-prueba-001'), 'Otra vez', 'anula-venta-001b')$$,
  'ST007', null, 'no se puede anular dos veces el mismo movimiento');
select is(
  (public.anular_movimiento_stock((select id from public.movimientos_stock where idempotency_key = 'venta-prueba-001'), 'Se cargó dos veces', 'anula-venta-001')) ->> 'repetido',
  'true', 'repetir la anulación con la misma clave es idempotente');
select throws_ok(
  $$select public.anular_movimiento_stock((select id from public.movimientos_stock where idempotency_key = 'anula-venta-001'), 'Anular la anulación', 'anula-anula-001')$$,
  'ST006', null, 'no se anula una anulación');
select throws_ok(
  $$select public.anular_movimiento_stock((select id from public.movimientos_stock where idempotency_key = 'venta-prueba-002'), 'ab', 'anula-motivo-001')$$,
  'ST004', null, 'anular sin un motivo válido se rechaza');

-- ── Escritura directa del stock: rechazada ──────────────────────────────────────
select throws_ok($$update public.catalogo_items set stock = 99 where id = '00000000-0000-0000-0000-0000000005a1'$$, 'ST010', null, 'un UPDATE directo de stock se rechaza');
select throws_ok($$update public.catalogo_items set stock = stock + 1 where id = '00000000-0000-0000-0000-0000000005a1'$$, 'ST010', null, 'ni siquiera un +1');
select throws_ok($$update public.catalogo_items set stock = null where id = '00000000-0000-0000-0000-0000000005a1'$$, 'ST010', null, 'ni dejar de llevar stock si hay unidades');
select lives_ok($$update public.catalogo_items set descripcion = 'Otra descripción', precio = 1100 where id = '00000000-0000-0000-0000-0000000005a1'$$, 'editar otras columnas del ítem sigue funcionando');
select throws_ok($$insert into public.catalogo_items (tipo, clave, stock) values ('piscinas', 'indusplast_con_stock', 5)$$, 'ST011', null, 'un ítem nuevo no puede nacer con stock');
select lives_ok($$insert into public.catalogo_items (tipo, clave, stock) values ('piscinas', 'indusplast_nuevo_0', 0)$$, 'sí puede nacer con stock 0');
select lives_ok($$insert into public.catalogo_items (tipo, clave) values ('piscinas', 'indusplast_nuevo_n')$$, 'o sin stock');
-- Activar / desactivar "llevar stock" (null <-> 0) es lo único que se escribe directo.
select lives_ok($$update public.catalogo_items set stock = 0 where id = '00000000-0000-0000-0000-0000000005a2'$$, 'activar "llevar stock" (null a 0) está permitido');
select lives_ok($$update public.catalogo_items set stock = null where id = '00000000-0000-0000-0000-0000000005a2'$$, 'y desactivarlo cuando está en 0');

reset role;
-- Tampoco el superusuario (SQL Editor) puede escribir el stock directo.
select throws_ok($$update public.catalogo_items set stock = 99 where id = '00000000-0000-0000-0000-0000000005a1'$$, 'ST010', null, 'el superusuario tampoco puede escribir el stock directo');
-- Ni tocar el libro.
select throws_ok('update public.movimientos_stock set cantidad = 1', '42501', null, 'el trigger rechaza UPDATE del libro aun como superusuario');
select throws_ok('delete from public.movimientos_stock', '42501', null, 'el trigger rechaza DELETE del libro aun como superusuario');
select throws_ok('truncate public.movimientos_stock', '42501', null, 'el trigger rechaza TRUNCATE del libro aun como superusuario');
select throws_ok($$insert into public.movimientos_stock (item_id, tipo, cantidad, stock_resultante, idempotency_key) values ('00000000-0000-0000-0000-0000000005a1', 'venta', 5, 0, 'venta-positiva-001')$$, '23514', null, 'una venta con cantidad positiva viola el CHECK del libro');
select throws_ok($$insert into public.movimientos_stock (item_id, tipo, cantidad, stock_resultante, idempotency_key) values ('00000000-0000-0000-0000-0000000005a1', 'ajuste', 5, 0, 'ajuste-sinmotivo-9')$$, '23514', null, 'un ajuste sin motivo viola el CHECK del libro');
select throws_ok($$insert into public.movimientos_stock (item_id, tipo, cantidad, stock_resultante, idempotency_key) values ('00000000-0000-0000-0000-0000000005a1', 'ingreso', 0, 0, 'cantidad-cero-9999')$$, '23514', null, 'cantidad 0 viola el CHECK del libro');
-- Sin sesión: se borran los claims que quedaron de las secciones anteriores.
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);
select throws_ok($$select public.registrar_movimiento_stock('00000000-0000-0000-0000-0000000005a1', 'ingreso', 5, 'sin-sesion-000001')$$, '42501', null, 'sin sesión (auth.uid() null) las funciones rechazan');

-- ── Aperturas: el stock existente entra al libro ────────────────────────────────
-- Se arma el "estado anterior a la migración" sin disparar los triggers de caché y protección.
set local session_replication_role = replica;
insert into public.catalogo_items (id, tipo, clave, stock) values
  ('00000000-0000-0000-0000-0000000005b1', 'piscinas', 'indusplast_apertura_7', 7),
  ('00000000-0000-0000-0000-0000000005b2', 'piscinas', 'indusplast_apertura_0', 0),
  ('00000000-0000-0000-0000-0000000005b3', 'cercos', 'apertura_sin_stock', null);
set local session_replication_role = origin;

select is(public.crear_aperturas_stock(), 1, 'sólo el ítem con stock distinto de 0 recibe una apertura');
select is(
  (select cantidad from public.movimientos_stock where idempotency_key = 'apertura-00000000-0000-0000-0000-0000000005b1'),
  7, 'la apertura es por la cantidad actual, con la clave determinística apertura-<item_id>');
select is((select tipo from public.movimientos_stock where item_id = '00000000-0000-0000-0000-0000000005b1'), 'apertura', 'del tipo apertura');
select is(
  (select count(*) from public.movimientos_stock where item_id in ('00000000-0000-0000-0000-0000000005b2', '00000000-0000-0000-0000-0000000005b3')),
  0::bigint, 'los ítems con stock 0 o null no llevan movimiento');
select is(public.crear_aperturas_stock(), 0, 'repetirla no crea nada: es idempotente');
select is((select stock from public.catalogo_items where id = '00000000-0000-0000-0000-0000000005b1'), 7, 'el caché sigue igual a la suma');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok(
  $$select public.anular_movimiento_stock((select id from public.movimientos_stock where item_id = '00000000-0000-0000-0000-0000000005b1'), 'Quiero anular la apertura', 'anula-apertura-01')$$,
  'ST006', null, 'una apertura no se anula (se corrige con un ajuste)');
select is(
  (public.ajustar_stock('00000000-0000-0000-0000-0000000005b1', 6, 'Se contó una menos', 'ajuste-apertura-1')) ->> 'cantidad',
  '-1', 'la apertura se corrige con un ajuste');
reset role;

-- ── Consistencia ────────────────────────────────────────────────────────────────
select is_empty('select * from public.verificar_consistencia_stock()', 'el caché coincide con la suma del libro en todos los ítems');

set local session_replication_role = replica;
update public.catalogo_items set stock = 999 where id = '00000000-0000-0000-0000-0000000005a1';
set local session_replication_role = origin;
select is((select count(*) from public.verificar_consistencia_stock()), 1::bigint, 'verificar_consistencia_stock() detecta un caché que no coincide');
select is((select suma_movimientos from public.verificar_consistencia_stock()), 28::bigint, 'e informa la suma real del libro');
set local session_replication_role = replica;
update public.catalogo_items set stock = 28 where id = '00000000-0000-0000-0000-0000000005a1';
set local session_replication_role = origin;
select is_empty('select * from public.verificar_consistencia_stock()', 'y vuelve a cero cuando se corrige');

-- ── Auditoría: el stock no se audita fila por fila ──────────────────────────────
select is(
  (select count(*) from public.auditoria where tabla = 'catalogo_items' and accion = 'UPDATE'
     and registro_id = '00000000-0000-0000-0000-0000000005a1' and 'stock' = any (columnas_cambiadas)),
  0::bigint, 'ningún movimiento deja una fila de auditoría de catalogo_items por cambiar stock');
select is(
  (select count(*) from public.auditoria where tabla = 'catalogo_items' and accion = 'UPDATE'
     and registro_id = '00000000-0000-0000-0000-0000000005a1' and 'precio' = any (columnas_cambiadas)),
  1::bigint, 'pero un cambio de precio sí se audita');

select * from finish();
rollback;
