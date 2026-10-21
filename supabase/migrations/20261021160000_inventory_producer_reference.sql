create or replace function public.set_inventory_producer_reference()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.reference := 'Frenesi sport';
  return new;
end;
$$;

revoke all on function public.set_inventory_producer_reference()
  from public, anon, authenticated;

drop trigger if exists inventory_movements_set_producer_reference
  on public.inventory_movements;
create trigger inventory_movements_set_producer_reference
before insert or update of reference on public.inventory_movements
for each row execute function public.set_inventory_producer_reference();

update public.inventory_movements
set reference = 'Frenesi sport'
where company_id = '00000000-0000-0000-0000-000000000001'::uuid
  and reference is distinct from 'Frenesi sport';
