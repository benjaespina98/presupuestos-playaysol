-- Stock de piscinas de fibra (Indusplast) en el local de Av. Carranza, Villa Nueva.
--
-- Correr UNA vez en el SQL Editor de Supabase, DESPUÉS de
-- migration_catalogo_items.sql, migration_catalogo_categorias.sql y
-- migration_listas_piscinas.sql. Es seguro re-ejecutarla.
--
-- `stock` es la cantidad de unidades físicas que hay en el local:
--   * null  = el ítem NO lleva stock (hierros, luces, cercos... se piden a
--             pedido, no se guardan). Es el valor de casi todo el catálogo.
--   * 0 o + = lleva stock; 0 significa "agotado".
-- Para que otro artículo lleve stock en el futuro basta con tildar "Llevar
-- stock" al editarlo en el Catálogo: no hace falta otra migración.

alter table public.catalogo_items
  add column if not exists stock integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'catalogo_items_stock_no_negativo'
  ) then
    alter table public.catalogo_items
      add constraint catalogo_items_stock_no_negativo
      check (stock is null or stock >= 0);
  end if;
end $$;

-- Las piscinas Indusplast llevan stock real: arrancan en 0. Sólo se inicializan
-- las que todavía no lo tienen, así volver a correr esto no pisa lo ya contado.
update public.catalogo_items
   set stock = 0
 where tipo = 'piscinas'
   and clave like 'indusplast\_%'
   and stock is null;
