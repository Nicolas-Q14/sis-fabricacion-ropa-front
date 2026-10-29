drop function if exists public.get_public_inventory();

create function public.get_public_inventory()
returns table (
  catalog_year smallint,
  product_name text,
  category text,
  subcategory text,
  product_gender text,
  image_url text,
  color text,
  size text,
  available_quantity integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with active_reservations as (
    select
      oi.inventory_variant_id as variant_id,
      oi.inventory_warehouse_id as warehouse_id,
      count(*)::integer as reserved_quantity
    from public.order_items as oi
    join public.orders as o
      on o.company_id = oi.company_id
      and o.id = oi.order_id
    where oi.company_id = '00000000-0000-0000-0000-000000000001'::uuid
      and oi.inventory_variant_id is not null
      and oi.inventory_warehouse_id is not null
      and o.deleted_at is null
      and o.archived_at is null
      and o.stock_deducted_at is null
    group by oi.inventory_variant_id, oi.inventory_warehouse_id
  )
  select
    p.catalog_year,
    p.name,
    p.category,
    p.subcategory,
    p.gender,
    p.image_url,
    v.color,
    v.size,
    coalesce(
      sum(greatest(
        coalesce(s.quantity, 0) - coalesce(ar.reserved_quantity, 0),
        0
      )),
      0
    )::integer
  from public.inventory_products as p
  join public.inventory_variants as v
    on v.company_id = p.company_id
    and v.product_id = p.id
    and v.is_active
  left join public.inventory_stock as s
    on s.company_id = v.company_id
    and s.variant_id = v.id
    and exists (
      select 1
      from public.inventory_warehouses as w
      where w.company_id = s.company_id
        and w.id = s.warehouse_id
        and w.is_active
    )
  left join active_reservations as ar
    on ar.variant_id = s.variant_id
    and ar.warehouse_id = s.warehouse_id
  where p.company_id = '00000000-0000-0000-0000-000000000001'::uuid
    and p.is_active
  group by
    p.catalog_year,
    p.name,
    p.category,
    p.subcategory,
    p.gender,
    p.image_url,
    v.color,
    v.size
  order by p.catalog_year desc, p.name, v.color, v.size;
$$;

revoke all on function public.get_public_inventory() from public, anon, authenticated;
grant execute on function public.get_public_inventory() to anon, authenticated;

notify pgrst, 'reload schema';
