-- CERCO PERIMETRAL REPETIDO: dos ítems con el mismo precio ($79.500 por metro lineal).
--   * "Precio por metro lineal con instalación" (precioCon): es el precio que usa la calculadora de Cercos. Se queda.
--   * "Cerco perimetral desmontable..." (cerco_perimetral): es el mismo precio cargado como adicional de piscinas.
-- Esto da de baja el segundo (Activo apagado): deja de ofrecerse en presupuestos NUEVOS, no se borra y los presupuestos
-- ya guardados lo siguen mostrando. Para volver atrás: Precios > Mostrar desactivados > Editar > Activo.
-- (Lo mismo se puede hacer a mano desde la web, sin este script.)
update public.catalogo_items
   set activo = false
 where tipo = 'piscinas' and clave = 'cerco_perimetral' and activo = true;

select tipo, clave, precio, activo from public.catalogo_items where clave in ('cerco_perimetral', 'precioCon') order by clave;
