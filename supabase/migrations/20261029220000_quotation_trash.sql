alter table public.quotations
  add column deleted_at timestamptz;

create index quotations_company_trash_created_idx
  on public.quotations (company_id, deleted_at, created_at desc);

create or replace function public.prevent_deleting_converted_quotation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and old.converted_order_id is not null then
    raise exception 'No se puede eliminar una cotización convertida en pedido.'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if old.deleted_at is not null
      and new.converted_order_id is distinct from old.converted_order_id then
      raise exception 'No se puede convertir una cotización que está en la papelera.'
        using errcode = '23514';
    end if;
    if new.deleted_at is not null and new.converted_order_id is not null then
      raise exception 'No se puede enviar a la papelera una cotización convertida en pedido.'
        using errcode = '23514';
    end if;
    return new;
  end if;
  return old;
end;
$$;

create trigger quotations_preserve_converted_orders
  before update of deleted_at, converted_order_id or delete on public.quotations
  for each row
  execute function public.prevent_deleting_converted_quotation();
