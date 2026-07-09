-- Catálogo compartido (precios y descripciones de materiales/opcionales) entre
-- todos los usuarios y dispositivos. Hoy cada -calc.js guarda su copia editable
-- del catálogo solo en localStorage del navegador (K_CATALOG/K_PRECIOS) — esta
-- tabla pasa a ser el destino de "actualizar para todos los presupuestos futuros".
--
-- "clave" es el `slug` que cada -calc.js ya usa para identificar opcionales
-- (piscinas/cercos/cobertores/revestimientos) o el nombre del campo de precio
-- base ('precioSin', 'precioCon', 'precioMenos15', 'precioMas15', 'precioInstalacion').
create table if not exists public.catalogo_items (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('piscinas', 'cercos', 'cobertores', 'revestimientos', 'losetas')),
  clave text not null,
  descripcion text,
  precio numeric,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique (tipo, clave)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_catalogo_items_updated_at on public.catalogo_items;
create trigger trg_catalogo_items_updated_at
  before update on public.catalogo_items
  for each row
  execute function public.set_updated_at();

alter table public.catalogo_items enable row level security;

create policy "Authenticated users can read catalogo_items"
  on public.catalogo_items for select
  to authenticated
  using (true);

create policy "Authenticated users can insert catalogo_items"
  on public.catalogo_items for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update catalogo_items"
  on public.catalogo_items for update
  to authenticated
  using (true)
  with check (true);

-- Seed inicial: copiado de los defaultOptionales y precios base hardcodeados hoy
-- en cada public/*-calc.js (piscinas, cercos, cobertores, revestimientos), extraído
-- programáticamente para no transcribir a mano. "precio: null" en el JS (ítems "a
-- cotizar") se guarda como precio null acá también. Losetas no tiene fila inicial:
-- no tenía persistencia previa, así que su catálogo global arranca vacío y se puebla
-- recién cuando alguien confirme el primer precio permanente de un material.
insert into public.catalogo_items (tipo, clave, descripcion, precio)
values
  ('piscinas', 'luces', 'Luces de acero inoxidable con su respectiva controladora, fuente e instalaciones eléctricas, se pueden colocar 2 o 3 (siendo una en la cama de agua) — precio por unidad', 240000),
  ('piscinas', 'reemplazo_losetas_decks', 'Reemplazo de losetas incluidas en vereda perimetral de 0.50 mts de ancho por decks atérmicos antideslizantes de 1x0.12 mts', 1290000),
  ('piscinas', 'solarium_losetas', 'Solárium seco hormigón + losetas atérmicas, terminado (precio por m2)', 239000),
  ('piscinas', 'solarium_decks', 'Solárium seco hormigón + decks atérmicos 1x0.12, terminado (precio por m2)', 279000),
  ('piscinas', 'kit_limpieza', 'Kit de Limpieza: caño telescópico, manga desagote, manguera flotante, barre fondo, bichero, cloro', 109000),
  ('piscinas', 'bano_quimico', 'Baño químico, en caso de corresponder', null),
  ('piscinas', 'retiro_tierra', 'Retiro de tierra desde la calle', null),
  ('piscinas', 'tapa_metalica', 'Tapa metálica sala de filtros', null),
  ('piscinas', 'climatizacion25000', 'Climatización bomba de calor inverter, hasta 25.000 lts, instalada (precio normal con instalación $3.300.000 — este valor es oportunidad con equipo físico en nuestro negocio)', 2650000),
  ('piscinas', 'climatizacion30000', 'Climatización bomba de calor inverter, hasta 30.000 lts, instalada (ver diferentes gamas de equipos: básico, intermedio y pro)', null),
  ('piscinas', 'revestimiento_ceramico_bali', 'Revestimiento interior cerámico importado de Brasil símil piedra Bali, color verde o celeste 10x10 en malla, terminado, instalado', 4990000),
  ('piscinas', 'revestimiento_piedra_bali', 'Revestimiento interior en piedra Bali importada de Indonesia de 10x10 y 20x20 cms, piedras individuales, se enciman unas con otras, sin juntas, terminado, instalado', null),
  ('piscinas', 'travertino_rustico_exterior', 'Revestimiento exterior de piscina en Mármol Travertino Rústico 60x40 cms, importado de Turquía, mano de obra y materiales, terminado', null),
  ('piscinas', 'travertino_pulido_interior', 'Revestimiento interior de piscina completa en Mármol Travertino Pulido Taponado 60x40 cms, importado de Turquía, mano de obra y materiales, terminado', null),
  ('piscinas', 'cerco_perimetral', 'Cerco perimetral desmontable de aluminio y lona microperforada para seguridad de niños y mascotas, materiales y mano de obra, instalado (valor por metro lineal)', 79500),
  ('cercos', 'porton_reforzado', 'Portón de acceso reforzado con cerradura', null),
  ('cercos', 'refuerzo_postes', 'Refuerzo de postes en esquinas o desniveles del terreno', null),
  ('cercos', 'lona_premium', 'Lona premium (mayor gramaje / color a elección)', null),
  ('cobertores', 'soga_sujecion_reforzada', 'Soga y accesorios de sujeción reforzados', null),
  ('cobertores', 'funda_protectora_invierno', 'Funda protectora para guardado del cobertor en invierno', null),
  ('revestimientos', 'revestimiento_ceramico_bali', 'Cerámico Bali Brasil (por m² instalado)', 112000),
  ('revestimientos', 'venecitas_premium_espana', 'Venecitas Premium España (por m² instalado)', 140000),
  ('revestimientos', 'revestimiento_piedra_bali', 'Piedra Bali Indonesia (por m² instalado)', 195000),
  ('revestimientos', 'travertino', 'Mármol Travertino Turquía (por m² instalado)', 200000),
  ('revestimientos', 'solar_seco_losetas', 'Solar seco — losetas atérmicas (por m² terminado)', 229000),
  ('revestimientos', 'solar_seco_deck', 'Solar seco — deck 1×0.12m (por m² terminado)', 269000),
  ('revestimientos', 'disqueado_revestimiento_previo', 'Disqueado / remoción de revestimiento previo (por obra, solo si tiene revestimiento viejo)', 800000),
  ('cercos', 'precioSin', 'Precio por metro lineal sin instalación', 63500),
  ('cercos', 'precioCon', 'Precio por metro lineal con instalación', 79500),
  ('cobertores', 'precioMenos15', 'Precio por m² para piletas de hasta 15 m²', 10903),
  ('cobertores', 'precioMas15', 'Precio por m² para piletas de más de 15 m²', 9902),
  ('cobertores', 'precioInstalacion', 'Costo fijo de instalación', 100000)
on conflict (tipo, clave) do nothing;
