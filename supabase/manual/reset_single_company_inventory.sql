-- Destructive one-time reset of inventory data, not database structure.
-- Keeps warehouses, orders, and production history. Order garments are detached
-- from inventory variants so historical orders do not block the reset.
begin;

-- The standard trigger rejects changes to delivered order items. Only the
-- inventory links are cleared below; the trigger is restored in this transaction.
alter table public.order_items
  disable trigger order_items_prevent_fulfilled_edit;

update public.order_items
set inventory_variant_id = null,
    inventory_warehouse_id = null
where company_id = '00000000-0000-0000-0000-000000000001'::uuid
  and (
    inventory_variant_id is not null
    or inventory_warehouse_id is not null
  );

alter table public.order_items
  enable trigger order_items_prevent_fulfilled_edit;

delete from public.inventory_movements
where company_id = '00000000-0000-0000-0000-000000000001'::uuid;

delete from public.inventory_stock
where company_id = '00000000-0000-0000-0000-000000000001'::uuid;

delete from public.inventory_variants
where company_id = '00000000-0000-0000-0000-000000000001'::uuid;

delete from public.inventory_products
where company_id = '00000000-0000-0000-0000-000000000001'::uuid;

commit;

select
  (select count(*) from public.inventory_products
    where company_id = '00000000-0000-0000-0000-000000000001'::uuid) as products_remaining,
  (select count(*) from public.inventory_variants
    where company_id = '00000000-0000-0000-0000-000000000001'::uuid) as variants_remaining,
  (select count(*) from public.inventory_stock
    where company_id = '00000000-0000-0000-0000-000000000001'::uuid) as stock_rows_remaining,
  (select count(*) from public.inventory_movements
    where company_id = '00000000-0000-0000-0000-000000000001'::uuid) as movements_remaining,
  (select count(*) from public.inventory_warehouses
    where company_id = '00000000-0000-0000-0000-000000000001'::uuid) as warehouses_preserved;
