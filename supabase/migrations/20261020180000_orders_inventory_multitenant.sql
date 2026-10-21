-- Requiere las tablas public.companies, public.user_roles y la función
-- public.is_superadmin() de las migraciones de roles existentes.
-- Los miembros de una empresa son usuarios con una fila en user_roles.company_id.

create extension if not exists "uuid-ossp";

create table if not exists public.clients (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, name)
);

create table if not exists public.production_phases (
  id smallint primary key check (id between 0 and 8),
  name text not null unique,
  sort_order smallint not null unique
);

insert into public.production_phases (id, name, sort_order)
values
  (0, 'Sin iniciar', 0),
  (1, 'Diseño', 1),
  (2, 'Interpretación de Orden / Taller', 2),
  (3, 'Revisión de Papel', 3),
  (4, 'Corte Tela y Organizar Tela para Sublimar', 4),
  (5, 'Sublimación', 5),
  (6, 'Revisión de Piezas / Producto Terminado', 6),
  (7, 'Control de calidad', 7),
  (8, 'Entregado', 8)
on conflict (id) do update
set name = excluded.name, sort_order = excluded.sort_order;

create table if not exists public.orders (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete restrict,
  client_id uuid,
  code text not null,
  customer_name text not null check (length(trim(customer_name)) > 0),
  customer_phone text,
  customer_email text,
  seller_user_id uuid references auth.users(id) on delete set null,
  seller_name text,
  entry_date date not null default current_date,
  delivery_date date not null,
  status text not null default 'Diseño',
  payment_status text not null default 'Pendiente'
    check (payment_status in ('Pendiente', 'Abonado', 'Pagado')),
  summary text,
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  total_paid numeric(12, 2) not null default 0 check (total_paid >= 0),
  balance_due numeric(12, 2) generated always as (
    greatest(total_amount - total_paid, 0::numeric)
  ) stored,
  note text,
  deleted_at timestamptz,
  archived_at timestamptz,
  stock_deducted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, code),
  foreign key (company_id, client_id)
    references public.clients(company_id, id) on delete restrict,
  check (delivery_date >= entry_date)
);

create table if not exists public.inventory_warehouses (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, name)
);

create table if not exists public.inventory_products (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete restrict,
  sku text not null,
  name text not null check (length(trim(name)) > 0),
  description text,
  category text,
  gender text,
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  barcode text,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, sku),
  unique (company_id, name)
);

create table if not exists public.inventory_variants (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  product_id uuid not null,
  color text not null,
  size text not null,
  barcode text,
  min_stock integer not null default 0 check (min_stock >= 0),
  max_stock integer check (max_stock is null or max_stock >= min_stock),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, product_id, color, size),
  foreign key (company_id, product_id)
    references public.inventory_products(company_id, id) on delete restrict
);

create table if not exists public.inventory_stock (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  variant_id uuid not null,
  warehouse_id uuid not null,
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, variant_id, warehouse_id),
  foreign key (company_id, variant_id)
    references public.inventory_variants(company_id, id) on delete restrict,
  foreign key (company_id, warehouse_id)
    references public.inventory_warehouses(company_id, id) on delete restrict
);

create table if not exists public.order_items (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  order_id uuid not null,
  inventory_variant_id uuid,
  inventory_warehouse_id uuid,
  garment_type text not null,
  fit text not null,
  color text not null,
  size text not null,
  printed_name text,
  printed_number text,
  notes text,
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  price_manually_edited boolean not null default false,
  adjustments jsonb not null default '[]'::jsonb
    check (jsonb_typeof(adjustments) = 'array'),
  current_phase smallint not null default 0
    references public.production_phases(id),
  phase_operator_name text,
  current_phase_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, order_id, id),
  foreign key (company_id, order_id)
    references public.orders(company_id, id) on delete cascade,
  foreign key (company_id, inventory_variant_id)
    references public.inventory_variants(company_id, id) on delete restrict,
  foreign key (company_id, inventory_warehouse_id)
    references public.inventory_warehouses(company_id, id) on delete restrict,
  check (
    (inventory_variant_id is null and inventory_warehouse_id is null)
    or (inventory_variant_id is not null and inventory_warehouse_id is not null)
  )
);

create table if not exists public.production_events (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  order_id uuid not null,
  order_item_id uuid not null,
  previous_phase_id smallint not null references public.production_phases(id),
  phase_id smallint not null references public.production_phases(id),
  event_type text not null check (event_type in ('avance', 'retroceso')),
  user_id uuid references auth.users(id) on delete set null,
  operator_name text not null,
  observation text,
  created_at timestamptz not null default now(),
  foreign key (company_id, order_id)
    references public.orders(company_id, id) on delete cascade,
  foreign key (company_id, order_id, order_item_id)
    references public.order_items(company_id, order_id, id) on delete cascade
);

create table if not exists public.order_events (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  order_id uuid not null,
  event_type text not null,
  description text not null,
  user_id uuid references auth.users(id) on delete set null,
  operator_name text not null default coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
    auth.uid()::text,
    'Sistema'
  ),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (company_id, order_id)
    references public.orders(company_id, id) on delete cascade
);

alter table public.order_events
  add column if not exists operator_name text not null default coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
    auth.uid()::text,
    'Sistema'
  );

