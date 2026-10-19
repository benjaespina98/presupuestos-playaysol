-- Un presupuesto sólo se puede crear a nombre de uno mismo (H-08 de AUDITORIA.md).
--
-- Correr UNA vez en el SQL Editor de Supabase. Es seguro re-ejecutarla.
-- ORDEN: aplicar ANTES que migration_storage_sin_update.sql.
--
-- Antes: la policy de insert era `with check (true)`, y `created_by` lo manda el
-- navegador (lib/presupuestos.ts → guardarPresupuesto). Cualquier usuario
-- autenticado podía crear un presupuesto "a nombre de" otro, y el dueño falso
-- después pasaba la policy de update/delete de migration_perfiles_ownership.sql.
--
-- Ahora: `created_by` tiene que ser el usuario autenticado. No rompe el alta
-- normal: guardarPresupuesto manda `created_by = user.id` (el mismo
-- auth.uid() de la sesión) y, si no mandara nada, la columna tiene
-- `default auth.uid()` (schema.sql).
--
-- Nota: filas con created_by NULL (si las hubiera) no se ven afectadas, la
-- policy sólo mira lo que se inserta de ahora en más.
--
-- ROLLBACK (volver a la policy abierta):
--   drop policy if exists "Users can insert presupuestos as themselves" on public.presupuestos;
--   create policy "Authenticated users can insert presupuestos"
--     on public.presupuestos for insert
--     to authenticated
--     with check (true);

drop policy if exists "Authenticated users can insert presupuestos" on public.presupuestos;
drop policy if exists "Users can insert presupuestos as themselves" on public.presupuestos;

create policy "Users can insert presupuestos as themselves"
  on public.presupuestos for insert
  to authenticated
  with check (created_by = auth.uid());
