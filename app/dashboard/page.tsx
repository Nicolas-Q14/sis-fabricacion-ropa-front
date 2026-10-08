import { redirect } from 'next/navigation';
import RoleAccessNotice from './RoleAccessNotice';
import { DashboardClient } from '../../components/dashboard-client';
import { isAppRole, type AppRole } from '../../lib/auth/roles';
import { createClient } from '../../lib/supabase/server';

type DashboardPageProps = {
  searchParams: Promise<{ companyId?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/login');
  }

  const { data: roleRows, error: rolesError } = await supabase
    .from('user_roles')
    .select('role, company_id')
    .eq('user_id', user.id);

  if (rolesError) {
    return (
      <RoleAccessNotice message="No se pudieron consultar tus permisos. Verifica que las migraciones de roles estén aplicadas y vuelve a intentarlo." />
    );
  }

  const roles = (roleRows ?? []).filter(
    (row): row is typeof row & { role: AppRole } => isAppRole(row.role),
  );
  const isSuperadmin = roles.some((row) => row.role === 'superadmin');
  const isGlobalAdmin = roles.some(
    (row) => row.role === 'admin' && row.company_id === null,
  );

  if (roles.length === 0) {
    return (
      <RoleAccessNotice message="Tu usuario todavía no tiene un rol asignado. Solicita al superadmin que te asigne acceso a una empresa." />
    );
  }

  const companyIds = [...new Set(
    roles
      .map((row) => row.company_id)
      .filter((companyId): companyId is string => Boolean(companyId)),
  )];
  const companiesQuery = supabase
    .from('companies')
    .select('id, name')
    .order('name');

  const { data: companyRows, error: companiesError } = isSuperadmin || isGlobalAdmin
    ? await companiesQuery
    : companyIds.length > 0
      ? await companiesQuery.in('id', companyIds)
      : { data: [], error: null };

  if (companiesError) {
    return (
      <RoleAccessNotice message="No se pudieron cargar las empresas disponibles. Verifica los permisos RLS de Supabase." />
    );
  }

  const companies = companyRows ?? [];
  const { companyId: requestedCompanyId } = await searchParams;
  const activeCompany = companies.find((company) => company.id === requestedCompanyId)
    ?? companies[0]
    ?? null;
  const activeRole = isSuperadmin
    ? 'superadmin'
    : isGlobalAdmin
      ? 'admin'
      : roles.find((row) => row.company_id === activeCompany?.id)?.role;

  if (!activeRole || !isAppRole(activeRole)) {
    return (
      <RoleAccessNotice message="No tienes un rol asignado para la empresa seleccionada. Elige otra empresa o solicita acceso al superadmin." />
    );
  }

  const fullName = typeof user.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name
    : typeof user.user_metadata?.name === 'string'
      ? user.user_metadata.name
      : '';

  return (
    <DashboardClient
      companies={companies}
      companyId={activeCompany?.id ?? null}
      companyName={activeCompany?.name ?? null}
      email={user.email ?? ''}
      fullName={fullName}
      role={activeRole}
    />
  );
}
