-- Datos de ejemplo para la base LOCAL (supabase db reset). NO es para producción.
--
-- Es el catálogo de precios inicial: se generó copiando, sin retipear, las
-- sentencias de datos de migration_catalogo_items.sql, migration_catalogo_categorias.sql,
-- migration_cascada.sql, migration_listas_piscinas.sql y migration_stock_piscinas.sql.
-- No trae clientes, proveedores, materiales ni pedidos (eso no está en el repo).

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
