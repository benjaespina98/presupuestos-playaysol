-- REINICIAR LOS PEDIDOS: borra TODOS los pedidos y vuelve la numeración a cero.
-- El próximo pedido que se arme es el PED-0001 y en Actividad figura como "Creó el pedido PED-0001".
--
-- Es DEFINITIVO. Borra:
--   * todos los pedidos (los de prueba),
--   * lo que la auditoría guardó de esos pedidos (para que Actividad no muestre pedidos que ya no existen).
-- No toca presupuestos, precios, materiales, proveedores ni stock.
--
-- Correr UNA vez en el SQL Editor de Supabase. Al final muestra cuántos pedidos quedan (0).

begin;

-- El borrado dispara la auditoría ("eliminó el pedido") y el registro es "sólo agregar": para esta limpieza
-- única se apagan las dos protecciones y se vuelven a prender antes de terminar.
alter table public.pedidos disable trigger trg_auditoria_pedidos;
alter table public.auditoria disable trigger trg_auditoria_solo_agregar;

delete from public.auditoria where tabla = 'pedidos';
delete from public.pedidos;

alter table public.auditoria enable trigger trg_auditoria_solo_agregar;
alter table public.pedidos enable trigger trg_auditoria_pedidos;

-- La numeración vuelve a 1.
alter table public.pedidos alter column numero restart with 1;

commit;

select count(*) as pedidos_que_quedan from public.pedidos;
