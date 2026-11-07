-- ARRANCAR DE CERO CON LAS PISCINAS INDUSPLAST: borra TODOS sus movimientos de stock y deja cada modelo en 0.
--
-- Es DEFINITIVO: el registro de esos movimientos (pruebas) desaparece de Stock > Movimientos. Sólo toca los ítems
-- cuya clave empieza con "indusplast_"; el resto del stock y su historial no se tocan. A partir de acá, todo lo que
-- se sume o reste vuelve a quedar registrado (quién, cuándo, cuánto) como siempre.
--
-- Correr UNA vez en el SQL Editor de Supabase. Al final muestra cómo quedó cada modelo (stock 0, sin movimientos).

begin;

-- El libro es "sólo agregar": para esta limpieza única se apaga la protección y se vuelve a prender al terminar.
alter table public.movimientos_stock disable trigger trg_movimientos_stock_solo_agregar;

-- Primero las anulaciones (apuntan a otro movimiento) y después el resto.
delete from public.movimientos_stock
where anula_a is not null
  and item_id in (select id from public.catalogo_items where clave like 'indusplast\_%');

delete from public.movimientos_stock
where item_id in (select id from public.catalogo_items where clave like 'indusplast\_%');

alter table public.movimientos_stock enable trigger trg_movimientos_stock_solo_agregar;

-- El stock es la suma de los movimientos: sin movimientos, 0. (También se apaga, sólo para esto, la protección
-- que impide tocar el stock a mano.)
alter table public.catalogo_items disable trigger trg_catalogo_items_proteger_stock;
update public.catalogo_items
   set stock = 0
 where clave like 'indusplast\_%' and stock is not null;
alter table public.catalogo_items enable trigger trg_catalogo_items_proteger_stock;

commit;

select i.clave, i.stock, (select count(*) from public.movimientos_stock m where m.item_id = i.id) as movimientos
from public.catalogo_items i
where i.clave like 'indusplast\_%' and i.stock is not null
order by i.clave;
