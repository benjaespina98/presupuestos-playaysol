-- Datos de ejemplo para la base LOCAL (supabase db reset). NO es para producción.
--
-- Es el catálogo de precios inicial: se generó copiando, sin retipear, las
-- sentencias de datos de migration_catalogo_items.sql, migration_catalogo_categorias.sql,
-- migration_cascada.sql, migration_listas_piscinas.sql y migration_stock_piscinas.sql.
-- No trae clientes, proveedores, materiales ni pedidos (eso no está en el repo).

-- Sin disparar triggers: los datos de ejemplo no son "cambios" a auditar.
set session_replication_role = replica;

insert into public.catalogo_items (tipo, clave, descripcion, precio)
values
  ('piscinas', 'luces', 'Luces de acero inoxidable con su respectiva controladora, fuente e instalaciones eléctricas, se pueden colocar 2 o 3 (siendo una en la cama de agua) — precio por unidad', 240000),
  ('piscinas', 'reemplazo_losetas_decks', 'Reemplazo de losetas incluidas en vereda perimetral de 0.50 mts de ancho por decks atérmicos antideslizantes de 1x0.12 mts', 1290000),
  ('piscinas', 'solarium_losetas', 'Solárium seco hormigón + losetas atérmicas, terminado (precio por m2)', 239000),
  ('piscinas', 'solarium_decks', 'Solárium seco hormigón + decks atérmicos 1x0.12, terminado (precio por m2)', 279000),
  ('piscinas', 'kit_limpieza', 'Kit de Limpieza: caño telescópico, manga desagote, manguera flotante, barre fondo, bichero, cloro', 109000),
  ('piscinas', 'bano_quimico', 'Baño químico, en caso de corresponder', null),
  ('piscinas', 'retiro_tierra', 'Retiro de tierra desde la calle', null),
  ('piscinas', 'tapa_metalica', 'Tapa metálica sala de filtros', null),
  ('piscinas', 'climatizacion25000', 'Climatización bomba de calor inverter, hasta 25.000 lts, instalada (precio normal con instalación $3.300.000 — este valor es oportunidad con equipo físico en nuestro negocio)', 2650000),
  ('piscinas', 'climatizacion30000', 'Climatización bomba de calor inverter, hasta 30.000 lts, instalada (ver diferentes gamas de equipos: básico, intermedio y pro)', null),
  ('piscinas', 'revestimiento_ceramico_bali', 'Revestimiento interior cerámico importado de Brasil símil piedra Bali, color verde o celeste 10x10 en malla, terminado, instalado', 4990000),
  ('piscinas', 'revestimiento_piedra_bali', 'Revestimiento interior en piedra Bali importada de Indonesia de 10x10 y 20x20 cms, piedras individuales, se enciman unas con otras, sin juntas, terminado, instalado', null),
  ('piscinas', 'travertino_rustico_exterior', 'Revestimiento exterior de piscina en Mármol Travertino Rústico 60x40 cms, importado de Turquía, mano de obra y materiales, terminado', null),
  ('piscinas', 'travertino_pulido_interior', 'Revestimiento interior de piscina completa en Mármol Travertino Pulido Taponado 60x40 cms, importado de Turquía, mano de obra y materiales, terminado', null),
  ('piscinas', 'cerco_perimetral', 'Cerco perimetral desmontable de aluminio y lona microperforada para seguridad de niños y mascotas, materiales y mano de obra, instalado (valor por metro lineal)', 79500),
  ('cercos', 'porton_reforzado', 'Portón de acceso reforzado con cerradura', null),
  ('cercos', 'refuerzo_postes', 'Refuerzo de postes en esquinas o desniveles del terreno', null),
  ('cercos', 'lona_premium', 'Lona premium (mayor gramaje / color a elección)', null),
  ('cobertores', 'soga_sujecion_reforzada', 'Soga y accesorios de sujeción reforzados', null),
  ('cobertores', 'funda_protectora_invierno', 'Funda protectora para guardado del cobertor en invierno', null),
  ('revestimientos', 'revestimiento_ceramico_bali', 'Cerámico Bali Brasil (por m² instalado)', 112000),
  ('revestimientos', 'venecitas_premium_espana', 'Venecitas Premium España (por m² instalado)', 140000),
  ('revestimientos', 'revestimiento_piedra_bali', 'Piedra Bali Indonesia (por m² instalado)', 195000),
  ('revestimientos', 'travertino', 'Mármol Travertino Turquía (por m² instalado)', 200000),
  ('revestimientos', 'solar_seco_losetas', 'Solar seco — losetas atérmicas (por m² terminado)', 229000),
  ('revestimientos', 'solar_seco_deck', 'Solar seco — deck 1×0.12m (por m² terminado)', 269000),
  ('revestimientos', 'disqueado_revestimiento_previo', 'Disqueado / remoción de revestimiento previo (por obra, solo si tiene revestimiento viejo)', 800000),
  ('cercos', 'precioSin', 'Precio por metro lineal sin instalación', 63500),
  ('cercos', 'precioCon', 'Precio por metro lineal con instalación', 79500),
  ('cobertores', 'precioMenos15', 'Precio por m² para piletas de hasta 15 m²', 10903),
  ('cobertores', 'precioMas15', 'Precio por m² para piletas de más de 15 m²', 9902),
  ('cobertores', 'precioInstalacion', 'Costo fijo de instalación', 100000)