create table if not exists public.order_payments (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  order_id uuid not null,
  amount numeric(12, 2) not null check (amount > 0),
  payment_method text not null check (length(trim(payment_method)) > 0),
  reference text,
  notes text,
  created_at timestamptz not null default now(),
  created_by_user_id uuid default auth.uid()
    references auth.users(id) on delete set null,
  foreign key (company_id, order_id)
    references public.orders(company_id, id) on delete cascade
);

create table if not exists public.inventory_movements (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  variant_id uuid not null,
  warehouse_id uuid not null,
  order_id uuid,
  order_item_id uuid,
  movement_type text not null
    check (movement_type in ('entrada', 'salida', 'transferencia', 'ajuste')),
  quantity integer not null check (quantity <> 0),
  reference text,
  notes text,
  created_at timestamptz not null default now(),
  created_by_user_id uuid default auth.uid()
    references auth.users(id) on delete set null,
  foreign key (company_id, variant_id)
    references public.inventory_variants(company_id, id) on delete restrict,
  foreign key (company_id, warehouse_id)
    references public.inventory_warehouses(company_id, id) on delete restrict,
  foreign key (company_id, order_id)
    references public.orders(company_id, id) on delete restrict,
  foreign key (company_id, order_id, order_item_id)
    references public.order_items(company_id, order_id, id) on delete restrict,
  check (
    (order_id is null and order_item_id is null)
    or (order_id is not null and order_item_id is not null)
  ),
  check (
    (movement_type = 'salida' and quantity < 0)
    or (movement_type = 'entrada' and quantity > 0)
    or (movement_type = 'ajuste' and quantity <> 0)
    or movement_type = 'transferencia'
  )
);

alter table public.inventory_movements
  drop constraint if exists inventory_movements_check2;
alter table public.inventory_movements
  drop constraint if exists inventory_movements_quantity_sign_check;
alter table public.inventory_movements
  add constraint inventory_movements_quantity_sign_check
  check (
    (movement_type = 'salida' and quantity < 0)
    or (movement_type = 'entrada' and quantity > 0)
    or (movement_type = 'ajuste' and quantity <> 0)
    or movement_type = 'transferencia'
  );

create unique index if not exists inventory_movements_one_delivery_per_item
  on public.inventory_movements (company_id, order_item_id)
  where movement_type = 'salida' and order_item_id is not null;

create index if not exists clients_company_name_idx
  on public.clients (company_id, name);
create index if not exists orders_company_created_idx
  on public.orders (company_id, created_at desc);
create index if not exists orders_company_delivery_idx
  on public.orders (company_id, delivery_date);
create index if not exists orders_company_status_idx
  on public.orders (company_id, status);
create index if not exists orders_company_active_idx
  on public.orders (company_id, deleted_at, archived_at)
  where deleted_at is null and archived_at is null;
create index if not exists order_items_company_order_idx
  on public.order_items (company_id, order_id);
create index if not exists order_items_inventory_reservation_idx
  on public.order_items (company_id, inventory_variant_id, inventory_warehouse_id);
create index if not exists production_events_item_created_idx
  on public.production_events (company_id, order_item_id, created_at desc);
create index if not exists order_events_order_created_idx
  on public.order_events (company_id, order_id, created_at desc);
create index if not exists order_payments_order_created_idx
  on public.order_payments (company_id, order_id, created_at desc);
create index if not exists inventory_movements_variant_created_idx
  on public.inventory_movements (company_id, variant_id, created_at desc);

create or replace function public.user_can_access_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.is_superadmin()
    or exists (
      select 1
      from public.user_roles as ur
      where ur.user_id = (select auth.uid())
        and ur.company_id is null
        and ur.role in (
          'admin'::public.app_role,
          'gerente_produccion'::public.app_role
        )
    )
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

