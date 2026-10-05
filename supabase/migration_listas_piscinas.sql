-- Precios de lista de piscinas completas: hormigón por tamaño e Indusplast (fibra).
--
-- Correr UNA vez en el SQL Editor de Supabase, DESPUÉS de
-- migration_catalogo_items.sql y migration_catalogo_categorias.sql.
-- Es seguro re-ejecutarla: no pisa filas existentes ni sus ediciones.
--
-- Fuente: planilla Playa_y_Sol_Pedidos_y_Costos, hoja "Precios y margen"
-- (hormigón: Presupuesto Modelo Piscinas 29/06/2026; fibra: Lista de Precios
-- Indusplast Villa María, julio 2026).
--
-- NO son opcionales del presupuesto: la calculadora de Piscinas los reconoce por
-- el prefijo de la clave (lista_hormigon_ / indusplast_, ver
-- lib/domain/catalogo/listas.ts) y los ofrece en el selector "Precio de lista"
-- que completa el subtotal. Para sumar un modelo nuevo basta con crearlo en el
-- Catálogo con uno de esos prefijos.
--
-- A CONFIRMAR (así figura en la planilla):
--   * 8x3 y 7x4 tienen el mismo precio (12.690.000).
--   * 7x3: la lista dice 11.590.000, el presupuesto de ejemplo usó 12.490.000.
--   * 6.5x2.5 no tiene precio de venta: queda "a cotizar".
-- Indusplast se carga al precio de CONTADO. El financiado es contado + 15 %.

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

-- La planilla la llama "Cascada lámina de agua". Sólo se renombra si nadie la
-- editó a mano (descripcion todavía es la original).
update public.catalogo_items
   set descripcion = 'Cascada lámina de agua'
 where tipo = 'piscinas' and clave = 'cascada' and descripcion = 'Cascada';
