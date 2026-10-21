-- Convert orders and inventory to one shared workspace without requiring a
-- corresponding row in public.companies. company_id remains an internal
-- partition key for compatibility with the existing schema and RPCs.

create extension if not exists "uuid-ossp";

do $$
declare
  business_tables text[] := array[
    'clients',
    'orders',
    'order_items',
    'production_events',
    'order_events',
    'order_payments',
    'inventory_warehouses',
    'inventory_products',
    'inventory_variants',
    'inventory_stock',
    'inventory_movements'
  ];
  business_table text;
  constraint_record record;
begin
  for constraint_record in
    select conrelid::regclass as table_name, conname
    from pg_constraint
    where contype = 'f'
      and conrelid = any (
        select format('public.%I', table_name)::regclass
        from unnest(business_tables) as tables(table_name)
      )
      and (
        confrelid = 'public.companies'::regclass
        or confrelid = any (
          select format('public.%I', table_name)::regclass
          from unnest(business_tables) as tables(table_name)
        )
      )
  loop
    execute format('alter table %s drop constraint %I',
      constraint_record.table_name,
      constraint_record.conname);
  end loop;

  foreach business_table in array business_tables
  loop
    execute format(
      'alter table public.%I alter column company_id set default %L::uuid',
      business_table,
      '00000000-0000-0000-0000-000000000001'
    );
    execute format(
      'update public.%I set company_id = %L::uuid where company_id is distinct from %L::uuid',
      business_table,
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001'
    );
  end loop;
end;
$$;

alter table public.orders
  add constraint orders_single_workspace_client_fk
  foreign key (company_id, client_id)
  references public.clients(company_id, id) on delete restrict;

alter table public.order_items
  add constraint order_items_single_workspace_order_fk
  foreign key (company_id, order_id)
  references public.orders(company_id, id) on delete cascade,
  add constraint order_items_single_workspace_variant_fk
  foreign key (company_id, inventory_variant_id)
  references public.inventory_variants(company_id, id) on delete restrict,
  add constraint order_items_single_workspace_warehouse_fk
  foreign key (company_id, inventory_warehouse_id)
  references public.inventory_warehouses(company_id, id) on delete restrict;

alter table public.production_events
  add constraint production_events_single_workspace_order_fk
  foreign key (company_id, order_id)
  references public.orders(company_id, id) on delete cascade,
  add constraint production_events_single_workspace_item_fk
  foreign key (company_id, order_id, order_item_id)
  references public.order_items(company_id, order_id, id) on delete cascade;

alter table public.order_events
  add constraint order_events_single_workspace_order_fk
  foreign key (company_id, order_id)
  references public.orders(company_id, id) on delete cascade;

alter table public.order_payments
  add constraint order_payments_single_workspace_order_fk
  foreign key (company_id, order_id)
  references public.orders(company_id, id) on delete cascade;

alter table public.inventory_stock
  add constraint inventory_stock_single_workspace_variant_fk
  foreign key (company_id, variant_id)
  references public.inventory_variants(company_id, id) on delete restrict,
  add constraint inventory_stock_single_workspace_warehouse_fk
  foreign key (company_id, warehouse_id)
  references public.inventory_warehouses(company_id, id) on delete restrict;

alter table public.inventory_variants
  add constraint inventory_variants_single_workspace_product_fk
  foreign key (company_id, product_id)
  references public.inventory_products(company_id, id) on delete restrict;

alter table public.inventory_movements
  add constraint inventory_movements_single_workspace_variant_fk
  foreign key (company_id, variant_id)
  references public.inventory_variants(company_id, id) on delete restrict,
  add constraint inventory_movements_single_workspace_warehouse_fk
  foreign key (company_id, warehouse_id)
  references public.inventory_warehouses(company_id, id) on delete restrict,
  add constraint inventory_movements_single_workspace_order_fk
  foreign key (company_id, order_id)
  references public.orders(company_id, id) on delete restrict,
  add constraint inventory_movements_single_workspace_item_fk
  foreign key (company_id, order_id, order_item_id)
  references public.order_items(company_id, order_id, id) on delete restrict;

create or replace function public.user_can_access_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      target_company_id = '00000000-0000-0000-0000-000000000001'::uuid
      and exists (
        select 1
        from public.user_roles as ur
        where ur.user_id = (select auth.uid())
          and ur.role in (
            'superadmin'::public.app_role,
            'admin'::public.app_role,
            'gerente_produccion'::public.app_role
          )
      )
    )
    or public.is_superadmin()
    or exists (
      select 1
      from public.user_roles as ur
      where ur.user_id = (select auth.uid())
        and ur.company_id = target_company_id
    ),
    false
  );
$$;

revoke all on function public.user_can_access_company(uuid) from public, anon;
grant execute on function public.user_can_access_company(uuid) to authenticated;
