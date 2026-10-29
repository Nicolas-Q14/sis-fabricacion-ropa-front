create or replace function public.prevent_deleting_converted_quotation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_order_deleted boolean := false;
begin
  if old.converted_order_id is not null then
    select o.deleted_at is not null
    into linked_order_deleted
    from public.orders as o
    where o.id = old.converted_order_id;
  end if;

  if tg_op = 'UPDATE' then
    if old.deleted_at is not null
      and new.converted_order_id is distinct from old.converted_order_id
      and new.converted_order_id is not null then
      raise exception 'No se puede convertir una cotización que está en la papelera.'
        using errcode = '23514';
    end if;

    if old.deleted_at is null
      and new.deleted_at is not null
      and old.converted_order_id is not null
      and not coalesce(linked_order_deleted, false) then
      raise exception 'No se puede enviar a la papelera una cotización vinculada a un pedido activo.'
        using errcode = '23514';
    end if;

    if old.deleted_at is not null
      and new.deleted_at is null
      and coalesce(linked_order_deleted, false) then
      raise exception 'Restaura primero el pedido antes de restaurar su cotización.'
        using errcode = '23514';
    end if;

    return new;
  end if;

  if tg_op = 'DELETE'
    and old.converted_order_id is not null
    and not coalesce(linked_order_deleted, false) then
    raise exception 'No se puede eliminar una cotización vinculada a un pedido activo.'
      using errcode = '23514';
  end if;

  return old;
end;
$$;
