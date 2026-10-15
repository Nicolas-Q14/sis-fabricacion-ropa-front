alter table public.user_roles
  drop constraint user_roles_company_scope;

alter table public.user_roles
  add constraint user_roles_company_scope check (
    (role = 'superadmin' and company_id is null)
    or role in ('admin', 'gerente_produccion')
  );

create unique index user_roles_production_global_unique
  on public.user_roles (user_id)
  where role = 'gerente_produccion' and company_id is null;