on conflict (tipo, clave) do nothing;

update public.catalogo_items set categoria = 'Piscinas'
  where categoria is null and tipo = 'piscinas' and clave not like '\_\_%';

update public.catalogo_items set categoria = 'Cercos'
  where categoria is null and tipo = 'cercos' and clave not like '\_\_%';

update public.catalogo_items set categoria = 'Cobertores'
  where categoria is null and tipo = 'cobertores' and clave not like '\_\_%';

update public.catalogo_items set categoria = 'Revestimientos'
  where categoria is null and tipo = 'revestimientos' and clave not like '\_\_%';

update public.catalogo_items set categoria = 'Accesorios'
  where categoria is null and tipo = 'losetas' and clave not like '\_\_%';

update public.catalogo_items set categoria = 'Iluminación'
  where clave = 'luces';

update public.catalogo_items set categoria = 'Filtración'
  where clave in ('tapa_metalica', 'climatizacion25000', 'climatizacion30000');

update public.catalogo_items set categoria = 'Mano de obra'
  where clave in ('retiro_tierra', 'disqueado_revestimiento_previo');

update public.catalogo_items set categoria = 'Otros'
  where clave = 'bano_quimico';

update public.catalogo_items set categoria = 'Revestimientos'
  where tipo = 'piscinas'
    and clave in (
      'revestimiento_ceramico_bali', 'revestimiento_piedra_bali',
      'travertino_rustico_exterior', 'travertino_pulido_interior'
    );

update public.catalogo_items set categoria = 'Cercos'
  where tipo = 'piscinas' and clave = 'cerco_perimetral';

update public.catalogo_items set unidad = 'ml'
  where unidad is null and clave in ('precioSin', 'precioCon', 'cerco_perimetral');

update public.catalogo_items set unidad = 'm²'
  where unidad is null and (
    tipo = 'revestimientos' and clave not like '\_\_%' and clave <> 'disqueado_revestimiento_previo'
    or clave in ('precioMenos15', 'precioMas15', 'solarium_losetas', 'solarium_decks')
  );

update public.catalogo_items set unidad = 'obra'
  where unidad is null and clave in ('precioInstalacion', 'disqueado_revestimiento_previo');

update public.catalogo_items set unidad = 'unidad'
  where unidad is null and clave in ('luces', 'kit_limpieza', 'tapa_metalica');

insert into public.catalogo_items (tipo, clave, descripcion, precio, categoria)
values
  ('piscinas', 'cascada', 'Cascada lámina de agua', null, 'Accesorios')
on conflict (tipo, clave) do nothing;

