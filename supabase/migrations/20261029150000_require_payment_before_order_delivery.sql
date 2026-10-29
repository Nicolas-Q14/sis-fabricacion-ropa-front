create or replace function public.require_order_payment_before_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_total numeric(12, 2);
  order_paid numeric(12, 2);
begin
  if new.current_phase = 8 and old.current_phase is distinct from 8 then
    select o.total_amount, o.total_paid
    into order_total, order_paid
    from public.orders as o
    where o.company_id = new.company_id
      and o.id = new.order_id
    for update;

    if not found then
      raise exception 'No se encontró el pedido asociado a la prenda.'
        using errcode = 'P0002';
    end if;

    if order_paid < order_total then
      raise exception 'No se puede entregar el pedido: primero debe completarse el pago total.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.require_order_payment_before_delivery()
  from public, anon, authenticated;

drop trigger if exists order_items_require_full_payment_before_delivery
  on public.order_items;
create trigger order_items_require_full_payment_before_delivery
before update of current_phase on public.order_items
for each row execute function public.require_order_payment_before_delivery();

create or replace function public.complete_order_delivery_with_payment(
  p_order_id uuid,
  p_item_ids uuid[] default null,
  p_operator_name text default null,
  p_payment_method text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_company_id uuid;
  order_total numeric(12, 2);
  order_paid numeric(12, 2);
  matched_items bigint;
begin
  select o.company_id, o.total_amount, o.total_paid
  into order_company_id, order_total, order_paid
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
  if order_paid > order_total then
    raise exception 'Los abonos del pedido superan el total del pedido.'
      using errcode = '23514';
  end if;

  if p_item_ids is null then
    select count(*) into matched_items
    from public.order_items as oi
    where oi.company_id = order_company_id
      and oi.order_id = p_order_id;
  else
    if coalesce(cardinality(p_item_ids), 0) = 0 then
      raise exception 'La selección de prendas no es válida.'
        using errcode = '22023';
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
        and 8 > oi.current_phase + 1
    ) then
      raise exception 'Cada prenda debe completar las fases en orden, una a la vez.'
        using errcode = '23514';
    end if;
  end if;

  if matched_items = 0 then
    raise exception 'El pedido no tiene prendas para entregar.'
      using errcode = '23514';
  end if;

  if order_paid < order_total then
    if coalesce(length(trim(p_payment_method)), 0) = 0 then
      raise exception 'Indica el método de pago para completar el saldo pendiente.'
        using errcode = '22023';
    end if;

    insert into public.order_payments (
      company_id,
      order_id,
      amount,
      payment_method,
      notes
    )
    values (
      order_company_id,
      p_order_id,
      order_total - order_paid,
      trim(p_payment_method),
      'Pago total requerido para entregar el pedido.'
    );
  end if;

  if p_item_ids is null then
    update public.order_items
    set current_phase = 8,
        phase_operator_name = nullif(trim(p_operator_name), '')
    where company_id = order_company_id
      and order_id = p_order_id
      and current_phase is distinct from 8;
  else
    update public.order_items
    set current_phase = 8,
        phase_operator_name = nullif(trim(p_operator_name), '')
    where company_id = order_company_id
      and order_id = p_order_id
      and id = any(p_item_ids)
      and current_phase is distinct from 8;
  end if;

  insert into public.order_events (company_id, order_id, event_type, description)
  values (
    order_company_id,
    p_order_id,
    'production_phase_change',
    format('%s prendas fueron movidas a Entregado.', matched_items)
  );
end;
$$;

revoke all on function public.complete_order_delivery_with_payment(
  uuid, uuid[], text, text
) from public, anon;
grant execute on function public.complete_order_delivery_with_payment(
  uuid, uuid[], text, text
) to authenticated;
