create or replace function public.enforce_order_seller_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_seller_name text;
begin
  if tg_op = 'UPDATE'
    and new.seller_user_id is not distinct from old.seller_user_id
    and new.seller_name is not distinct from old.seller_name then
    return new;
  end if;

  if public.has_company_role(
    new.company_id,
    array['admin']::public.app_role[]
  ) then
    return new;
  end if;

  select coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(u.email), ''),
    'Usuario'
  )
  into current_seller_name
  from auth.users as u
  where u.id = (select auth.uid());

  new.seller_user_id := (select auth.uid());
  new.seller_name := coalesce(current_seller_name, 'Usuario');
  return new;
end;
$$;

create trigger orders_enforce_seller_assignment
  before insert or update on public.orders
  for each row
  execute function public.enforce_order_seller_assignment();