insert into public.catalogo_items (tipo, clave, descripcion, precio, categoria, unidad)
values
  ('piscinas', 'lista_hormigon_5x3', 'Piscina de hormigón 5x3 — precio de lista, obra terminada', 9790000, 'Piscinas', 'obra'),
  ('piscinas', 'lista_hormigon_6x3', 'Piscina de hormigón 6x3 — precio de lista, obra terminada', 10980000, 'Piscinas', 'obra'),
  ('piscinas', 'lista_hormigon_7x3', 'Piscina de hormigón 7x3 — precio de lista, obra terminada', 11590000, 'Piscinas', 'obra'),
  ('piscinas', 'lista_hormigon_7x3_50', 'Piscina de hormigón 7x3.50 — precio de lista, obra terminada', 12190000, 'Piscinas', 'obra'),
  ('piscinas', 'lista_hormigon_7x4', 'Piscina de hormigón 7x4 — precio de lista, obra terminada', 12690000, 'Piscinas', 'obra'),
  ('piscinas', 'lista_hormigon_8x3', 'Piscina de hormigón 8x3 — precio de lista, obra terminada', 12690000, 'Piscinas', 'obra'),
  ('piscinas', 'lista_hormigon_8x4', 'Piscina de hormigón 8x4 — precio de lista, obra terminada', 15390000, 'Piscinas', 'obra'),
  ('piscinas', 'lista_hormigon_9x3', 'Piscina de hormigón 9x3 — precio de lista, obra terminada', 16290000, 'Piscinas', 'obra'),
  ('piscinas', 'lista_hormigon_9x4', 'Piscina de hormigón 9x4 — precio de lista, obra terminada', 17890000, 'Piscinas', 'obra'),
  ('piscinas', 'lista_hormigon_10x4', 'Piscina de hormigón 10x4 — precio de lista, obra terminada', 19390000, 'Piscinas', 'obra'),
  ('piscinas', 'lista_hormigon_6_5x2.5', 'Piscina de hormigón 6.5x2.5 — precio de lista, obra terminada', null, 'Piscinas', 'obra'),
  ('piscinas', 'indusplast_racionalista_400', 'Piscina de fibra Indusplast Racionalista 400 — contado, kit estándar instalado', 6490000, 'Piscinas', 'obra'),
  ('piscinas', 'indusplast_racionalista_450', 'Piscina de fibra Indusplast Racionalista 450 — contado, kit estándar instalado', 6950000, 'Piscinas', 'obra'),
  ('piscinas', 'indusplast_racionalista_500', 'Piscina de fibra Indusplast Racionalista 500 — contado, kit estándar instalado', 7540000, 'Piscinas', 'obra'),
  ('piscinas', 'indusplast_racionalista_548', 'Piscina de fibra Indusplast Racionalista 548 — contado, kit estándar instalado', 8180000, 'Piscinas', 'obra'),
  ('piscinas', 'indusplast_racionalista_600', 'Piscina de fibra Indusplast Racionalista 600 — contado, kit estándar instalado', 8915000, 'Piscinas', 'obra'),
  ('piscinas', 'indusplast_racionalista_650', 'Piscina de fibra Indusplast Racionalista 650 — contado, kit estándar instalado', 9495000, 'Piscinas', 'obra'),
  ('piscinas', 'indusplast_racionalista_700', 'Piscina de fibra Indusplast Racionalista 700 — contado, kit estándar instalado', 10095000, 'Piscinas', 'obra'),
  ('piscinas', 'indusplast_racionalista_750', 'Piscina de fibra Indusplast Racionalista 750 — contado, kit estándar instalado', 11120000, 'Piscinas', 'obra'),
  ('piscinas', 'indusplast_racionalista_800', 'Piscina de fibra Indusplast Racionalista 800 — contado, kit estándar instalado', 12205000, 'Piscinas', 'obra'),
  ('piscinas', 'indusplast_racionalista_845', 'Piscina de fibra Indusplast Racionalista 845 — contado, kit estándar instalado', 13090000, 'Piscinas', 'obra'),
  ('piscinas', 'indusplast_caribe_550', 'Piscina de fibra Indusplast Caribe 550 — contado, kit estándar instalado', 8810000, 'Piscinas', 'obra'),
  ('piscinas', 'indusplast_caribe_650', 'Piscina de fibra Indusplast Caribe 650 — contado, kit estándar instalado', 9965000, 'Piscinas', 'obra'),
  ('piscinas', 'indusplast_caribe_750', 'Piscina de fibra Indusplast Caribe 750 — contado, kit estándar instalado', 11580000, 'Piscinas', 'obra'),
  ('piscinas', 'indusplast_caribe_850', 'Piscina de fibra Indusplast Caribe 850 — contado, kit estándar instalado', 12865000, 'Piscinas', 'obra'),
  ('piscinas', 'indusplast_finesa_600', 'Piscina de fibra Indusplast Finesa 600 — contado, kit estándar instalado', 16935000, 'Piscinas', 'obra'),
  ('piscinas', 'indusplast_finesa_700', 'Piscina de fibra Indusplast Finesa 700 — contado, kit estándar instalado', 18615000, 'Piscinas', 'obra'),
  ('piscinas', 'indusplast_finesa_800', 'Piscina de fibra Indusplast Finesa 800 — contado, kit estándar instalado', 20235000, 'Piscinas', 'obra'),
  ('piscinas', 'indusplast_lagune_276', 'Piscina de fibra Indusplast Lagune 276 — contado, kit estándar instalado', 3455000, 'Piscinas', 'obra'),
  ('piscinas', 'indusplast_lagune_376', 'Piscina de fibra Indusplast Lagune 376 — contado, kit estándar instalado', 3980000, 'Piscinas', 'obra'),
  ('piscinas', 'indusplast_lagune_476', 'Piscina de fibra Indusplast Lagune 476 — contado, kit estándar instalado', 4610000, 'Piscinas', 'obra'),
  ('piscinas', 'indusplast_spa_240', 'Piscina de fibra Indusplast Spa 240 — contado, kit estándar instalado', 4715000, 'Piscinas', 'obra')
on conflict (tipo, clave) do nothing;

update public.catalogo_items
   set descripcion = 'Cascada lámina de agua'
 where tipo = 'piscinas' and clave = 'cascada' and descripcion = 'Cascada';

update public.catalogo_items
   set stock = 0
 where tipo = 'piscinas'
   and clave like 'indusplast\_%'
   and stock is null;

set session_replication_role = origin;

-- ═════════════════════════════════════════════════════════════════════════════
-- Datos de prueba LOCALES, con la forma y el tamaño de los de producción (todo inventado): proveedores con y
-- sin teléfono, ~54 materiales con nombres largos, presupuestos (con tildes, nombres largos y anulados),
-- pedidos y stock variado (0, 1, 2 y negativo). Sirven para revisar las pantallas con datos de tamaño real.
-- NO es para producción.
-- ═════════════════════════════════════════════════════════════════════════════
set session_replication_role = replica;