create or replace function public.refresh_order_payment_summary(
  target_company_id uuid,
  target_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_total numeric(12, 2);
  order_total numeric(12, 2);
begin
  select o.total_amount
  into order_total
  from public.orders as o
  where o.company_id = target_company_id
    and o.id = target_order_id
  for update;

  if not found then
    return;
  end if;

  select coalesce(sum(p.amount), 0)::numeric(12, 2)
  into payment_total
  from public.order_payments as p
  where p.company_id = target_company_id
    and p.order_id = target_order_id;

  if payment_total > order_total then
    raise exception 'Los abonos del pedido superan el total del pedido.'
      using errcode = '23514';
  end if;

  update public.orders
  set total_paid = payment_total,
      payment_status = case
        when payment_total = 0 then 'Pendiente'
        when payment_total >= order_total then 'Pagado'
        else 'Abonado'
      end,
      updated_at = now()
  where company_id = target_company_id
    and id = target_order_id;
end;
$$;

create or replace function public.record_order_payment_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.order_events (
    company_id,
    order_id,
    event_type,
    description,
    user_id,
    metadata
  )
  values (
    new.company_id,
    new.order_id,
    'payment_received',
    format('Abono de %s registrado por %s.', new.amount, new.payment_method),
    new.created_by_user_id,
    jsonb_build_object('amount', new.amount, 'payment_method', new.payment_method)
  );
  return new;
end;
$$;

create or replace function public.sync_order_payment_summary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_order_payment_summary(old.company_id, old.order_id);
    return old;
  elsif tg_op = 'UPDATE' then
    if old.company_id is distinct from new.company_id
      or old.order_id is distinct from new.order_id then
      perform public.refresh_order_payment_summary(old.company_id, old.order_id);
    end if;
    perform public.refresh_order_payment_summary(new.company_id, new.order_id);
    return new;
  else
    perform public.refresh_order_payment_summary(new.company_id, new.order_id);
    return new;
  end if;
end;
$$;

drop trigger if exists order_payments_sync_summary on public.order_payments;
create trigger order_payments_sync_summary
after insert or update or delete on public.order_payments
for each row execute function public.sync_order_payment_summary();

create or replace function public.sync_payment_summary_after_order_total_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.total_amount is distinct from old.total_amount then
    perform public.refresh_order_payment_summary(new.company_id, new.id);
  end if;
  return new;
end;
$$;

revoke all on function public.refresh_order_payment_summary(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.sync_order_payment_summary()
  from public, anon, authenticated;
revoke all on function public.sync_payment_summary_after_order_total_change()
  from public, anon, authenticated;

drop trigger if exists orders_sync_payment_summary on public.orders;
create trigger orders_sync_payment_summary
after update of total_amount on public.orders
for each row execute function public.sync_payment_summary_after_order_total_change();

create or replace function public.refresh_order_production_status(
  target_company_id uuid,
  target_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  average_phase numeric;
  item_count bigint;
  target_phase smallint;
  target_status text;
begin
  select count(*), avg(oi.current_phase)::numeric
  into item_count, average_phase
  from public.order_items as oi
  where oi.company_id = target_company_id
    and oi.order_id = target_order_id;

  target_phase := case
    when item_count = 0 then 1
    else greatest(1, least(8, floor(average_phase)::smallint))
  end;

  select pp.name
  into target_status
  from public.production_phases as pp
  where pp.id = target_phase;

  update public.orders
  set status = target_status,
      updated_at = now()
  where company_id = target_company_id
    and id = target_order_id;
end;
$$;

create or replace function public.sync_order_production_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_order_production_status(old.company_id, old.order_id);
    return old;
  elsif tg_op = 'UPDATE' then
    if old.company_id is distinct from new.company_id
      or old.order_id is distinct from new.order_id then
      perform public.refresh_order_production_status(old.company_id, old.order_id);
    end if;
    perform public.refresh_order_production_status(new.company_id, new.order_id);
    return new;
  else
    perform public.refresh_order_production_status(new.company_id, new.order_id);
    return new;
  end if;
end;
$$;

revoke all on function public.refresh_order_production_status(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.sync_order_production_status()
  from public, anon, authenticated;

drop trigger if exists order_items_sync_status_insert on public.order_items;
create trigger order_items_sync_status_insert
after insert on public.order_items
for each row execute function public.sync_order_production_status();

drop trigger if exists order_items_sync_status_update on public.order_items;
create trigger order_items_sync_status_update
after update of current_phase, order_id on public.order_items
for each row execute function public.sync_order_production_status();

drop trigger if exists order_items_sync_status_delete on public.order_items;
create trigger order_items_sync_status_delete
after delete on public.order_items
for each row execute function public.sync_order_production_status();

create or replace function public.record_production_phase_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reached_phase smallint;
begin
  if new.current_phase is distinct from old.current_phase then
    if new.current_phase > old.current_phase then
      for reached_phase in (old.current_phase + 1)..new.current_phase loop
        insert into public.production_events (
          company_id,
          order_id,
          order_item_id,
          previous_phase_id,
          phase_id,
          event_type,
          user_id,
          operator_name
        )
        values (
          new.company_id,
          new.order_id,
          new.id,
          reached_phase - 1,
          reached_phase,
          'avance',
          auth.uid(),
          coalesce(nullif(trim(new.phase_operator_name), ''), auth.uid()::text, 'Sistema')
        );
      end loop;
    else
      insert into public.production_events (
        company_id,
        order_id,
        order_item_id,
        previous_phase_id,
        phase_id,
        event_type,
        user_id,
        operator_name
      )
      values (
        new.company_id,
        new.order_id,
        new.id,
        old.current_phase,
        new.current_phase,
        'retroceso',
        auth.uid(),
        coalesce(nullif(trim(new.phase_operator_name), ''), auth.uid()::text, 'Sistema')
      );
    end if;
    new.current_phase_updated_at := now();
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.validate_order_item_initial_phase()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.current_phase <> 0 then
    raise exception 'Una prenda nueva debe comenzar en la fase Sin iniciar.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_order_item_initial_phase()
  from public, anon, authenticated;

drop trigger if exists order_items_validate_initial_phase on public.order_items;
create trigger order_items_validate_initial_phase
before insert on public.order_items
for each row execute function public.validate_order_item_initial_phase();

drop trigger if exists order_items_record_phase_event on public.order_items;
create trigger order_items_record_phase_event
before update of current_phase on public.order_items
for each row execute function public.record_production_phase_event();

create or replace function public.prevent_editing_fulfilled_order_items()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_company_id uuid;
  parent_order_id uuid;
  deducted_at timestamptz;
begin
  parent_company_id := old.company_id;
  parent_order_id := old.order_id;

  select o.stock_deducted_at
  into deducted_at
  from public.orders as o
  where o.company_id = parent_company_id
    and o.id = parent_order_id;

  if deducted_at is not null then
    raise exception 'No se pueden modificar prendas después de descontar el inventario.'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' and exists (
    select 1
    from public.production_events as pe
    where pe.company_id = old.company_id
      and pe.order_item_id = old.id
  ) then
    raise exception 'No se puede eliminar una prenda con historial de producción.'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_editing_fulfilled_order_items()
  from public, anon, authenticated;

drop trigger if exists order_items_prevent_fulfilled_edit on public.order_items;
create trigger order_items_prevent_fulfilled_edit
before update or delete on public.order_items
for each row execute function public.prevent_editing_fulfilled_order_items();

create or replace function public.complete_production_and_deduct_stock(
  p_order_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_company_id uuid;
  deducted_at timestamptz;
  demand record;
  item_record record;
  current_stock integer;
  reserved_for_other_orders bigint;
begin
  if p_user_id is null or p_user_id is distinct from auth.uid() then
    raise exception 'El usuario de la operación no coincide con la sesión autenticada.'
      using errcode = '42501';
  end if;

  select o.company_id, o.stock_deducted_at
  into order_company_id, deducted_at
  from public.orders as o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'No existe el pedido solicitado.' using errcode = 'P0002';
  end if;

  if not public.user_can_access_company(order_company_id) then
    raise exception 'No tienes acceso a la empresa de este pedido.' using errcode = '42501';
  end if;

  if deducted_at is not null then
    return;
  end if;

  if exists (
    select 1
    from public.orders as o
    where o.id = p_order_id
      and (o.deleted_at is not null or o.archived_at is not null)
  ) then
    raise exception 'No se puede completar un pedido eliminado o archivado.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.order_items as oi
    where oi.company_id = order_company_id
      and oi.order_id = p_order_id
  ) then
    raise exception 'No se puede entregar un pedido sin prendas.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.order_items as oi
    where oi.company_id = order_company_id
      and oi.order_id = p_order_id
      and oi.current_phase <> 8
  ) then
    raise exception 'Todas las prendas deben estar en la fase Entregado.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.order_items as oi
    where oi.company_id = order_company_id
      and oi.order_id = p_order_id
      and (oi.inventory_variant_id is null or oi.inventory_warehouse_id is null)
  ) then
    raise exception 'Asocia una variante y una bodega a cada prenda antes de entregar.'
      using errcode = '23514';
  end if;

  for demand in
    select oi.inventory_variant_id as variant_id,
      oi.inventory_warehouse_id as warehouse_id,
      count(*)::bigint as quantity
    from public.order_items as oi
    where oi.company_id = order_company_id
      and oi.order_id = p_order_id
    group by oi.inventory_variant_id, oi.inventory_warehouse_id
    order by oi.inventory_variant_id, oi.inventory_warehouse_id
  loop
    select s.quantity
    into current_stock
    from public.inventory_stock as s
    where s.company_id = order_company_id
      and s.variant_id = demand.variant_id
      and s.warehouse_id = demand.warehouse_id
    for update;

    if not found then
      raise exception 'No existe un registro de existencias para una variante del pedido.'
        using errcode = '23514';
    end if;

    select count(*)
    into reserved_for_other_orders
    from public.order_items as oi
    join public.orders as other_order
      on other_order.company_id = oi.company_id
      and other_order.id = oi.order_id
    where oi.company_id = order_company_id
      and oi.order_id <> p_order_id
      and oi.inventory_variant_id = demand.variant_id
      and oi.inventory_warehouse_id = demand.warehouse_id
      and other_order.deleted_at is null
      and other_order.archived_at is null
      and other_order.stock_deducted_at is null;

    if current_stock < demand.quantity + reserved_for_other_orders then
      raise exception 'Existencias insuficientes o reservadas para otros pedidos (variante %).',
        demand.variant_id
        using errcode = '23514';
    end if;

    update public.inventory_stock
    set quantity = quantity - demand.quantity::integer,
        updated_at = now()
    where company_id = order_company_id
      and variant_id = demand.variant_id
      and warehouse_id = demand.warehouse_id;
  end loop;

  for item_record in
    select oi.id, oi.inventory_variant_id, oi.inventory_warehouse_id
    from public.order_items as oi
    where oi.company_id = order_company_id
      and oi.order_id = p_order_id
    order by oi.id
  loop
    insert into public.inventory_movements (
      company_id,
      variant_id,
      warehouse_id,
      order_id,
      order_item_id,
      movement_type,
      quantity,
      reference,
      notes,
      created_by_user_id
    )
    values (
      order_company_id,
      item_record.inventory_variant_id,
      item_record.inventory_warehouse_id,
      p_order_id,
      item_record.id,
      'salida',
      -1,
      p_order_id::text,
      'Descuento automático al completar la fase Entregado.',
      p_user_id
    );
  end loop;

  update public.orders
  set stock_deducted_at = now(),
      updated_at = now()
  where company_id = order_company_id
    and id = p_order_id;
end;
$$;

revoke all on function public.complete_production_and_deduct_stock(uuid, uuid)
  from public, anon;
grant execute on function public.complete_production_and_deduct_stock(uuid, uuid)
  to authenticated;

create or replace function public.deduct_stock_when_order_is_delivered()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.current_phase = 8 and old.current_phase is distinct from new.current_phase
    and not exists (
      select 1
      from public.order_items as oi
      where oi.company_id = new.company_id
        and oi.order_id = new.order_id
        and oi.current_phase <> 8
    ) then
    perform public.complete_production_and_deduct_stock(new.order_id, auth.uid());
  end if;

  return new;
end;
$$;

revoke all on function public.record_production_phase_event()
  from public, anon, authenticated;
revoke all on function public.deduct_stock_when_order_is_delivered()
  from public, anon, authenticated;

drop trigger if exists order_items_deduct_stock_on_delivery on public.order_items;
create trigger order_items_deduct_stock_on_delivery
after update of current_phase on public.order_items
for each row execute function public.deduct_stock_when_order_is_delivered();

create or replace function public.record_order_event_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  elsif new.user_id is distinct from auth.uid() and not public.is_superadmin() then
    raise exception 'No puedes registrar un evento en nombre de otro usuario.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

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
  demand record;
  stock_quantity integer;
  reserved_quantity bigint;
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

  for demand in
    select oi.inventory_variant_id as variant_id,
      oi.inventory_warehouse_id as warehouse_id,
      count(*)::bigint as quantity
    from public.order_items as oi
    where oi.company_id = p_company_id
      and oi.order_id = created_order_id
    group by oi.inventory_variant_id, oi.inventory_warehouse_id
    order by oi.inventory_variant_id, oi.inventory_warehouse_id
  loop
    select s.quantity into stock_quantity
    from public.inventory_stock as s
    where s.company_id = p_company_id
      and s.variant_id = demand.variant_id
      and s.warehouse_id = demand.warehouse_id
    for update;
    if not found then
      raise exception 'La variante no tiene existencias registradas en la bodega seleccionada.'
        using errcode = '23514';
    end if;

    select count(*) into reserved_quantity
    from public.order_items as oi
    join public.orders as o
      on o.company_id = oi.company_id and o.id = oi.order_id
    where oi.company_id = p_company_id
      and oi.order_id <> created_order_id
      and oi.inventory_variant_id = demand.variant_id
      and oi.inventory_warehouse_id = demand.warehouse_id
      and o.deleted_at is null
      and o.archived_at is null
      and o.stock_deducted_at is null;

    if stock_quantity < demand.quantity + reserved_quantity then
      raise exception 'No hay existencias disponibles para reservar todas las prendas.'
        using errcode = '23514';
    end if;
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

create or replace function public.update_order_production_phase(
  p_order_id uuid,
  p_target_phase smallint,
  p_operator_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_company_id uuid;
begin
  if p_target_phase < 0 or p_target_phase > 8 then
    raise exception 'La fase indicada no es válida.' using errcode = '22023';
  end if;

  select o.company_id
  into order_company_id
  from public.orders as o
  where o.id = p_order_id
    and o.deleted_at is null
    and o.archived_at is null
  for update;

  if not found then
    raise exception 'No existe un pedido activo con ese identificador.'
      using errcode = 'P0002';
  end if;
  if not public.user_can_access_company(order_company_id) then
    raise exception 'No tienes acceso a la empresa de este pedido.'
      using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.order_items as oi
    where oi.company_id = order_company_id and oi.order_id = p_order_id
  ) then
    raise exception 'El pedido no tiene prendas para actualizar.'
      using errcode = '23514';
  end if;

  update public.order_items
  set current_phase = p_target_phase,
      phase_operator_name = nullif(trim(p_operator_name), '')
  where company_id = order_company_id
    and order_id = p_order_id
    and current_phase is distinct from p_target_phase;

  insert into public.order_events (company_id, order_id, event_type, description)
  values (
    order_company_id,
    p_order_id,
    'production_phase_change',
    format('Todas las prendas fueron movidas a %s.', (
      select pp.name from public.production_phases as pp where pp.id = p_target_phase
    ))
  );
end;
$$;

create or replace function public.update_order_item_phases(
  p_order_id uuid,
  p_item_ids uuid[],
  p_target_phase smallint,
  p_operator_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_company_id uuid;
  matched_items bigint;
begin
  if p_target_phase < 0 or p_target_phase > 8
    or coalesce(cardinality(p_item_ids), 0) = 0 then
    raise exception 'La fase o la selección de prendas no es válida.'
      using errcode = '22023';
  end if;

  select o.company_id into order_company_id
  from public.orders as o
  where o.id = p_order_id
    and o.deleted_at is null
    and o.archived_at is null
  for update;
  if not found then
    raise exception 'No existe un pedido activo con ese identificador.'
      using errcode = 'P0002';
  end if;
  if not public.user_can_access_company(order_company_id) then
    raise exception 'No tienes acceso a la empresa de este pedido.'
      using errcode = '42501';
  end if;

  select count(*) into matched_items
  from public.order_items as oi
  where oi.company_id = order_company_id
    and oi.order_id = p_order_id
    and oi.id = any(p_item_ids);
  if matched_items <> cardinality(p_item_ids) then
    raise exception 'Una o más prendas no pertenecen a este pedido.'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.order_items as oi
    where oi.company_id = order_company_id
      and oi.order_id = p_order_id
      and oi.id = any(p_item_ids)
      and p_target_phase > oi.current_phase + 1
  ) then
    raise exception 'Cada prenda debe completar las fases en orden, una a la vez.'
      using errcode = '23514';
  end if;

  update public.order_items
  set current_phase = p_target_phase,
      phase_operator_name = nullif(trim(p_operator_name), '')
  where company_id = order_company_id
    and order_id = p_order_id
    and id = any(p_item_ids)
    and current_phase is distinct from p_target_phase;

  insert into public.order_events (company_id, order_id, event_type, description)
  values (
    order_company_id,
    p_order_id,
    'production_phase_change',
    format('%s prendas fueron movidas a %s.', matched_items, (
      select pp.name from public.production_phases as pp where pp.id = p_target_phase
    ))
  );
end;
$$;

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
  product_id uuid;
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
    returning id into product_id;
  else
    update public.inventory_products
    set sku = p_sku,
        name = p_name,
        description = p_description,
        category = p_category,
        gender = p_gender,
        unit_price = p_unit_price,
        barcode = p_barcode,
        image_url = p_image_url,
        updated_at = now()
    where company_id = p_company_id
      and id = p_product_id
    returning id into product_id;
    if product_id is null then
      raise exception 'No se encontró el producto que se intenta editar.'
        using errcode = 'P0002';
    end if;
    update public.inventory_variants
    set min_stock = p_min_stock,
        max_stock = p_max_stock
    where company_id = p_company_id
      and product_id = p_product_id;
  end if;

  insert into public.inventory_warehouses (company_id, name)
  values (p_company_id, 'Bodega principal')
  on conflict (company_id, name) do nothing;
  select w.id into warehouse_id
  from public.inventory_warehouses as w
  where w.company_id = p_company_id and w.name = 'Bodega principal';

  for variant in select value from jsonb_array_elements(p_variants)
  loop
    inserted_variant_id := null;
    insert into public.inventory_variants (
      company_id, product_id, color, size, barcode, min_stock, max_stock
    )
    values (
      p_company_id,
      product_id,
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
      select v.id into variant_id
      from public.inventory_variants as v
      where v.company_id = p_company_id
        and v.product_id = product_id
        and v.color = variant ->> 'color'
        and v.size = variant ->> 'size';
      update public.inventory_variants
      set min_stock = p_min_stock,
          max_stock = p_max_stock
      where company_id = p_company_id and id = variant_id;
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

  return product_id;
end;
$$;

create or replace function public.apply_inventory_movement(
  p_company_id uuid,
  p_variant_id uuid,
  p_type text,
  p_quantity integer,
  p_warehouse_name text,
  p_destination_name text default null,
  p_reference text default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_warehouse_id uuid;
  destination_warehouse_id uuid;
  source_stock integer;
  reserved_stock bigint;
  movement_quantity integer;
begin
  if not public.user_can_access_company(p_company_id) then
    raise exception 'No tienes acceso a la empresa seleccionada.'
      using errcode = '42501';
  end if;
  if p_quantity = 0 or p_type not in ('entrada', 'salida', 'transferencia', 'ajuste') then
    raise exception 'El tipo o la cantidad del movimiento no son válidos.'
      using errcode = '22023';
  end if;

  select w.id into source_warehouse_id
  from public.inventory_warehouses as w
  where w.company_id = p_company_id and w.name = trim(p_warehouse_name);
  if source_warehouse_id is null then
    raise exception 'No existe la bodega de origen indicada.' using errcode = 'P0002';
  end if;

  if p_type = 'transferencia' then
    if p_quantity < 0 or nullif(trim(p_destination_name), '') is null
      or trim(p_destination_name) = trim(p_warehouse_name) then
      raise exception 'La transferencia requiere cantidad positiva y otra bodega.'
        using errcode = '22023';
    end if;
    insert into public.inventory_warehouses (company_id, name)
    values (p_company_id, trim(p_destination_name))
    on conflict (company_id, name) do nothing;
    select w.id into destination_warehouse_id
    from public.inventory_warehouses as w
    where w.company_id = p_company_id and w.name = trim(p_destination_name);
  elsif p_type <> 'ajuste' and p_quantity < 0 then
    raise exception 'La cantidad debe ser positiva para este movimiento.'
      using errcode = '22023';
  end if;

  insert into public.inventory_stock (company_id, variant_id, warehouse_id, quantity)
  values (p_company_id, p_variant_id, source_warehouse_id, 0)
  on conflict (company_id, variant_id, warehouse_id) do nothing;
  if destination_warehouse_id is not null then
    insert into public.inventory_stock (company_id, variant_id, warehouse_id, quantity)
    values (p_company_id, p_variant_id, destination_warehouse_id, 0)
    on conflict (company_id, variant_id, warehouse_id) do nothing;
  end if;

  perform s.id
  from public.inventory_stock as s
  where s.company_id = p_company_id
    and s.variant_id = p_variant_id
    and s.warehouse_id in (source_warehouse_id, destination_warehouse_id)
  order by s.warehouse_id
  for update;

  select s.quantity into source_stock
  from public.inventory_stock as s
  where s.company_id = p_company_id
    and s.variant_id = p_variant_id
    and s.warehouse_id = source_warehouse_id;

  select count(*) into reserved_stock
  from public.order_items as oi
  join public.orders as o
    on o.company_id = oi.company_id and o.id = oi.order_id
  where oi.company_id = p_company_id
    and oi.inventory_variant_id = p_variant_id
    and oi.inventory_warehouse_id = source_warehouse_id
    and o.deleted_at is null
    and o.archived_at is null
    and o.stock_deducted_at is null;

  if p_type = 'entrada' then
    movement_quantity := p_quantity;
    update public.inventory_stock
    set quantity = quantity + p_quantity, updated_at = now()
    where company_id = p_company_id and variant_id = p_variant_id
      and warehouse_id = source_warehouse_id;
  elsif p_type = 'transferencia' then
    if source_stock - reserved_stock < p_quantity then
      raise exception 'La transferencia supera las existencias disponibles no reservadas.'
        using errcode = '23514';
    end if;
    update public.inventory_stock
    set quantity = quantity - p_quantity, updated_at = now()
    where company_id = p_company_id and variant_id = p_variant_id
      and warehouse_id = source_warehouse_id;
    update public.inventory_stock
    set quantity = quantity + p_quantity, updated_at = now()
    where company_id = p_company_id and variant_id = p_variant_id
      and warehouse_id = destination_warehouse_id;
    insert into public.inventory_movements (
      company_id, variant_id, warehouse_id, movement_type, quantity,
      reference, notes, created_by_user_id
    )
    values
      (p_company_id, p_variant_id, source_warehouse_id, 'transferencia', -p_quantity,
        p_reference, concat_ws(' · ', nullif(p_notes, ''), 'Transferencia hacia ' || trim(p_destination_name)), (select auth.uid())),
      (p_company_id, p_variant_id, destination_warehouse_id, 'transferencia', p_quantity,
        p_reference, concat_ws(' · ', nullif(p_notes, ''), 'Transferencia desde ' || trim(p_warehouse_name)), (select auth.uid()));
    return;
  else
    movement_quantity := case when p_type = 'salida' then -abs(p_quantity) else p_quantity end;
    if source_stock + movement_quantity < reserved_stock or source_stock + movement_quantity < 0 then
      raise exception 'El movimiento excede el stock disponible o afecta reservas activas.'
        using errcode = '23514';
    end if;
    update public.inventory_stock
    set quantity = quantity + movement_quantity, updated_at = now()
    where company_id = p_company_id and variant_id = p_variant_id
      and warehouse_id = source_warehouse_id;
  end if;

  insert into public.inventory_movements (
    company_id, variant_id, warehouse_id, movement_type, quantity,
    reference, notes, created_by_user_id
  )
  values (
    p_company_id,
    p_variant_id,
    source_warehouse_id,
    p_type,
    movement_quantity,
    p_reference,
    p_notes,
    (select auth.uid())
  );
end;
$$;

revoke all on function public.create_order_with_items(uuid, jsonb, jsonb, jsonb)
  from public, anon;
grant execute on function public.create_order_with_items(uuid, jsonb, jsonb, jsonb)
  to authenticated;
revoke all on function public.update_order_production_phase(uuid, smallint, text)
  from public, anon;
grant execute on function public.update_order_production_phase(uuid, smallint, text)
  to authenticated;
revoke all on function public.update_order_item_phases(uuid, uuid[], smallint, text)
  from public, anon;
grant execute on function public.update_order_item_phases(uuid, uuid[], smallint, text)
  to authenticated;
revoke all on function public.save_inventory_product(
  uuid, uuid, text, text, text, text, text, numeric, text, text, jsonb, integer, integer, integer
) from public, anon;
grant execute on function public.save_inventory_product(
  uuid, uuid, text, text, text, text, text, numeric, text, text, jsonb, integer, integer, integer
) to authenticated;
revoke all on function public.apply_inventory_movement(
  uuid, uuid, text, integer, text, text, text, text
) from public, anon;
grant execute on function public.apply_inventory_movement(
  uuid, uuid, text, integer, text, text, text, text
) to authenticated;

revoke all on function public.record_order_event_user()
  from public, anon, authenticated;

drop trigger if exists order_events_set_user on public.order_events;
create trigger order_events_set_user
before insert on public.order_events
for each row execute function public.record_order_event_user();

revoke all on function public.record_order_payment_event()
  from public, anon, authenticated;
drop trigger if exists order_payments_record_event on public.order_payments;
create trigger order_payments_record_event
after insert on public.order_payments
for each row execute function public.record_order_payment_event();

alter table public.clients enable row level security;
alter table public.production_phases enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.production_events enable row level security;
alter table public.order_events enable row level security;
alter table public.order_payments enable row level security;
alter table public.inventory_warehouses enable row level security;
alter table public.inventory_products enable row level security;
alter table public.inventory_variants enable row level security;
alter table public.inventory_stock enable row level security;
alter table public.inventory_movements enable row level security;

revoke all on table
  public.clients,
  public.production_phases,
  public.orders,
  public.order_items,
  public.production_events,
  public.order_events,
  public.order_payments,
  public.inventory_warehouses,
  public.inventory_products,
  public.inventory_variants,
  public.inventory_stock,
  public.inventory_movements
from anon, authenticated;

drop policy if exists companies_select_for_members on public.companies;
create policy companies_select_for_orders_users on public.companies
for select to authenticated
using (public.user_can_access_company(id));

grant select on public.production_phases to authenticated;
grant select, insert, update, delete on public.clients to authenticated;
grant select on public.orders to authenticated;
grant update (deleted_at, archived_at) on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant select on public.production_events to authenticated;
grant select on public.order_events to authenticated;
grant insert (company_id, order_id, event_type, description, metadata)
  on public.order_events to authenticated;
grant select on public.order_payments to authenticated;
grant insert (company_id, order_id, amount, payment_method, reference, notes)
  on public.order_payments to authenticated;
grant select on public.inventory_warehouses to authenticated;
grant select on public.inventory_products to authenticated;
grant select on public.inventory_variants to authenticated;
grant select on public.inventory_stock to authenticated;
grant select on public.inventory_movements to authenticated;

drop policy if exists clients_company_access on public.clients;
create policy clients_company_access on public.clients
for all to authenticated
using (public.user_can_access_company(company_id))
with check (public.user_can_access_company(company_id));

drop policy if exists production_phases_authenticated_read on public.production_phases;
create policy production_phases_authenticated_read on public.production_phases
for select to authenticated using (true);

drop policy if exists orders_company_access on public.orders;
create policy orders_company_access on public.orders
for all to authenticated
using (public.user_can_access_company(company_id))
with check (public.user_can_access_company(company_id));

drop policy if exists order_items_company_access on public.order_items;
create policy order_items_company_access on public.order_items
for all to authenticated
using (public.user_can_access_company(company_id))
with check (public.user_can_access_company(company_id));

drop policy if exists production_events_company_read on public.production_events;
create policy production_events_company_read on public.production_events
for select to authenticated
using (public.user_can_access_company(company_id));

drop policy if exists order_events_company_read on public.order_events;
create policy order_events_company_read on public.order_events
for select to authenticated
using (public.user_can_access_company(company_id));

drop policy if exists order_events_company_insert on public.order_events;
create policy order_events_company_insert on public.order_events
for insert to authenticated
with check (
  public.user_can_access_company(company_id)
  and (user_id is null or user_id = (select auth.uid()))
);

drop policy if exists order_payments_company_access on public.order_payments;
create policy order_payments_company_access on public.order_payments
for all to authenticated
using (public.user_can_access_company(company_id))
with check (
  public.user_can_access_company(company_id)
  and (created_by_user_id is null or created_by_user_id = (select auth.uid()))
);

drop policy if exists inventory_warehouses_company_access on public.inventory_warehouses;
create policy inventory_warehouses_company_access on public.inventory_warehouses
for all to authenticated
using (public.user_can_access_company(company_id))
with check (public.user_can_access_company(company_id));

drop policy if exists inventory_products_company_access on public.inventory_products;
create policy inventory_products_company_access on public.inventory_products
for all to authenticated
using (public.user_can_access_company(company_id))
with check (public.user_can_access_company(company_id));

drop policy if exists inventory_variants_company_access on public.inventory_variants;
create policy inventory_variants_company_access on public.inventory_variants
for all to authenticated
using (public.user_can_access_company(company_id))
with check (public.user_can_access_company(company_id));

drop policy if exists inventory_stock_company_access on public.inventory_stock;
create policy inventory_stock_company_access on public.inventory_stock
for all to authenticated
using (public.user_can_access_company(company_id))
with check (public.user_can_access_company(company_id));

drop policy if exists inventory_movements_company_read on public.inventory_movements;
create policy inventory_movements_company_read on public.inventory_movements
for select to authenticated
using (public.user_can_access_company(company_id));

do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array[
      'orders',
      'order_items',
      'order_payments',
      'order_events',
      'production_events',
      'inventory_products',
      'inventory_variants',
      'inventory_stock',
      'inventory_movements',
      'inventory_warehouses'
    ]
    loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end;
$$;

-- Mapeo TypeScript sugerido para @supabase/supabase-js:
-- type Order = {
--   id: string; company_id: string; client_id: string | null; code: string;
--   customer_name: string; customer_phone: string | null; customer_email: string | null;
--   seller_user_id: string | null; seller_name: string | null;
--   entry_date: string; delivery_date: string; status: string;
--   payment_status: "Pendiente" | "Abonado" | "Pagado";
--   summary: string | null; total_amount: number; total_paid: number;
--   balance_due: number; note: string | null; deleted_at: string | null;
--   archived_at: string | null; created_at: string; updated_at: string;
-- };
-- type OrderItem = {
--   id: string; company_id: string; order_id: string; inventory_variant_id: string | null;
--   inventory_warehouse_id: string | null; garment_type: string; fit: string;
--   color: string; size: string; printed_name: string | null; printed_number: string | null;
--   notes: string | null; unit_price: number;
--   price_manually_edited: boolean; adjustments: Adjustment[];
--   current_phase: number; current_phase_updated_at: string;
-- };
-- type Adjustment = {
--   type: "surcharge" | "discount"; mode: "fixed" | "percent";
--   value: number; note: string; enabled: boolean;
-- };
-- type OrderPayment = {
--   id: string; order_id: string; amount: number; payment_method: string;
--   reference: string | null; notes: string | null; created_at: string;
--   created_by_user_id: string | null;
-- };
-- Para entregar, actualiza current_phase a 8 y phase_operator_name. El trigger registra
-- el evento; al llegar todas las prendas a 8, el mismo commit descuenta stock una sola vez.
-- Asegura primero que cada order_item tenga inventory_variant_id y inventory_warehouse_id.
  