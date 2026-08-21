-- Catálogo de precios: columnas para la pantalla de Catálogo (Fase 4).
--
-- Correr UNA vez en el SQL Editor de Supabase, DESPUÉS de
-- migration_catalogo_items.sql. Es seguro re-ejecutarla entera.
--
-- ADITIVA: no borra ni renombra nada, y no pisa ninguna edición manual. Las
-- filas existentes siguen funcionando igual para las calculadoras, que sólo
-- leen `clave`, `precio` y `descripcion`.

-- 1) Columnas nuevas ----------------------------------------------------------
alter table public.catalogo_items
  add column if not exists categoria text,
  add column if not exists unidad    text,
  add column if not exists activo    boolean not null default true,
  add column if not exists orden     integer;

-- Los 9 rubros comerciales. Se valida en la base además de en el código para
-- que una fila cargada a mano desde el panel de Supabase no rompa la pantalla.
-- `categoria` puede quedar en null: significa "sin clasificar" y cae en Otros.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'catalogo_items_categoria_valida'
  ) then
    alter table public.catalogo_items
      add constraint catalogo_items_categoria_valida
      check (categoria is null or categoria in (
        'Piscinas', 'Filtración', 'Revestimientos', 'Iluminación', 'Cobertores',
        'Cercos', 'Accesorios', 'Mano de obra', 'Otros'
      ));
  end if;
end $$;

-- La pantalla lista por categoría y filtra los inactivos.
create index if not exists idx_catalogo_items_categoria
  on public.catalogo_items (categoria) where activo;

-- 2) Clasificación inicial ----------------------------------------------------
-- Sólo toca filas SIN categoría (`where categoria is null`), así que se puede
-- volver a correr sin pisar lo que el equipo haya reclasificado desde la app.
--
-- El criterio por defecto es mecánico: la categoría que corresponde al tipo de
-- trabajo. Después vienen las excepciones obvias. No pretende ser la
-- clasificación definitiva — es un punto de partida editable desde la pantalla.

-- 2a) Por defecto, según el tipo de calculadora.
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

-- 2b) Excepciones: ítems cuyo rubro real no es el de su calculadora.
update public.catalogo_items set categoria = 'Iluminación'
  where clave = 'luces';
update public.catalogo_items set categoria = 'Filtración'
  where clave in ('tapa_metalica', 'climatizacion25000', 'climatizacion30000');
update public.catalogo_items set categoria = 'Mano de obra'
  where clave in ('retiro_tierra', 'disqueado_revestimiento_previo');
update public.catalogo_items set categoria = 'Otros'
  where clave = 'bano_quimico';
-- Revestimientos vendidos como opcional de una piscina nueva: el rubro es
-- Revestimientos aunque la calculadora sea piscinas.
update public.catalogo_items set categoria = 'Revestimientos'
  where tipo = 'piscinas'
    and clave in (
      'revestimiento_ceramico_bali', 'revestimiento_piedra_bali',
      'travertino_rustico_exterior', 'travertino_pulido_interior'
    );
update public.catalogo_items set categoria = 'Cercos'
  where tipo = 'piscinas' and clave = 'cerco_perimetral';

-- 3) Unidades -----------------------------------------------------------------
-- Texto informativo que acompaña al precio. No participa de ningún cálculo.
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

-- Las claves reservadas de texto (__legal, __footer_*) quedan sin categoría ni
-- unidad a propósito: no son productos y la pantalla de Catálogo las excluye
-- por el prefijo (ver lib/domain/catalogo/categorias.ts).

-- 4) Comprobación -------------------------------------------------------------
-- Después de correr esto, para ver cómo quedó clasificado:
--
--   select categoria, count(*), string_agg(clave, ', ' order by clave)
--   from public.catalogo_items
--   where clave not like '\_\_%'
--   group by categoria order by categoria;
