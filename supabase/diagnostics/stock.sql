-- DIAGNÓSTICO DE STOCK — sólo lectura.
--
-- Correr en el SQL Editor de Supabase ANTES de aplicar
-- migrations/20261022000100_stock_movimientos.sql. No modifica nada: sólo
-- SELECT sobre catalogo_items y pg_constraint. Sirve para saber qué va a pasar
-- con la migración (cuántas aperturas crea) y si hay algo inesperado.

-- 1) Por categoría: cuántos ítems llevan stock (stock no null), cuántos tienen unidades, y la suma.
select
  coalesce(categoria, '(sin categoría)') as categoria,
  count(*) filter (where stock is not null)                 as items_con_stock,
  count(*) filter (where stock is not null and stock <> 0)  as items_con_unidades,
  coalesce(sum(stock), 0)                                   as unidades_totales
from public.catalogo_items
where clave not like '\_\_%'
group by 1
order by 1;

-- 2) Cada ítem con stock distinto de 0: va a recibir UN movimiento de apertura por esa cantidad.
select tipo, clave, descripcion, stock as stock_actual
from public.catalogo_items
where stock is not null and stock <> 0
order by tipo, clave;

-- 3) INESPERADO: ítems con stock que NO son piscinas de fibra Indusplast.
--    La migración no los cambia (los conserva y los suma al libro igual); se listan para que decidas.
select tipo, clave, descripcion, stock as stock_actual
from public.catalogo_items
where stock is not null and not (tipo = 'piscinas' and clave like 'indusplast\_%')
order by tipo, clave;

-- 4) INESPERADO: stock negativo (hoy el CHECK lo impide; si aparece, el CHECK no está aplicado).
select tipo, clave, stock as stock_actual
from public.catalogo_items
where stock < 0
order by tipo, clave;

-- 5) La restricción de stock que existe hoy (la migración la elimina porque se permite el stock negativo).
select conname, pg_get_constraintdef(oid) as definicion
from pg_constraint
where conrelid = 'public.catalogo_items'::regclass and conname like '%stock%';

-- 6) ¿Existe ya la columna stock? (si devuelve 0 filas, falta migration_stock_piscinas.sql)
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'catalogo_items' and column_name = 'stock';
