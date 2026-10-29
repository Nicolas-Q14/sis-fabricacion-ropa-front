create or replace function public.create_order_with_items(
  p_company_id uuid,
  p_order jsonb,
  p_items jsonb,
  p_initial_payment jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_order_id uuid;
  created_client_id uuid;
  item jsonb;
begin
  if not public.user_can_access_company(p_company_id) then
    raise exception 'No tienes acceso a la empresa seleccionada.'
      using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido debe incluir al menos una prenda.'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) as items(value)
    where nullif(value ->> 'inventory_variant_id', '') is null
      or nullif(value ->> 'inventory_warehouse_id', '') is null
  ) then
    raise exception 'Cada prenda debe estar asociada a una variante y una bodega.'
      using errcode = '23514';
  end if;

  insert into public.clients (company_id, name)
  values (p_company_id, p_order ->> 'customer_name')
  on conflict (company_id, name) do update
    set updated_at = now()
  returning id into created_client_id;

  insert into public.orders (
    company_id,
    client_id,
    code,
    customer_name,
    seller_user_id,
    seller_name,
    entry_date,
    delivery_date,
    status,
    summary,
    total_amount,
    note
  )
  values (
    p_company_id,
    created_client_id,
    p_order ->> 'code',
    p_order ->> 'customer_name',
    (select auth.uid()),
    p_order ->> 'seller_name',
    (p_order ->> 'entry_date')::date,
    (p_order ->> 'delivery_date')::date,
    'Diseño',
    p_order ->> 'summary',
    (p_order ->> 'total_amount')::numeric,
    p_order ->> 'note'
  )
  returning id into created_order_id;

  for item in select value from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (
      company_id,
      order_id,
      inventory_variant_id,
      inventory_warehouse_id,
      garment_type,
      fit,
      color,
      size,
      printed_name,
      printed_number,
      notes,
      unit_price,
      price_manually_edited,
      adjustments
    )
    values (
      p_company_id,
      created_order_id,
      nullif(item ->> 'inventory_variant_id', '')::uuid,
      nullif(item ->> 'inventory_warehouse_id', '')::uuid,
      item ->> 'garment_type',
      item ->> 'fit',
      item ->> 'color',
      item ->> 'size',
      nullif(item ->> 'printed_name', ''),
      nullif(item ->> 'printed_number', ''),
      nullif(item ->> 'notes', ''),
      coalesce((item ->> 'unit_price')::numeric, 0),
      coalesce((item ->> 'price_manually_edited')::boolean, false),
      coalesce(item -> 'adjustments', '[]'::jsonb)
    );
  end loop;

  if p_initial_payment is not null
    and coalesce((p_initial_payment ->> 'amount')::numeric, 0) > 0 then
    insert into public.order_payments (
      company_id,
      order_id,
      amount,
      payment_method,
      created_by_user_id
    )
    values (
      p_company_id,
      created_order_id,
      (p_initial_payment ->> 'amount')::numeric,
      p_initial_payment ->> 'payment_method',
      (select auth.uid())
    );
  end if;

  insert into public.order_events (
    company_id,
    order_id,
    event_type,
    description,
    user_id
  )
  values (
    p_company_id,
    created_order_id,
    'created',
    'Pedido registrado.',
    (select auth.uid())
  );

  return created_order_id;
end;
$$;
