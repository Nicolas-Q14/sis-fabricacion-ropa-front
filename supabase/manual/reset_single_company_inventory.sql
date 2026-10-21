-- Destructive one-time reset for the single-company inventory.
-- Keeps orders and production history, but detaches their garments from
-- inventory variants before removing the catalog and stock ledger.
begin;

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

delete from public.inventory_warehouses
where company_id = '00000000-0000-0000-0000-000000000001'::uuid;

commit;
