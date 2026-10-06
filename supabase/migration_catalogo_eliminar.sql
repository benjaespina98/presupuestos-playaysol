-- Permite eliminar ítems del catálogo desde la pantalla de Catálogo.
--
-- Correr UNA vez en el SQL Editor de Supabase. Es seguro re-ejecutarla.
--
-- Hasta ahora la tabla sólo tenía policies de select/insert/update, así que un
-- delete devolvía "0 filas" sin error. Se habilita para usuarios autenticados,
-- EXCEPTO las claves reservadas (__legal, __footer_*): son los textos
-- compartidos del documento, no productos, y no se borran desde el Catálogo.
--
-- "Dar de baja" (activo = false) sigue existiendo para ocultar un ítem sin
-- perderlo; eliminar es definitivo.

drop policy if exists "Authenticated users can delete catalogo_items" on public.catalogo_items;

create policy "Authenticated users can delete catalogo_items"
  on public.catalogo_items for delete
  to authenticated
  using (clave not like '\_\_%');
