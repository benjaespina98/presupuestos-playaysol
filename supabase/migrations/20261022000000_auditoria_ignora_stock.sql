-- =============================================================================
-- AUDITORÍA: el stock del catálogo ya no se audita fila por fila
-- =============================================================================
--
-- Con el libro de movimientos (20261022000100_stock_movimientos.sql),
-- `catalogo_items.stock` pasa a ser un CACHÉ que mantiene un trigger: cada venta
-- o ingreso lo cambia. Auditar ese campo duplicaría, sin información nueva, lo
-- que ya dice el libro (que además guarda quién, cuándo, por qué y el saldo).
--
-- Esta migración reemplaza `auditar_cambios()` (creada en 20261021000100) para
-- que, en `catalogo_items`, la columna `stock` se ignore igual que `updated_at`:
--   * un UPDATE que sólo toca stock no genera fila en `auditoria`;
--   * si cambia stock junto con otra columna, la fila registra la otra columna.
-- Todo lo demás de la función es idéntico. No se edita la migración de la fase 1.
--
-- Idempotente. No borra datos.
--
-- ROLLBACK: volver a ejecutar la definición de `auditar_cambios()` de
-- 20261021000100_auditoria.sql (es un `create or replace`).
-- =============================================================================

create or replace function public.auditar_cambios()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sensibles constant text[] := coalesce(tg_argv, '{}'::text[]);
  -- `updated_at` cambia en cada UPDATE por el trigger set_updated_at: no aporta información.
  -- En catalogo_items, `stock` es un caché del libro de movimientos: se audita allá.
  ignoradas constant text[] :=
    case when tg_table_name = 'catalogo_items' then array['updated_at', 'stock'] else array['updated_at'] end;
  v_antes jsonb;
  v_despues jsonb;
  v_cambiadas text[];
  v_valores jsonb;
  v_id uuid;
begin
  if tg_op = 'INSERT' then
    v_despues := to_jsonb(new);
    v_id := (v_despues ->> 'id')::uuid;
    select coalesce(array_agg(k order by k), '{}') into v_cambiadas
      from jsonb_object_keys(v_despues) as k
      where k <> all (ignoradas);
    v_valores := jsonb_build_object('despues', v_despues - sensibles - ignoradas);

  elsif tg_op = 'UPDATE' then
    v_antes := to_jsonb(old);
    v_despues := to_jsonb(new);
    v_id := (v_despues ->> 'id')::uuid;
    select coalesce(array_agg(k order by k), '{}') into v_cambiadas
      from jsonb_object_keys(v_despues) as k
      where k <> all (ignoradas)
        and (v_antes -> k) is distinct from (v_despues -> k);
    -- Un UPDATE que no cambió nada auditable no es un hecho que auditar.
    if coalesce(array_length(v_cambiadas, 1), 0) = 0 then
      return null;
    end if;
    select jsonb_build_object(
             'antes',   coalesce(jsonb_object_agg(k, v_antes -> k), '{}'::jsonb),
             'despues', coalesce(jsonb_object_agg(k, v_despues -> k), '{}'::jsonb))
      into v_valores
      from unnest(v_cambiadas) as k
      where k <> all (sensibles);
    if v_valores = '{"antes": {}, "despues": {}}'::jsonb then
      v_valores := null;
    end if;

  else -- DELETE
    v_antes := to_jsonb(old);
    v_id := (v_antes ->> 'id')::uuid;
    select coalesce(array_agg(k order by k), '{}') into v_cambiadas
      from jsonb_object_keys(v_antes) as k
      where k <> all (ignoradas);
    v_valores := jsonb_build_object('antes', v_antes - sensibles - ignoradas);
  end if;

  insert into public.auditoria (tabla, registro_id, accion, usuario_id, columnas_cambiadas, valores)
  values (tg_table_name, v_id, tg_op, auth.uid(), v_cambiadas, v_valores);

  return null; -- trigger AFTER: el valor de retorno se ignora
end;
$$;

revoke all on function public.auditar_cambios() from public, anon, authenticated;
