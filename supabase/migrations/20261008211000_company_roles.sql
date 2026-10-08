create type public.app_role as enum (
  'superadmin',
  'admin',
  'gerente_produccion'
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  company_id uuid references public.companies(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint user_roles_company_scope check (
    (role = 'superadmin' and company_id is null)
    or (role in ('admin', 'gerente_produccion') and company_id is not null)
  )
);

create unique index user_roles_superadmin_unique
  on public.user_roles (user_id)
  where role = 'superadmin' and company_id is null;

create unique index user_roles_company_unique
  on public.user_roles (user_id, company_id)
  where company_id is not null;

create index user_roles_company_id_idx
  on public.user_roles (company_id);

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles as ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'superadmin'::public.app_role
      and ur.company_id is null
  );
$$;

create or replace function public.has_company_role(
  target_company_id uuid,
  allowed_roles public.app_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_superadmin()
    or exists (
      select 1
      from public.user_roles as ur
      where ur.user_id = (select auth.uid())
        and ur.company_id = target_company_id
        and ur.role = any(allowed_roles)
    );
$$;

revoke all on function public.is_superadmin() from public, anon;
revoke all on function public.has_company_role(uuid, public.app_role[]) from public, anon;
grant execute on function public.is_superadmin() to authenticated;
grant execute on function public.has_company_role(uuid, public.app_role[]) to authenticated;
grant usage on type public.app_role to authenticated;

alter table public.companies enable row level security;
alter table public.user_roles enable row level security;

grant select, insert, update, delete on public.companies to authenticated;
grant select, insert, update, delete on public.user_roles to authenticated;

create policy companies_select_for_members
  on public.companies
  for select
  to authenticated
  using (
    public.is_superadmin()
    or public.has_company_role(
      id,
      array['admin', 'gerente_produccion']::public.app_role[]
    )
  );

create policy companies_insert_for_superadmin
  on public.companies
  for insert
  to authenticated
  with check (public.is_superadmin());

create policy companies_update_for_admin
  on public.companies
  for update
  to authenticated
  using (
    public.has_company_role(id, array['admin']::public.app_role[])
  )
  with check (
    public.has_company_role(id, array['admin']::public.app_role[])
  );

create policy companies_delete_for_superadmin
  on public.companies
  for delete
  to authenticated
  using (public.is_superadmin());

create policy user_roles_select_for_user_admin_or_superadmin
  on public.user_roles
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_superadmin()
    or (
      company_id is not null
      and public.has_company_role(company_id, array['admin']::public.app_role[])
    )
  );

create policy user_roles_insert_for_superadmin
  on public.user_roles
  for insert
  to authenticated
  with check (public.is_superadmin());

create policy user_roles_update_for_superadmin
  on public.user_roles
  for update
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

create policy user_roles_delete_for_superadmin
  on public.user_roles
  for delete
  to authenticated
  using (public.is_superadmin());
