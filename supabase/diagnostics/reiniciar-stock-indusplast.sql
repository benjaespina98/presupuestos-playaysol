-- REINICIAR EL STOCK DE LAS PISCINAS INDUSPLAST A CERO (una sola vez, después de las pruebas).
--
-- Correr en el SQL Editor de Supabase. NO borra nada del registro de movimientos: por cada modelo con stock
-- distinto de cero agrega un "Ajuste de conteo" a 0 con el motivo "Reinicio del stock tras pruebas", a nombre del
-- usuario que pongas abajo. Así queda a la vista en Stock > Movimientos y se puede anular si hiciera falta.
--
-- 1) Cambiá el email de la línea marcada por el de tu usuario del portal.
-- 2) Ejecutá todo. Al final muestra cómo quedó cada modelo Indusplast.

do $$
declare
  v_email text := 'CAMBIAR-POR-TU-EMAIL@ejemplo.com';  -- <== tu usuario del portal
  v_uid uuid;
  r record;
  v_cantidad integer := 0;
begin
  select id into v_uid from auth.users where lower(email) = lower(v_email);
  if v_uid is null then
    raise exception 'No existe el usuario %. Revisá el email de la primera línea.', v_email;
  end if;

  -- Las funciones de stock registran "quién" con auth.uid(): se lo indicamos para esta transacción.
  perform set_config('request.jwt.claim.sub', v_uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);

  for r in
    select id, clave
    from public.catalogo_items
    where clave like 'indusplast\_%' and stock is not null and stock <> 0
    order by clave
  loop
    perform public.ajustar_stock(r.id, 0, 'Reinicio del stock tras pruebas', 'reinicio-' || r.id::text || '-' || to_char(now(), 'YYYYMMDDHH24MISS'));
    v_cantidad := v_cantidad + 1;
  end loop;

  raise notice 'Modelos puestos en 0: %', v_cantidad;
end;
$$;

select clave, stock
from public.catalogo_items
where clave like 'indusplast\_%' and stock is not null
order by clave;