-- Stock variado en la fibra (el resto queda en 0). Cada uno con su apertura en el libro (los negativos, con una venta).
update public.catalogo_items set stock = 1 where clave in ('indusplast_racionalista_500', 'indusplast_lagune_376', 'indusplast_finesa_700');
update public.catalogo_items set stock = 2 where clave in ('indusplast_racionalista_600', 'indusplast_spa_240');
update public.catalogo_items set stock = -2 where clave = 'indusplast_racionalista_700';
update public.catalogo_items set stock = -1 where clave = 'indusplast_caribe_750';

insert into public.movimientos_stock (item_id, tipo, cantidad, stock_resultante, motivo, idempotency_key)
select c.id, 'apertura', case when c.stock < 0 then 1 else c.stock end, case when c.stock < 0 then 1 else c.stock end,
       'Stock inicial (dato de prueba)', 'seed-apertura-' || c.clave
  from public.catalogo_items c
 where c.clave in ('indusplast_racionalista_500', 'indusplast_lagune_376', 'indusplast_finesa_700', 'indusplast_racionalista_600',
                   'indusplast_spa_240', 'indusplast_racionalista_700', 'indusplast_caribe_750');
insert into public.movimientos_stock (item_id, tipo, cantidad, stock_resultante, motivo, idempotency_key)
select c.id, 'venta', c.stock - 1, c.stock, 'Venta (dato de prueba)', 'seed-venta-' || c.clave
  from public.catalogo_items c
 where c.clave in ('indusplast_racionalista_700', 'indusplast_caribe_750');

-- Un ítem desactivado, para ver ese estado.
update public.catalogo_items set activo = false where clave = 'reemplazo_losetas_decks';

-- ── Proveedores (15; algunos sin teléfono, con varios teléfonos y notas largas) ──────────────────
insert into public.proveedores (nombre, rubro, contacto, telefono, forma_pago, plazo, notas, activo) values
  ('Corralón El Progreso S.A.', 'Materiales', 'Marcelo Rivarola', '+54 9 3534 11-2233 / +54 9 3534 44-5566', 'Contado', 'Entrega en 48 hs', 'Entregan en obra sólo de lunes a viernes de 8 a 12 hs. Pedir con anticipación los viernes. Descuento por volumen a partir de 20 bolsas de cemento.', true),
  ('Áridos del Centro', 'Áridos', 'Luciano', '+54 9 3534 08-3660', 'Contado', null, null, true),
  ('Hidráulica Córdoba Mayorista', 'Hidráulica', 'Ing. Soledad Ferreyra', '+54 9 351 555-1234', 'Cuenta corriente 30 días', '30 días', 'Lista de precios actualizada el primer día de cada mes. Los accesorios de bronce se consultan por WhatsApp.', true),
  ('PVC Sur S.R.L.', 'PVC', null, null, null, null, null, true),
  ('Eléctrica Villa María', 'Eléctrico', 'Rodrigo', '+54 9 3534 23-2878', 'Contado', null, null, true),
  ('Iluminación Acuática Argentina', 'Luces', 'Pablo', '011 4444-5555', 'Transferencia', '10 días', 'Las luces LED vienen por pedido, demoran de 10 a 15 días hábiles.', true),
  ('Cerámicos Bali Importados', 'Materiales', 'Natalia', '+54 9 11 6789-0012', 'Transferencia', '15 días', null, true),
  ('Ferretería Industrial Rivadavia', 'Materiales', null, '0353 452-8890', 'Contado', null, null, true),
  ('Servicios de Excavación y Retiro de Escombros González e Hijos', 'Servicios', 'Don Ramón González', '+54 9 3534 70-1122', 'Contado', null, 'Cobra por viaje. Confirmar el acceso del camión antes de contratar.', true),
  ('Bombas y Filtros del Interior', 'Hidráulica', 'Verónica', null, 'Cuenta corriente', '30 días', null, true),
  ('Maderera La Estancia', 'Materiales', 'Ariel', '+54 9 3534 66-7788', 'Contado', null, null, true),
  ('Mármoles y Granitos Traverso', 'Materiales', null, null, null, null, 'Pedir presupuesto por mail.', true),
  ('Pinturas y Epoxis del Litoral', 'Materiales', 'Gisela', '+54 9 342 444-9090', 'Contado', null, null, true),
  ('Distribuidora Piletas del Valle', 'Hidráulica', 'Marcos', '+54 9 3534 12-3456 / +54 9 3534 65-4321 / +54 9 3534 99-8877', 'Contado', null, null, true),
  ('Proveedor Discontinuado S.A.', 'Materiales', null, '+54 9 3534 00-0000', null, null, 'Ya no trabajamos con ellos.', false)
on conflict do nothing;

