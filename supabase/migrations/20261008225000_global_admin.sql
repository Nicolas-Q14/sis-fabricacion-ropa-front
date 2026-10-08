alter table public.user_roles
  drop constraint user_roles_company_scope;

alter table public.user_roles
  add constraint user_roles_company_scope check (
    (role in ('superadmin', 'admin') and company_id is null)
    or (role in ('admin', 'gerente_produccion') and company_id is not null)
  );

create unique index user_roles_admin_global_unique
  on public.user_roles (user_id)
  where role = 'admin' and company_id is null;

create or replace function public.is_global_admin()
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
      and ur.role = 'admin'::public.app_role
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
        and (
          (
            ur.company_id = target_company_id
            and ur.role = any(allowed_roles)
          )
          or (
            ur.role = 'admin'::public.app_role
            and ur.company_id is null
            and 'admin'::public.app_role = any(allowed_roles)
          )
        )
    );
$$;

revoke all on function public.is_global_admin() from public, anon;
grant execute on function public.is_global_admin() to authenticated;

drop policy companies_insert_for_superadmin on public.companies;
create policy companies_insert_for_superadmin_or_global_admin
  on public.companies
  for insert
  to authenticated
  with check (public.is_superadmin() or public.is_global_admin());

drop policy companies_delete_for_superadmin on public.companies;
create policy companies_delete_for_superadmin_or_global_admin
  on public.companies
  for delete
  to authenticated
  using (public.is_superadmin() or public.is_global_admin());
