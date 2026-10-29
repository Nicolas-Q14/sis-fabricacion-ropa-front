alter table public.quotations
  add column converted_order_id uuid references public.orders(id) on delete set null,
  add column converted_at timestamptz;

create unique index quotations_converted_order_id_unique
  on public.quotations (converted_order_id)
  where converted_order_id is not null;

create or replace function public.convert_quotation_to_order(
  p_company_id uuid,
  p_quotation_id uuid,
  p_order_code text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  quotation public.quotations%rowtype;
  warehouse_id uuid;
  order_items jsonb;
  created_order_id uuid;
  order_summary text;
begin
  if not public.user_can_access_company(p_company_id) then
    raise exception 'No tienes acceso a la empresa seleccionada.'
      using errcode = '42501';
  end if;

  select q.*
  into quotation
  from public.quotations as q
  where q.id = p_quotation_id
    and q.company_id = p_company_id
  for update;

  if not found then
    raise exception 'No se encontró la cotización seleccionada.'
      using errcode = 'P0002';
  end if;

  if quotation.converted_order_id is not null then
    return quotation.converted_order_id;
  end if;

  if jsonb_typeof(quotation.items) <> 'array'
    or jsonb_array_length(quotation.items) = 0 then
    raise exception 'La cotización no contiene prendas para crear el pedido.'
      using errcode = '22023';
  end if;

  select w.id
  into warehouse_id
  from public.inventory_warehouses as w
  where w.company_id = p_company_id
    and w.name = 'Bodega principal'
    and w.is_active;

  if warehouse_id is null then
    raise exception 'No existe la bodega principal. Configura el inventario antes de confirmar el pedido.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(quotation.items) as quote_item(value)
    where not exists (
      select 1
      from public.inventory_products as p
      join public.inventory_variants as v
        on v.company_id = p.company_id
        and v.product_id = p.id
      where p.company_id = p_company_id
        and p.name = quote_item.value ->> 'garment'
        and p.is_active
        and v.color = quote_item.value ->> 'color'
        and v.size = quote_item.value ->> 'size'
        and v.is_active
    )
  ) then
    raise exception 'Una o más prendas de la cotización no tienen una variante activa en el inventario.'
      using errcode = '23514';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'inventory_variant_id', v.id,
      'inventory_warehouse_id', warehouse_id,
      'garment_type', quote_item.value ->> 'garment',
      'fit', quote_item.value ->> 'fit',
      'color', quote_item.value ->> 'color',
      'size', quote_item.value ->> 'size',
      'printed_name', nullif(quote_item.value ->> 'name', ''),
      'printed_number', nullif(quote_item.value ->> 'number', ''),
      'notes', nullif(quote_item.value ->> 'notes', ''),
      'unit_price', coalesce((quote_item.value ->> 'unitPrice')::numeric, 0),
      'price_manually_edited', true,
      'adjustments', case
        when jsonb_typeof(quote_item.value -> 'adjustment') = 'object'
          then jsonb_build_array(quote_item.value -> 'adjustment')
        else '[]'::jsonb
      end
    )
    order by quote_item.ordinality
  ),
  (array_agg(quote_item.value ->> 'garment' order by quote_item.ordinality))[1]
  into order_items, order_summary
  from jsonb_array_elements(quotation.items) with ordinality as quote_item(value, ordinality)
  join public.inventory_products as p
    on p.company_id = p_company_id
    and p.name = quote_item.value ->> 'garment'
    and p.is_active
  join public.inventory_variants as v
    on v.company_id = p.company_id
    and v.product_id = p.id
    and v.color = quote_item.value ->> 'color'
    and v.size = quote_item.value ->> 'size'
    and v.is_active;

  created_order_id := public.create_order_with_items(
    p_company_id,
    jsonb_build_object(
      'code', p_order_code,
      'customer_name', quotation.customer_name,
      'seller_name', quotation.salesperson,
      'entry_date', quotation.entry_date,
      'delivery_date', quotation.delivery_date,
      'summary', order_summary,
      'total_amount', quotation.grand_total,
      'note', concat_ws(E'\n', nullif(quotation.note, ''), 'Origen: cotización ' || quotation.quote_number)
    ),
    order_items,
    null
  );

  update public.quotations
  set converted_order_id = created_order_id,
      converted_at = now()
  where id = quotation.id
    and company_id = p_company_id;

  return created_order_id;
end;
$$;

revoke all on function public.convert_quotation_to_order(uuid, uuid, text)
  from public, anon;
grant execute on function public.convert_quotation_to_order(uuid, uuid, text)
  to authenticated;
