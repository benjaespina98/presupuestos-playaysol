-- Limpieza: un "USD de referencia" de 0 no existe, es "sin cotización en dólares".
--
-- Correr UNA vez en el SQL Editor de Supabase. Es seguro re-ejecutarla.
--
-- El formulario de Materiales guardaba el USD de referencia como 0 cuando se
-- recorría el campo vacío con Tab. La planilla de costos interpretaba cualquier
-- valor ahí como "se cotiza en dólares" y mostraba $0 en el precio.
-- (El formulario y la exportación ya lo corrigen: esto sólo limpia lo ya guardado.)

update public.materiales set usd_ref = null where usd_ref = 0;

select count(*) as materiales_con_usd_ref_real from public.materiales where usd_ref > 0;