-- ── Materiales (~54): nombres largos reales; algunos sin precio ("A confirmar"), en dólares o desactivados ──────
insert into public.materiales (nombre, proveedor_id, unidad, precio, precio_actualizado, rubro, aplica, usd_ref, notas, cantidades, activo)
select v.nombre, (select p.id from public.proveedores p where p.nombre = v.proveedor), v.unidad, v.precio, v.actualizado::date, v.rubro, v.aplica, v.usd, v.notas, v.cantidades::jsonb, v.activo
from (values
  ('Cemento portland (bolsa 50 kg)', 'Corralón El Progreso S.A.', 'bolsa', 9800, '2026-10-12', 'Materiales', 'Siempre', null::numeric, null, '{"5x3":30,"6x3":35,"7x3":40,"7x3.50":45,"7x4":50,"8x3":48,"8x4":60,"9x3":55,"9x4":70,"10x4":80,"6.5x2.5":28}', true),
  ('Arena gruesa zarandeada (total obra)', 'Áridos del Centro', 'm³', 28500, '2026-10-12', 'Áridos', 'Siempre', null, 'Se pide por camión de 6 m³.', '{"5x3":8,"6x3":9,"7x3":10,"7x3.50":11,"7x4":12,"8x3":12,"8x4":14,"9x3":14,"9x4":16,"10x4":18,"6.5x2.5":7}', true),
  ('Piedra partida 6-20 (total obra)', 'Áridos del Centro', 'm³', 31200, '2026-10-12', 'Áridos', 'Siempre', null, null, '{"5x3":5,"6x3":6,"7x3":7,"7x3.50":7,"7x4":8,"8x3":8,"8x4":9,"9x3":9,"9x4":10,"10x4":12,"6.5x2.5":4}', true),
  ('Hierro del 8 mm (barra de 12 m)', 'Corralón El Progreso S.A.', 'unidad', 14900, '2026-10-05', 'Materiales', 'Siempre', null, null, '{"8x4":60,"9x4":70,"10x4":80}', true),
  ('Hierro del 6 mm (barra de 12 m)', 'Corralón El Progreso S.A.', 'unidad', 8700, '2026-10-05', 'Materiales', 'Siempre', null, null, '{"8x4":40,"9x4":45,"10x4":50}', true),
  ('Malla sima Q188 (paño de 6 m)', 'Corralón El Progreso S.A.', 'unidad', 61000, '2026-09-28', 'Materiales', 'Siempre', null, null, '{"8x4":12,"9x4":14,"10x4":16}', true),
  ('Cal hidratada (bolsa 25 kg)', 'Corralón El Progreso S.A.', 'bolsa', 4200, '2026-10-12', 'Materiales', 'Siempre', null, null, '{"8x4":20}', true),
  ('Ladrillo hueco 18x18x33', 'Corralón El Progreso S.A.', 'unidad', 780, '2026-10-12', 'Materiales', 'Siempre', null, null, '{"8x4":600}', true),
  ('Adhesivo cementicio impermeable (bolsa 30 kg)', 'Pinturas y Epoxis del Litoral', 'bolsa', 12800, '2026-10-02', 'Materiales', 'Losetas', null, null, '{"8x4":25}', true),
  ('Pastina epoxi para juntas (kit 5 kg)', 'Pinturas y Epoxis del Litoral', 'kit', 38900, '2026-10-02', 'Materiales', 'Siempre', null, null, '{"8x4":6}', true),
  ('Hidrófugo para mezcla (bidón 20 lts)', 'Pinturas y Epoxis del Litoral', 'unidad', 21500, '2026-10-02', 'Materiales', 'Siempre', null, null, '{"8x4":2}', true),
  ('Membrana líquida impermeabilizante (tambor 20 kg)', 'Pinturas y Epoxis del Litoral', 'unidad', 74000, '2026-09-20', 'Materiales', 'Siempre', null, 'Dos manos cruzadas.', '{"8x4":3}', true),
  ('Caño PVC cloaca 110 mm x 4 m', 'PVC Sur S.R.L.', 'unidad', 18700, '2026-10-08', 'PVC', 'Siempre', null, null, '{"8x4":4}', true),
  ('Caño PVC presión 50 mm x 4 m (clase 6)', 'PVC Sur S.R.L.', 'unidad', 15400, '2026-10-08', 'PVC', 'Siempre', null, null, '{"8x4":6}', true),
  ('Codo PVC 90° encolar 50 mm', 'PVC Sur S.R.L.', 'unidad', 1650, '2026-10-08', 'PVC', 'Siempre', null, null, '{"8x4":10}', true),
  ('Adaptador mixto hembra 50×40×1½"', 'Hidráulica Córdoba Mayorista', 'unidad', 3100, '2026-10-10', 'Hidráulica', 'Siempre', null, null, '{"8x4":4}', true),
  ('Válvula esférica PVC roscada 1½" con unión doble', 'Hidráulica Córdoba Mayorista', 'unidad', 9800, '2026-10-10', 'Hidráulica', 'Siempre', null, null, '{"8x4":3}', true),
  ('Válvula selectora multipuerto 1½" para filtro', 'Bombas y Filtros del Interior', 'unidad', 86000, '2026-09-30', 'Hidráulica', 'Siempre', null, null, '{"8x4":1}', true),
  ('Filtro de arena 24" con válvula selectora', 'Bombas y Filtros del Interior', 'unidad', 489000, '2026-09-30', 'Hidráulica', 'Siempre', null, 'Para piletas de hasta 60 m³.', '{"8x4":1,"9x4":1,"10x4":1}', true),
  ('Bomba centrífuga autocebante 1 HP (con prefiltro)', 'Bombas y Filtros del Interior', 'unidad', 372000, '2026-09-30', 'Hidráulica', 'Siempre', null, null, '{"8x4":1,"9x4":1,"10x4":1}', true),
  ('Arena sílice para filtro (bolsa 25 kg)', 'Bombas y Filtros del Interior', 'bolsa', 11200, '2026-09-30', 'Hidráulica', 'Siempre', null, null, '{"8x4":3}', true),
  ('Skimmer boca ancha de ABS con tapa y aro', 'Distribuidora Piletas del Valle', 'unidad', 64000, '2026-10-01', 'Hidráulica', 'Siempre', null, null, '{"8x4":2}', true),
  ('Retorno orientable de ABS con tuerca y niple', 'Distribuidora Piletas del Valle', 'unidad', 14500, '2026-10-01', 'Hidráulica', 'Siempre', null, null, '{"8x4":4}', true),
  ('Sumidero de fondo antiatrapamiento 8"', 'Distribuidora Piletas del Valle', 'unidad', 58000, '2026-10-01', 'Hidráulica', 'Siempre', null, null, '{"8x4":2}', true),
  ('Boquilla de limpieza fondo con tapa', 'Distribuidora Piletas del Valle', 'unidad', 9300, '2026-10-01', 'Hidráulica', 'Siempre', null, null, '{"8x4":1}', true),
  ('Cinta teflón (rollo)', 'Hidráulica Córdoba Mayorista', 'rollo', 650, '2026-10-10', 'Hidráulica', 'Siempre', null, null, '{"8x4":10}', true),
  ('Pegamento PVC (lata 1 litro)', 'PVC Sur S.R.L.', 'unidad', 17800, '2026-10-08', 'PVC', 'Siempre', null, null, '{"8x4":1}', true),
  ('Kit eléctrico piscina (térmicas, disyuntor, cajas, cables)', 'Eléctrica Villa María', 'kit', 185000, '2026-10-06', 'Eléctrico', 'Siempre', null, 'Incluye tablero estanco de 12 módulos.', '{"8x4":1,"9x4":1,"10x4":1}', true),
  ('Cable subterráneo 3 x 2,5 mm² (rollo de 100 m)', 'Eléctrica Villa María', 'rollo', 168000, '2026-10-06', 'Eléctrico', 'Siempre', null, null, '{"8x4":1}', true),
  ('Caño corrugado reforzado 25 mm (rollo de 25 m)', 'Eléctrica Villa María', 'rollo', 19500, '2026-10-06', 'Eléctrico', 'Siempre', null, null, '{"8x4":1}', true),
  ('Térmica bipolar 2 x 16 A', 'Eléctrica Villa María', 'unidad', 15900, '2026-10-06', 'Eléctrico', 'Siempre', null, null, '{"8x4":2}', true),
  ('Luz LED de acero inoxidable 12 V (con nicho)', 'Iluminación Acuática Argentina', 'unidad', 98000, '2026-09-25', 'Luces', 'Luz', null, null, '{"8x4":1}', true),
  ('Transformador 12 V 100 W para luces sumergibles', 'Iluminación Acuática Argentina', 'unidad', 64000, '2026-09-25', 'Luces', 'Luz (fija)', null, null, '{"8x4":1}', true),
  ('Luz LED cama de agua (kit completo, instalada)', 'Iluminación Acuática Argentina', 'kit', null, null, 'Luces', 'Luz cama de agua', 114.68, 'Precio de referencia en dólares, a confirmar.', '{"8x4":1}', true),
  ('Cerámico símil piedra Bali 10x10 en malla (por m²)', 'Cerámicos Bali Importados', 'unidad', 41500, '2026-09-15', 'Materiales', 'Siempre', null, null, '{"8x4":60}', true),
  ('Loseta atérmica antideslizante 40x40 (por m²)', 'Maderera La Estancia', 'unidad', 27800, '2026-09-18', 'Materiales', 'Losetas', null, null, '{"8x4":24}', true),
  ('Deck atérmico antideslizante (tabla de 1 m)', 'Maderera La Estancia', 'unidad', 5900, '2026-09-18', 'Materiales', 'Deck', null, null, '{"8x4":200}', true),
  ('Travertino pulido taponado 60x40 (por m²)', 'Mármoles y Granitos Traverso', 'unidad', null, null, 'Materiales', 'Siempre', 62.5, null, '{}', true),
  ('Piedra Bali importada 10x10 y 20x20 (por m²)', 'Mármoles y Granitos Traverso', 'unidad', null, null, 'Materiales', 'Siempre', null, 'A confirmar con el proveedor.', '{}', true),
  ('Madera para encofrado (tirantes y tablas, total obra)', 'Maderera La Estancia', 'servicio', 120000, '2026-10-01', 'Materiales', 'Siempre', null, null, '{"8x4":1}', true),
  ('Alambre de atar nº 16 (kg)', 'Ferretería Industrial Rivadavia', 'kg', 3400, '2026-10-04', 'Materiales', 'Siempre', null, null, '{"8x4":8}', true),
  ('Clavos 2½" (kg)', 'Ferretería Industrial Rivadavia', 'kg', 3100, '2026-10-04', 'Materiales', 'Siempre', null, null, '{"8x4":5}', true),
  ('Nylon de obra 200 micrones (rollo de 4 x 25 m)', 'Ferretería Industrial Rivadavia', 'rollo', 54000, '2026-10-04', 'Materiales', 'Siempre', null, null, '{"8x4":1}', true),
  ('Flete de materiales a obra (hasta 30 km)', 'Servicios de Excavación y Retiro de Escombros González e Hijos', 'servicio', 85000, '2026-10-12', 'Servicios', 'Siempre', null, null, '{"8x4":2}', true),
  ('Excavación de pileta con retroexcavadora (por hora)', 'Servicios de Excavación y Retiro de Escombros González e Hijos', 'servicio', 62000, '2026-10-12', 'Servicios', 'Siempre', null, null, '{"8x4":10}', true),
  ('Retiro de tierra y escombros (por viaje de camión)', 'Servicios de Excavación y Retiro de Escombros González e Hijos', 'servicio', 78000, '2026-10-12', 'Servicios', 'Siempre', null, null, '{"8x4":6}', true),
  ('Baño químico (alquiler por la obra)', null, 'servicio', 95000, '2026-10-01', 'Servicios', 'Baño químico', null, 'En caso de corresponder.', '{"8x4":1}', true),
  ('Cloro granulado estabilizado (balde 10 kg)', 'Distribuidora Piletas del Valle', 'unidad', 48500, '2026-10-01', 'Hidráulica', 'Siempre', null, null, '{"8x4":1}', true),
  ('Kit de limpieza (telescópico, manguera, barre fondo, bichero)', 'Distribuidora Piletas del Valle', 'kit', 87000, '2026-10-01', 'Hidráulica', 'Siempre', null, null, '{"8x4":1}', true),
  ('Cinta de aluminio para encuentros (rollo)', 'Ferretería Industrial Rivadavia', 'rollo', 8900, '2026-10-04', 'Materiales', 'Siempre', null, null, '{}', true),
  ('Pintura para pileta clorocaucho (lata 20 lts)', 'Pinturas y Epoxis del Litoral', 'unidad', 189000, '2026-09-10', 'Materiales', 'Siempre', null, 'Ya no se usa: se cambió a epoxi.', '{}', false),
  ('Material de un proveedor viejo (ya no se compra)', 'Proveedor Discontinuado S.A.', 'unidad', 5000, '2026-05-01', 'Materiales', 'Siempre', null, null, '{}', false),
  ('Pico de pato cromado para cascada lámina de agua', 'Distribuidora Piletas del Valle', 'unidad', 132000, '2026-10-01', 'Hidráulica', 'Siempre', null, null, '{}', true)
) as v(nombre, proveedor, unidad, precio, actualizado, rubro, aplica, usd, notas, cantidades, activo)
on conflict do nothing;

