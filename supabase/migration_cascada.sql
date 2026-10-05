-- Opcional "Cascada" para piscinas, sin precio ("a cotizar").
--
-- Correr UNA vez en el SQL Editor de Supabase, DESPUÉS de
-- migration_catalogo_items.sql y migration_catalogo_categorias.sql.
-- Es seguro re-ejecutarla: no pisa una fila existente ni sus ediciones.
--
-- Es un adicional que no suma al estándar: sólo cuenta si se tilda en el
-- presupuesto. Como precio null, el documento lo muestra como "No incluye"
-- hasta que se le cargue un importe desde la pantalla de Catálogo.

insert into public.catalogo_items (tipo, clave, descripcion, precio, categoria)
values
  ('piscinas', 'cascada', 'Cascada lámina de agua', null, 'Accesorios')
on conflict (tipo, clave) do nothing;
