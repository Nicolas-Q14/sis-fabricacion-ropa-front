import { redirect } from 'next/navigation';
import RoleAccessNotice from './RoleAccessNotice';
import { DashboardClient } from '../../components/dashboard-client';
import { isAppRole, type AppRole } from '../../lib/auth/roles';
import { SINGLE_COMPANY_ID } from '../../lib/supabase/single-company';
import { createClient } from '../../lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/login');
  }

  if (user.app_metadata?.is_active === false) {
    redirect('/account-disabled');
  }

  if (user.app_metadata?.must_change_password === true) {
    redirect('/dashboard/change-password');
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

  if (roles.length === 0) {
    return (
      <RoleAccessNotice message="Tu usuario todavía no tiene un rol asignado. Solicita acceso al superadmin." />
    );
  }

  const activeRole: AppRole | null = roles.some((row) => row.role === 'superadmin')
    ? 'superadmin'
    : roles.some((row) => row.role === 'admin')
      ? 'admin'
      : roles.some((row) => row.role === 'gerente_produccion')
        ? 'gerente_produccion'
        : null;

  if (!activeRole || !isAppRole(activeRole)) {
    return (
      <RoleAccessNotice message="No tienes un rol habilitado para el sistema. Solicita acceso al superadmin." />
    );
  }

  const fullName = typeof user.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name
    : typeof user.user_metadata?.name === 'string'
      ? user.user_metadata.name
      : '';

  return (
    <DashboardClient
      companies={[]}
      companyId={SINGLE_COMPANY_ID}
      companyName="Sede única"
      email={user.email ?? ''}
      fullName={fullName}
      avatarUrl={typeof user.user_metadata?.avatar_url === 'string'
        ? user.user_metadata.avatar_url
        : null}
      operatorId={user.id}
      role={activeRole}
    />
  );
}
