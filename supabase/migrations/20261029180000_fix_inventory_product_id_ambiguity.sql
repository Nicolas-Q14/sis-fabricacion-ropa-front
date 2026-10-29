create or replace function public.save_inventory_product(
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
  p_max_stock integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_product_id uuid;
  warehouse_id uuid;
  variant_id uuid;
  variant jsonb;
  inserted_variant_id uuid;
begin
  if not public.user_can_access_company(p_company_id) then
    raise exception 'No tienes acceso a la empresa seleccionada.'
      using errcode = '42501';
  end if;
  if p_initial_stock < 0 or p_min_stock < 0 or p_max_stock < p_min_stock then
    raise exception 'Los valores de inventario no son válidos.'
      using errcode = '22023';
  end if;
  if jsonb_typeof(p_variants) <> 'array' then
    raise exception 'Las variantes deben enviarse como una lista.'
      using errcode = '22023';
  end if;
  if p_product_id is null and jsonb_array_length(p_variants) = 0 then
    raise exception 'Un producto nuevo debe incluir al menos una variante.'
      using errcode = '22023';
  end if;

  if p_product_id is null then
    insert into public.inventory_products (
      company_id, sku, name, description, category, gender,
      unit_price, barcode, image_url
    )
    values (
      p_company_id, p_sku, p_name, p_description, p_category, p_gender,
      p_unit_price, p_barcode, p_image_url
    )
    returning id into saved_product_id;
  else
    update public.inventory_products as product
    set sku = p_sku,
        name = p_name,
        description = p_description,
        category = p_category,
        gender = p_gender,
        unit_price = p_unit_price,
        barcode = p_barcode,
        image_url = p_image_url,
        updated_at = now()
    where product.company_id = p_company_id
      and product.id = p_product_id
    returning product.id into saved_product_id;

    if saved_product_id is null then
      raise exception 'No se encontró el producto que se intenta editar.'
        using errcode = 'P0002';
    end if;

    update public.inventory_variants as existing_variant
    set min_stock = p_min_stock,
        max_stock = p_max_stock
    where existing_variant.company_id = p_company_id
      and existing_variant.product_id = p_product_id;
  end if;

  insert into public.inventory_warehouses (company_id, name)
  values (p_company_id, 'Bodega principal')
  on conflict (company_id, name) do nothing;
  select warehouse.id into warehouse_id
  from public.inventory_warehouses as warehouse
  where warehouse.company_id = p_company_id
    and warehouse.name = 'Bodega principal';

  for variant in select value from jsonb_array_elements(p_variants)
  loop
    inserted_variant_id := null;
    insert into public.inventory_variants (
      company_id, product_id, color, size, barcode, min_stock, max_stock
    )
    values (
      p_company_id,
      saved_product_id,
      variant ->> 'color',
      variant ->> 'size',
      variant ->> 'barcode',
      p_min_stock,
      p_max_stock
    )
    on conflict (company_id, product_id, color, size) do nothing
    returning id into inserted_variant_id;

    variant_id := inserted_variant_id;
    if variant_id is null then
      select existing_variant.id into variant_id
      from public.inventory_variants as existing_variant
      where existing_variant.company_id = p_company_id
        and existing_variant.product_id = saved_product_id
        and existing_variant.color = variant ->> 'color'
        and existing_variant.size = variant ->> 'size';
      update public.inventory_variants as existing_variant
      set min_stock = p_min_stock,
          max_stock = p_max_stock
      where existing_variant.company_id = p_company_id
        and existing_variant.id = variant_id;
    else
      insert into public.inventory_stock (company_id, variant_id, warehouse_id, quantity)
      values (p_company_id, variant_id, warehouse_id, p_initial_stock);
      if p_initial_stock > 0 then
        insert into public.inventory_movements (
          company_id, variant_id, warehouse_id, movement_type, quantity,
          reference, notes, created_by_user_id
        )
        values (
          p_company_id, variant_id, warehouse_id, 'entrada', p_initial_stock,
          case when p_product_id is null then 'Inventario inicial' else 'Alta de variante' end,
          'Stock inicial de la variante.',
          (select auth.uid())
        );
      end if;
    end if;
  end loop;

  return saved_product_id;
end;
$$;

revoke all on function public.save_inventory_product(
  uuid, uuid, text, text, text, text, text, numeric, text, text, jsonb,
  integer, integer, integer
) from public, anon;
grant execute on function public.save_inventory_product(
  uuid, uuid, text, text, text, text, text, numeric, text, text, jsonb,
  integer, integer, integer
) to authenticated;

notify pgrst, 'reload schema';
