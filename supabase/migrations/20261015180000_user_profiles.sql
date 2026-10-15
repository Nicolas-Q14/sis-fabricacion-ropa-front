create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  branch text not null default 'Sede única'
    check (length(trim(branch)) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.user_profiles (user_id)
select distinct user_id
from public.user_roles
on conflict (user_id) do nothing;

alter table public.user_profiles enable row level security;

grant select on public.user_profiles to authenticated;
grant update on public.user_profiles to authenticated;

create policy user_profiles_select_for_user_or_superadmin
  on public.user_profiles
  for select
  to authenticated
  using (user_id = (select auth.uid()) or public.is_superadmin());

create policy user_profiles_update_for_superadmin
  on public.user_profiles
  for update
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());
