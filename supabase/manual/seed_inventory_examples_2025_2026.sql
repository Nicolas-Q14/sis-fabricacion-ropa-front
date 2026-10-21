-- Adds one demo product per inventory subcategory for catalogs 2025 and 2026.
-- Safe to rerun: existing products with these SKUs are left unchanged.
-- Requires migrations through 20261021170000_inventory_catalog_taxonomy.sql.
begin;

insert into public.inventory_warehouses (company_id, name)
values (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Bodega principal'
)
on conflict (company_id, name) do update
set is_active = true;

with examples (
  catalog_year, category, subcategory, type_code, name, description, unit_price
) as (
  values
    (2025, 'Textiles', 'busos_capota', 'BSC', '2025 Buso deportivo con capota',
      'Muestra de buzo deportivo con capota para uniforme de equipo.', 115000::numeric),
    (2025, 'Textiles', 'camibusos', 'CMB', '2025 Camibuso deportivo',
      'Muestra de camibuso de entrenamiento con tejido transpirable.', 68000::numeric),
    (2025, 'Textiles', 'camisetas', 'CAM', '2025 Camiseta deportiva',
      'Muestra de camiseta deportiva para uniforme de equipo.', 55000::numeric),
    (2025, 'Textiles', 'camisetas_manga_larga', 'CML', '2025 Camiseta deportiva manga larga',
      'Muestra de camiseta deportiva de manga larga para entrenamiento.', 72000::numeric),
    (2025, 'Textiles', 'chaquetas', 'CHA', '2025 Chaqueta deportiva',
      'Muestra de chaqueta deportiva liviana para equipo.', 125000::numeric),
    (2025, 'Textiles', 'petos', 'PET', '2025 Peto deportivo de entrenamiento',
      'Muestra de peto deportivo para identificacion en entrenamientos.', 28000::numeric),
    (2025, 'Textiles', 'polo', 'POL', '2025 Camiseta polo deportiva',
      'Muestra de polo deportivo para presentacion de equipo.', 65000::numeric),
    (2025, 'Textiles', 'sudaderas', 'SUD', '2025 Sudadera deportiva',
      'Muestra de sudadera deportiva para uniforme de equipo.', 98000::numeric),
    (2025, 'Promocionales', 'mugs_y_termos', 'MUG', '2025 Termo deportivo',
      'Muestra de termo promocional para clubes y eventos deportivos.', 42000::numeric),
    (2025, 'Promocionales', 'toallas_microfibra', 'TMI', '2025 Toalla deportiva de microfibra',
      'Muestra de toalla de microfibra para entrenamiento y competencia.', 35000::numeric),
    (2026, 'Textiles', 'busos_capota', 'BSC', '2026 Buso deportivo con capota',
      'Muestra de buzo deportivo con capota para uniforme de equipo.', 119000::numeric),
    (2026, 'Textiles', 'camibusos', 'CMB', '2026 Camibuso deportivo',
      'Muestra de camibuso de entrenamiento con tejido transpirable.', 71000::numeric),
    (2026, 'Textiles', 'camisetas', 'CAM', '2026 Camiseta deportiva',
      'Muestra de camiseta deportiva para uniforme de equipo.', 58000::numeric),
    (2026, 'Textiles', 'camisetas_manga_larga', 'CML', '2026 Camiseta deportiva manga larga',
      'Muestra de camiseta deportiva de manga larga para entrenamiento.', 75000::numeric),
    (2026, 'Textiles', 'chaquetas', 'CHA', '2026 Chaqueta deportiva',
      'Muestra de chaqueta deportiva liviana para equipo.', 129000::numeric),
    (2026, 'Textiles', 'petos', 'PET', '2026 Peto deportivo de entrenamiento',
      'Muestra de peto deportivo para identificacion en entrenamientos.', 30000::numeric),
    (2026, 'Textiles', 'polo', 'POL', '2026 Camiseta polo deportiva',
      'Muestra de polo deportivo para presentacion de equipo.', 69000::numeric),
    (2026, 'Textiles', 'sudaderas', 'SUD', '2026 Sudadera deportiva',
      'Muestra de sudadera deportiva para uniforme de equipo.', 102000::numeric),
    (2026, 'Promocionales', 'mugs_y_termos', 'MUG', '2026 Termo deportivo',
      'Muestra de termo promocional para clubes y eventos deportivos.', 45000::numeric),
    (2026, 'Promocionales', 'toallas_microfibra', 'TMI', '2026 Toalla deportiva de microfibra',
      'Muestra de toalla de microfibra para entrenamiento y competencia.', 38000::numeric)
),
inserted_products as (
  insert into public.inventory_products (
    company_id, sku, name, description, category, subcategory, catalog_year,
    gender, unit_price, is_active
  )
  select
    '00000000-0000-0000-0000-000000000001'::uuid,
    format('FS-%s-%s-%s-001',
      examples.catalog_year,
      case when examples.category = 'Textiles' then 'TEX' else 'PRO' end,
      examples.type_code),
    examples.name,
    examples.description,
    examples.category,
    examples.subcategory,
    examples.catalog_year,
    'Unisex',
    examples.unit_price,
    true
  from examples
  on conflict (company_id, sku) do nothing
  returning id, company_id, sku
),
inserted_variants as (
  insert into public.inventory_variants (
    company_id, product_id, color, size, min_stock, max_stock, is_active
  )
  select
    products.company_id,
    products.id,
    'Azul marino',
    sizes.size,
    3,
    100,
    true
  from inserted_products as products
  cross join (values ('S'), ('M'), ('L')) as sizes(size)
  returning id, company_id
),
inserted_stock as (
  insert into public.inventory_stock (company_id, variant_id, warehouse_id, quantity)
  select
    variants.company_id,
    variants.id,
    warehouses.id,
    5
  from inserted_variants as variants
  join public.inventory_warehouses as warehouses
    on warehouses.company_id = variants.company_id
   and warehouses.name = 'Bodega principal'
  returning variant_id, company_id, warehouse_id, quantity
),
inserted_movements as (
  insert into public.inventory_movements (
    company_id, variant_id, warehouse_id, movement_type, quantity,
    reference, notes, created_by_user_id
  )
  select
    stock.company_id,
    stock.variant_id,
    stock.warehouse_id,
    'entrada',
    stock.quantity,
    'Frenesi sport',
    'Stock de demostracion para iniciar el catalogo.',
    auth.uid()
  from inserted_stock as stock
  returning id
)
select
  (select count(*) from inserted_products) as demo_products_added,
  (select count(*) from inserted_variants) as demo_variants_added,
  (select count(*) from inserted_stock) as stock_rows_added,
  (select count(*) from inserted_movements) as opening_movements_added;

commit;

select
  catalog_year,
  category,
  subcategory,
  count(*) as example_products
from public.inventory_products
where company_id = '00000000-0000-0000-0000-000000000001'::uuid
  and catalog_year in (2025, 2026)
  and sku like 'FS-%-001'
group by catalog_year, category, subcategory
order by catalog_year, category, subcategory;
