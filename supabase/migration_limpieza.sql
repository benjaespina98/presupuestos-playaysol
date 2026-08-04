-- Limpieza de base de datos. Correr UNA vez en el SQL Editor de Supabase,
-- DESPUÉS de schema.sql, migration_catalogo_items.sql y
-- migration_perfiles_ownership.sql. Es seguro re-ejecutarla entera.

-- 1) Columna muerta -----------------------------------------------------------
-- `presupuestos.imagen_url` se creó en schema.sql pero no la escribe ni la lee
-- nadie: no aparece en lib/, ni en las calculadoras, ni en el historial. Las
-- fotos de un presupuesto viven dentro de `datos` (jsonb), cada una con su
-- storageUrl, porque son varias por presupuesto y esta columna era una sola.
alter table public.presupuestos drop column if exists imagen_url;

-- 2) Índice para el filtro por autor ------------------------------------------
-- El historial filtra por usuario (?usuario=<id>) y, sobre todo, las políticas
-- RLS de update y delete evalúan `created_by = auth.uid()` en cada escritura.
-- Sin índice eso es un scan secuencial de la tabla entera cada vez.
create index if not exists idx_presupuestos_created_by
  on public.presupuestos (created_by);

-- 3) Una sola definición de set_updated_at ------------------------------------
-- schema.sql y migration_catalogo_items.sql declaraban cada uno su propio
-- `create or replace function public.set_updated_at()`, con cuerpos idénticos.
-- Dos fuentes para la misma función es una invitación a que se desincronicen:
-- queda esta como la definitiva (ambos triggers ya la usan por nombre).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- =============================================================================
-- PENDIENTES QUE NO SE TOCAN ACÁ (decisiones del negocio, no técnicas)
-- =============================================================================
--
-- a) El bucket 'presupuestos' es PÚBLICO (schema.sql: `values (..., true)`).
--    Cualquiera con la URL de una foto puede verla sin estar logueado, y esas
--    URLs quedan escritas dentro de los .docx y los PDF que se le mandan al
--    cliente. Eso es a propósito: el cliente abre el documento sin tener usuario
--    del portal, y si el bucket fuera privado vería recuadros rotos. Pasarlo a
--    privado exigiría URLs firmadas con vencimiento y rompería los documentos ya
--    entregados. Queda público.
--
--    Ojo: SOLO las fotos. Los datos de clientes, los precios y el catálogo viven
--    en tablas cuyas policies exigen `to authenticated` — no son accesibles sin
--    login. El único código que escribe en Storage es subirFotoPresupuesto()
--    en lib/presupuestos.ts.
--
-- b) COMPROBADO EXPUESTO el 2026-08-04: el listado del bucket devolvió 37 fotos
--    a una petición anónima (16 piscinas, 6 cercos, 9 revestimientos, 6
--    cobertores). No es teórico.
--
--    La policy "Anyone can view presupuesto images" (schema.sql) habilita
--    `select` sobre storage.objects al rol `public`, y en Supabase la operación
--    de LISTAR un bucket pasa por esa misma policy. Con ella puesta, un anónimo
--    con la anon key (que viaja en el bundle de JS del sitio: es NEXT_PUBLIC_*)
--    puede pedir el listado del bucket y enumerar todas las fotos, sin adivinar
--    ninguna URL.
--
--    La policy es REDUNDANTE para lo que se necesita: un bucket marcado como
--    público sirve los archivos por /object/public/... sin consultar RLS, que es
--    lo que hace que las fotos se vean en el Word/PDF del cliente. Lo único que
--    agrega la policy es poder listar.
--
--    Para comprobar si tu proyecto está expuesto, desde la raíz del proyecto:
--
--      node scripts/verificar-storage-publico.mjs
--
--    Si dice EXPUESTO, descomentá la línea de abajo y corréla en el SQL Editor.
--    Después volvé a correr el script (tiene que decir NO EXPUESTO) y verificá
--    que un presupuesto ya exportado a Word siga mostrando sus fotos.
--
--      drop policy if exists "Anyone can view presupuesto images" on storage.objects;
--
-- c) No hay política de DELETE sobre storage.objects, así que las fotos que se
--    borran de un presupuesto quedan en el bucket para siempre. Con el volumen
--    de un negocio de este tamaño no es urgente, pero crece sin techo. Cuando
--    moleste, el orden es: primero código que borre el archivo al sacar la foto,
--    y recién entonces la política que lo permita.
