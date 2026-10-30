with catalog_products as (
  select
    product.id,
    product.catalog_year,
    lower(
      btrim(
        regexp_replace(product.name, '^(2025|2026)[[:space:]]+', '', 'i')
      )
    ) as shared_name,
    nullif(btrim(product.image_url), '') as image_url
  from public.inventory_products as product
  where product.company_id = '00000000-0000-0000-0000-000000000001'::uuid
    and product.is_active
    and product.catalog_year in (2025, 2026)
),
shared_images as (
  select
    shared_name,
    min(image_url) as image_url
  from catalog_products
  group by shared_name
  having count(distinct catalog_year) = 2
    and count(distinct image_url) = 1
)
update public.inventory_products as product
set image_url = shared_images.image_url
from catalog_products
join shared_images using (shared_name)
where product.id = catalog_products.id
  and product.company_id = '00000000-0000-0000-0000-000000000001'::uuid
  and catalog_products.image_url is null;