-- ── Presupuestos (con tildes, nombres largos y anulados). Sin autor: sólo se ven en el historial. ──────────
insert into public.presupuestos (tipo, cliente_nombre, created_at, datos, anulado_at, anulado_motivo)
values
  ('piscinas', 'Pérez, María Elena', now() - interval '2 days', '{"v":1,"tipo":"piscinas","fecha":"20/10/2026","cliente":{"nombre":"Pérez, María Elena"},"detalle":"Piscina de fibra Caribe 550 con solárium seco y luces","lineas":[],"preciosBase":{},"totales":[]}'::jsonb, null, null),
  ('piscinas', 'Rodríguez de la Fuente Echeverría, Familia (barrio cerrado Los Aromos, lote 14 y 15)', now() - interval '5 days', '{"v":1,"tipo":"piscinas","fecha":"17/10/2026","cliente":{"nombre":"Rodríguez de la Fuente Echeverría, Familia"},"detalle":"Piscina de hormigón 8x4 con cascada, climatización inverter y revestimiento de piedra Bali","lineas":[],"preciosBase":{},"totales":[]}'::jsonb, null, null),
  ('cercos', 'Gómez, Alejandro', now() - interval '6 days', '{"v":1,"tipo":"cercos","fecha":"16/10/2026","cliente":{"nombre":"Gómez, Alejandro"},"medidas":{"metrosLineales":24},"lineas":[],"preciosBase":{},"totales":[]}'::jsonb, null, null),
  ('cobertores', 'Fernández, Lucía', now() - interval '9 days', '{"v":1,"tipo":"cobertores","fecha":"13/10/2026","cliente":{"nombre":"Fernández, Lucía"},"medidas":{"largo":7,"ancho":3.5},"lineas":[],"preciosBase":{},"totales":[]}'::jsonb, null, null),
  ('revestimientos', 'Ñandú Construcciones S.R.L.', now() - interval '12 days', '{"v":1,"tipo":"revestimientos","fecha":"10/10/2026","cliente":{"nombre":"Ñandú Construcciones S.R.L."},"medidas":{"largo":8,"ancho":4},"lineas":[],"preciosBase":{},"totales":[]}'::jsonb, null, null),
  ('losetas', 'Sánchez, Martín', now() - interval '14 days', '{"v":1,"tipo":"losetas","fecha":"08/10/2026","cliente":{"nombre":"Sánchez, Martín"},"medidas":{"largo":6,"ancho":3},"lineas":[],"preciosBase":{},"totales":[]}'::jsonb, null, null),
  ('piscinas', 'López, Jorge', now() - interval '20 days', '{"v":1,"tipo":"piscinas","fecha":"02/10/2026","cliente":{"nombre":"López, Jorge"},"detalle":"Piscina de fibra Racionalista 600","lineas":[],"preciosBase":{},"totales":[]}'::jsonb, now() - interval '18 days', 'El cliente desistió de la obra'),
  ('cercos', 'Cliente de prueba con un nombre larguísimo para ver cómo se corta en el historial de presupuestos y no rompe la pantalla', now() - interval '25 days', '{"v":1,"tipo":"cercos","fecha":"27/09/2026","cliente":{"nombre":"Cliente de prueba largo"},"medidas":{"metrosLineales":40},"lineas":[],"preciosBase":{},"totales":[]}'::jsonb, now() - interval '24 days', 'Se cargó dos veces por error'),
  ('piscinas', 'Acuña, Rosa', now() - interval '30 days', '{"v":1,"tipo":"piscinas","fecha":"22/09/2026","cliente":{"nombre":"Acuña, Rosa"},"detalle":"Piscina de fibra Lagune 476","lineas":[],"preciosBase":{},"totales":[]}'::jsonb, null, null);

