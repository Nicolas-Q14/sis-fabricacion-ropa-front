alter table public.inventory_products
  add column catalog_year smallint not null default 2026
    check (catalog_year between 2000 and 2100),
  add column subcategory text not null default 'otros';

update public.inventory_products
set category = case
      when lower(coalesce(category, '')) in ('promocional', 'promocionales')
        or lower(name) like '%mug%'
        or lower(name) like '%termo%'
        or lower(name) like '%toalla%'
        then 'Promocionales'
      else 'Textiles'
    end,
    subcategory = case
      when lower(name) like '%bus%capota%' then 'busos_capota'
      when lower(name) like '%camiseta%manga larga%' then 'camisetas_manga_larga'
      when lower(name) like '%camiseta%' then 'camisetas'
      when lower(name) like '%camibus%' then 'camibusos'
      when lower(name) like '%chaqueta%' then 'chaquetas'
      when lower(name) like '%peto%' then 'petos'
      when lower(name) like '%polo%' then 'polo'
      when lower(name) like '%sudadera%' then 'sudaderas'
      when lower(name) like '%pantaloneta%' then 'pantalonetas'
      when lower(name) like '%media%' or lower(name) like '%medias%' then 'medias'
      when lower(name) like '%mug%' or lower(name) like '%termo%' then 'mugs_y_termos'
      when lower(name) like '%toalla%' then 'toallas_microfibra'
      else 'otros'
    end;

create or replace function public.save_inventory_catalog_product(
  p_company_id uuid,
  p_product_id uuid,
  p_sku text,
  p_name text,
  p_description text,
  p_category text,
  p_gender text,
  p_unit_price numeric,
  p_barcode text,
  p_image_url text,
  p_variants jsonb,
  p_initial_stock integer,
  p_min_stock integer,
  p_max_stock integer,
  p_subcategory text,
  p_catalog_year smallint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_product_id uuid;
begin
  if p_catalog_year is null or p_catalog_year not between 2000 and 2100 then
    raise exception 'El año del catálogo no es válido.'
      using errcode = '22023';
  end if;

  if p_category is null or p_subcategory is null or not (
    (p_category = 'Textiles' and p_subcategory = any(array[
      'busos_capota', 'camibusos', 'camisetas', 'camisetas_manga_larga',
      'chaquetas', 'petos', 'polo', 'sudaderas', 'pantalonetas', 'medias', 'otros'
    ]))
    or
    (p_category = 'Promocionales' and p_subcategory = any(array[
      'mugs_y_termos', 'toallas_microfibra', 'otros'
    ]))
  ) then
    raise exception 'La familia y subcategoría del producto no son válidas.'
      using errcode = '22023';
  end if;

  saved_product_id := public.save_inventory_product(
    p_company_id,
    p_product_id,
    p_sku,
    p_name,
    p_description,
    p_category,
    p_gender,
    p_unit_price,
    p_barcode,
    p_image_url,
    p_variants,
    p_initial_stock,
    p_min_stock,
    p_max_stock
  );

  update public.inventory_products
  set subcategory = p_subcategory,
      catalog_year = p_catalog_year
  where company_id = p_company_id
    and id = saved_product_id;

  return saved_product_id;
end;
$$;

revoke all on function public.save_inventory_catalog_product(
  uuid, uuid, text, text, text, text, text, numeric, text, text, jsonb,
  integer, integer, integer, text, smallint
) from public, anon;
grant execute on function public.save_inventory_catalog_product(
  uuid, uuid, text, text, text, text, text, numeric, text, text, jsonb,
  integer, integer, integer, text, smallint
) to authenticated;

notify pgrst, 'reload schema';
