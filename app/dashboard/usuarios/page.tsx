import { redirect } from 'next/navigation'

import { UserManagementClient, type ManagedUser } from '@/components/user-management-client'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export default async function UserManagementPage() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  if (user.app_metadata?.must_change_password === true) {
    redirect('/dashboard/change-password')
  }

  const { data: superadmin, error: roleError } = await supabase
    .from('user_roles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role', 'superadmin')
    .is('company_id', null)
    .maybeSingle()

  if (roleError) {
    throw new Error('No se pudieron verificar los permisos para gestionar usuarios.')
  }

  if (!superadmin) {
    redirect('/dashboard')
  }

  const admin = createAdminClient()
  const { data: roleRows, error: rolesError } = await admin
    .from('user_roles')
    .select('user_id, role, company_id')
    .neq('role', 'superadmin')
    .order('created_at', { ascending: false })

  if (rolesError) {
    throw new Error('No se pudieron cargar los roles de usuarios.')
  }

  const { data: profileRows, error: profilesError } = await admin
    .from('user_profiles')
    .select('user_id, branch')

  if (profilesError) {
    throw new Error('No se pudieron cargar las sedes de los usuarios. Aplica la migración de perfiles.')
  }

  const authUsers = []
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 })
    if (error) {
      throw new Error('No se pudieron cargar las cuentas de usuario.')
    }

    authUsers.push(...data.users)
    if (data.users.length < 100) break
  }
  const usersById = new Map(authUsers.map((authUser) => [authUser.id, authUser]))
  const branchesByUserId = new Map(
    (profileRows ?? []).map((profile) => [profile.user_id, profile.branch]),
  )
  const users: ManagedUser[] = (roleRows ?? []).flatMap((row) => {
    const authUser = usersById.get(row.user_id)
    if (!authUser || (row.role !== 'admin' && row.role !== 'gerente_produccion')) {
      return []
    }

    return [{
      id: authUser.id,
      email: authUser.email ?? '',
      fullName: typeof authUser.user_metadata?.full_name === 'string'
        ? authUser.user_metadata.full_name
        : '',
      role: row.role,
      branch: branchesByUserId.get(authUser.id) ?? 'Sede única',
      mustChangePassword: authUser.app_metadata?.must_change_password === true,
      isActive: authUser.app_metadata?.is_active !== false,
    }]
  })

  const fullName = typeof user.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name
    : typeof user.user_metadata?.name === 'string'
      ? user.user_metadata.name
      : ''

  return (
    <UserManagementClient
      avatarUrl={typeof user.user_metadata?.avatar_url === 'string'
        ? user.user_metadata.avatar_url
        : null}
      email={user.email ?? ''}
      fullName={fullName}
      users={users}
    />
  )
}