-- ── Pedidos (varios estados; uno anulado) ───────────────────────────────────────────────────────
insert into public.pedidos (obra, solicitante, parametros, lineas, costo, estado, notas, created_at, anulado_at, anulado_motivo)
select v.obra, v.solicitante, v.parametros::jsonb,
       (select coalesce(jsonb_agg(jsonb_build_object(
          'material_id', m.id, 'nombre', m.nombre, 'unidad', m.unidad, 'cantidad', 3, 'precio', m.precio, 'subtotal', m.precio * 3,
          'proveedor_id', p.id, 'proveedor', p.nombre, 'contacto', p.contacto, 'telefono', p.telefono)), '[]'::jsonb)
          from (select * from public.materiales where precio is not null and activo order by nombre limit v.cuantos offset v.salto) m
          left join public.proveedores p on p.id = m.proveedor_id),
       v.costo, v.estado, v.notas, now() - v.hace::interval, v.anulado_at, v.anulado_motivo
from (values
  ('Obra Familia Pérez — Los Cocos 123', 'Benja', '{"tamano":"8x4","obras":1,"borde":"Losetas","luces":2,"luzCamaAgua":true,"banoQuimico":false}', 9, 0, 2458000, 'borrador', 'Confirmar el horario de entrega con el encargado.', '1 day', null::timestamptz, null::text),
  ('Obra Rodríguez de la Fuente Echeverría (barrio cerrado Los Aromos, lote 14)', 'Marcos', '{"tamano":"9x4","obras":1,"borde":"Deck","luces":3,"luzCamaAgua":false,"banoQuimico":true}', 14, 3, 3790000, 'enviado', null, '4 days', null, null),
  ('Obra Gómez', 'Benja', '{"tamano":"7x3","obras":2,"borde":"Losetas","luces":2,"luzCamaAgua":false,"banoQuimico":false}', 6, 10, 1210000, 'recibido', null, '9 days', null, null),
  ('Obra Fernández', 'Benja', '{"tamano":"6x3","obras":1,"borde":"Losetas","luces":2,"luzCamaAgua":false,"banoQuimico":false}', 7, 16, 980000, 'enviado', null, '13 days', null, null),
  ('Obra López (cancelada)', 'Marcos', '{"tamano":"10x4","obras":1,"borde":"Deck","luces":3,"luzCamaAgua":true,"banoQuimico":true}', 5, 4, 4120000, 'cancelado', null, '20 days', null, null),
  ('Obra Sánchez (se pidió dos veces)', 'Benja', '{"tamano":"5x3","obras":1,"borde":"Losetas","luces":2,"luzCamaAgua":false,"banoQuimico":false}', 4, 20, 760000, 'borrador', null, '22 days', now() - interval '21 days', 'Se pidió dos veces por error')
) as v(obra, solicitante, parametros, cuantos, salto, costo, estado, notas, hace, anulado_at, anulado_motivo);

set session_replication_role = origin;
