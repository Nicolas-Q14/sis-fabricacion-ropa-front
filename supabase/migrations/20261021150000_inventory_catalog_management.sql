create or replace function public.delete_inventory_product(
  p_company_id uuid,
  p_product_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.user_can_access_company(p_company_id) then
    raise exception 'No tienes acceso al inventario.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.inventory_products as p
    where p.company_id = p_company_id
      and p.id = p_product_id
  ) then
    raise exception 'No se encontró el producto.'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.inventory_variants as v
    join public.order_items as oi
      on oi.company_id = v.company_id
      and oi.inventory_variant_id = v.id
    where v.company_id = p_company_id
      and v.product_id = p_product_id
  ) or exists (
    select 1
    from public.inventory_variants as v
    join public.inventory_movements as m
      on m.company_id = v.company_id
      and m.variant_id = v.id
    where v.company_id = p_company_id
      and v.product_id = p_product_id
  ) then
    raise exception 'No se puede eliminar este producto porque tiene pedidos o movimientos asociados.'
      using errcode = '23503';
  end if;

  delete from public.inventory_stock as s
  using public.inventory_variants as v
  where s.company_id = p_company_id
    and s.variant_id = v.id
    and v.company_id = p_company_id
    and v.product_id = p_product_id;

  delete from public.inventory_variants as v
  where v.company_id = p_company_id
    and v.product_id = p_product_id;

  delete from public.inventory_products as p
  where p.company_id = p_company_id
    and p.id = p_product_id;
end;
$$;

revoke all on function public.delete_inventory_product(uuid, uuid)
  from public, anon;
grant execute on function public.delete_inventory_product(uuid, uuid)
  to authenticated;
