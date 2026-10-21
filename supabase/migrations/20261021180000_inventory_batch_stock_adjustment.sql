create or replace function public.apply_inventory_stock_batch(
  p_company_id uuid,
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
begin
  if p_company_id is null
    or p_type is null
    or p_warehouse_name is null
    or p_items is null then
    raise exception 'La empresa, el tipo, la bodega y las variantes son obligatorios.'
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
    if jsonb_typeof(item) <> 'object'
      or coalesce(item ->> 'variant_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(item ->> 'quantity', '') !~ '^[1-9][0-9]*$' then
      raise exception 'Cada variante requiere un identificador y una cantidad entera mayor que cero.'
        using errcode = '22023';
    end if;

    if length(item ->> 'quantity') > 10
      or (item ->> 'quantity')::numeric > 2147483647 then
      raise exception 'La cantidad por variante supera el máximo permitido.'
        using errcode = '22023';
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as item(value)
    group by item.value ->> 'variant_id'
    having count(*) > 1
  ) then
    raise exception 'La lista contiene variantes duplicadas.'
      using errcode = '22023';
  end if;

  for item in
    select value
    from jsonb_array_elements(p_items)
    order by value ->> 'variant_id'
  loop
    selected_variant_id := (item ->> 'variant_id')::uuid;
    quantity := (item ->> 'quantity')::integer;

    if not exists (
      select 1
      from public.inventory_variants as variant
      where variant.company_id = p_company_id
        and variant.id = selected_variant_id
    ) then
      raise exception 'Una variante seleccionada no pertenece al inventario.'
        using errcode = '22023';
    end if;

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

revoke all on function public.apply_inventory_stock_batch(uuid, text, text, jsonb, text)
  from public, anon;
grant execute on function public.apply_inventory_stock_batch(uuid, text, text, jsonb, text)
  to authenticated;

notify pgrst, 'reload schema';
