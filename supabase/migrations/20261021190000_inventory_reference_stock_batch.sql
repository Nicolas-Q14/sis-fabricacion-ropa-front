create or replace function public.apply_inventory_reference_stock_batch(
  p_company_id uuid,
  p_product_id uuid,
  p_type text,
  p_warehouse_name text,
  p_items jsonb,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  selected_variant_id uuid;
  quantity integer;
  variant_min_stock integer;
  variant_max_stock integer;
  processed_variant_ids uuid[] := array[]::uuid[];
begin
  if p_company_id is null
    or p_product_id is null
    or p_type is null
    or p_warehouse_name is null
    or p_items is null then
    raise exception 'La empresa, el producto, el tipo, la bodega y las variantes son obligatorios.'
      using errcode = '22023';
  end if;

  if not public.user_can_access_company(p_company_id) then
    raise exception 'No tienes acceso al inventario.'
      using errcode = '42501';
  end if;

  if p_type not in ('entrada', 'salida')
    or nullif(trim(p_warehouse_name), '') is null then
    raise exception 'El tipo o la bodega no son válidos.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.inventory_products as product
    where product.company_id = p_company_id
      and product.id = p_product_id
  ) then
    raise exception 'No se encontró la referencia seleccionada.'
      using errcode = 'P0002';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'La lista de variantes debe ser un arreglo.'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'Selecciona al menos una variante.'
      using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(item) is distinct from 'object'
      or coalesce(item ->> 'quantity', '') !~ '^[1-9][0-9]*$' then
      raise exception 'Cada variante requiere una cantidad entera mayor que cero.'
        using errcode = '22023';
    end if;

    if length(item ->> 'quantity') > 10
      or (item ->> 'quantity')::numeric > 2147483647 then
      raise exception 'La cantidad por variante supera el máximo permitido.'
        using errcode = '22023';
    end if;

    if item ? 'variant_id' then
      if coalesce(item ->> 'variant_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'El identificador de variante no es válido.'
          using errcode = '22023';
      end if;
    else
      if p_type <> 'entrada' then
        raise exception 'Las nuevas tallas y colores solo se pueden crear con una entrada.'
          using errcode = '22023';
      end if;
      if nullif(trim(item ->> 'color'), '') is null
        or nullif(trim(item ->> 'size'), '') is null
        or length(trim(item ->> 'color')) > 80
        or length(trim(item ->> 'size')) > 40 then
        raise exception 'Cada nueva variante requiere color y talla válidos.'
          using errcode = '22023';
      end if;
    end if;
  end loop;

  for item in
    select value
    from jsonb_array_elements(p_items)
    order by coalesce(value ->> 'variant_id', lower(trim(value ->> 'color')) || '|' || lower(trim(value ->> 'size')))
  loop
    quantity := (item ->> 'quantity')::integer;

    if item ? 'variant_id' then
      select variant.id into selected_variant_id
      from public.inventory_variants as variant
      where variant.company_id = p_company_id
        and variant.product_id = p_product_id
        and variant.id = (item ->> 'variant_id')::uuid;

      if selected_variant_id is null then
        raise exception 'Una variante seleccionada no pertenece a esta referencia.'
          using errcode = '22023';
      end if;
    else
      selected_variant_id := null;

      select variant.id into selected_variant_id
      from public.inventory_variants as variant
      where variant.company_id = p_company_id
        and variant.product_id = p_product_id
        and variant.color = trim(item ->> 'color')
        and variant.size = trim(item ->> 'size');

      if selected_variant_id is null then
        variant_min_stock := 0;
        variant_max_stock := null;

        select variant.min_stock, variant.max_stock
          into variant_min_stock, variant_max_stock
        from public.inventory_variants as variant
        where variant.company_id = p_company_id
          and variant.product_id = p_product_id
        order by variant.created_at
        limit 1;

        variant_min_stock := coalesce(variant_min_stock, 0);

        insert into public.inventory_variants (
          company_id, product_id, color, size, min_stock, max_stock
        )
        values (
          p_company_id,
          p_product_id,
          trim(item ->> 'color'),
          trim(item ->> 'size'),
          variant_min_stock,
          variant_max_stock
        )
        on conflict (company_id, product_id, color, size) do nothing
        returning id into selected_variant_id;

        if selected_variant_id is null then
          select variant.id into selected_variant_id
          from public.inventory_variants as variant
          where variant.company_id = p_company_id
            and variant.product_id = p_product_id
            and variant.color = trim(item ->> 'color')
            and variant.size = trim(item ->> 'size');
        end if;
      end if;
    end if;

    if selected_variant_id = any(processed_variant_ids) then
      raise exception 'La lista contiene dos entradas para la misma variante.'
        using errcode = '22023';
    end if;
    processed_variant_ids := array_append(processed_variant_ids, selected_variant_id);

    perform public.apply_inventory_movement(
      p_company_id,
      selected_variant_id,
      p_type,
      quantity,
      trim(p_warehouse_name),
      null,
      'Frenesi sport',
      nullif(trim(p_notes), '')
    );
  end loop;
end;
$$;

revoke all on function public.apply_inventory_reference_stock_batch(
  uuid, uuid, text, text, jsonb, text
) from public, anon;
grant execute on function public.apply_inventory_reference_stock_batch(
  uuid, uuid, text, text, jsonb, text
) to authenticated;

notify pgrst, 'reload schema';
