import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const updateUserSchema = z.object({
  branch: z.string().trim().min(1).max(100),
  isActive: z.boolean(),
})

type UpdateUserRouteProps = {
  params: Promise<{ userId: string }>
}

export async function PATCH(request: Request, { params }: UpdateUserRouteProps) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }

  if (user.app_metadata?.must_change_password === true) {
    return NextResponse.json(
      { error: 'Debes cambiar tu contraseña antes de continuar.' },
      { status: 403 },
    )
  }

  const { data: superadmin, error: roleError } = await supabase
    .from('user_roles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role', 'superadmin')
    .is('company_id', null)
    .maybeSingle()

  if (roleError) {
    console.error('No fue posible verificar el rol del usuario solicitante.', roleError)
    return NextResponse.json({ error: 'No se pudieron verificar tus permisos.' }, { status: 500 })
  }

  if (!superadmin) {
    return NextResponse.json({ error: 'No tienes permiso para modificar usuarios.' }, { status: 403 })
  }

  const { userId } = await params
  const parsedUserId = z.uuid().safeParse(userId)
  if (!parsedUserId.success) {
    return NextResponse.json({ error: 'El identificador del usuario no es válido.' }, { status: 400 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'La solicitud no contiene JSON válido.' }, { status: 400 })
  }

  const parsed = updateUserSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'La sede debe tener entre 1 y 100 caracteres y el estado debe ser válido.' },
      { status: 400 },
    )
  }

  const admin = createAdminClient()
  const { data: targetRole, error: targetRoleError } = await admin
    .from('user_roles')
    .select('id')
    .eq('user_id', parsedUserId.data)
    .in('role', ['admin', 'gerente_produccion'])
    .is('company_id', null)
    .maybeSingle()

  if (targetRoleError) {
    console.error('No se pudo verificar el perfil del usuario que se quiere modificar.', targetRoleError)
    return NextResponse.json({ error: 'No se pudo verificar el perfil del usuario.' }, { status: 500 })
  }

  if (!targetRole) {
    return NextResponse.json({ error: 'No se encontró un empleado modificable.' }, { status: 404 })
  }

  const { data: targetUser, error: targetUserError } = await admin.auth.admin.getUserById(parsedUserId.data)
  if (targetUserError || !targetUser.user) {
    console.error('No se pudo cargar la cuenta del usuario seleccionado.', targetUserError)
    return NextResponse.json({ error: 'No se pudo cargar la cuenta del usuario.' }, { status: 500 })
  }

  const previousActive = targetUser.user.app_metadata?.is_active !== false
  const { error: authUpdateError } = await admin.auth.admin.updateUserById(parsedUserId.data, {
    app_metadata: {
      ...targetUser.user.app_metadata,
      is_active: parsed.data.isActive,
    },
    ban_duration: parsed.data.isActive ? 'none' : '876000h',
  })

  if (authUpdateError) {
    console.error('No se pudo actualizar el estado de la cuenta del usuario.', authUpdateError)
    return NextResponse.json({ error: 'No se pudo actualizar el estado del usuario.' }, { status: 500 })
  }

  const { error: profileUpdateError } = await admin
    .from('user_profiles')
    .upsert({
      user_id: parsedUserId.data,
      branch: parsed.data.branch,
      updated_at: new Date().toISOString(),
    })

  if (profileUpdateError) {
    const { error: rollbackError } = await admin.auth.admin.updateUserById(parsedUserId.data, {
      app_metadata: {
        ...targetUser.user.app_metadata,
        is_active: previousActive,
      },
      ban_duration: previousActive ? 'none' : '876000h',
    })
    if (rollbackError) {
      console.error('No se pudo revertir el estado tras fallar la actualización de sede.', {
        profileUpdateError,
        rollbackError,
      })
    } else {
      console.error('No se pudo actualizar la sede del usuario.', profileUpdateError)
    }

    return NextResponse.json({ error: 'No se pudo guardar la sede del usuario.' }, { status: 500 })
  }

  return NextResponse.json({
    user: {
      id: parsedUserId.data,
      branch: parsed.data.branch,
      isActive: parsed.data.isActive,
    },
  })
}

export async function DELETE(_request: Request, { params }: UpdateUserRouteProps) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }

  if (user.app_metadata?.must_change_password === true) {
    return NextResponse.json(
      { error: 'Debes cambiar tu contraseña antes de continuar.' },
      { status: 403 },
    )
  }

  const { data: superadmin, error: roleError } = await supabase
    .from('user_roles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role', 'superadmin')
    .is('company_id', null)
    .maybeSingle()

  if (roleError) {
    console.error('No fue posible verificar el rol del usuario solicitante.', roleError)
    return NextResponse.json({ error: 'No se pudieron verificar tus permisos.' }, { status: 500 })
  }

  if (!superadmin) {
    return NextResponse.json({ error: 'No tienes permiso para eliminar usuarios.' }, { status: 403 })
  }

  const { userId } = await params
  const parsedUserId = z.uuid().safeParse(userId)
  if (!parsedUserId.success) {
    return NextResponse.json({ error: 'El identificador del usuario no es válido.' }, { status: 400 })
  }

  if (parsedUserId.data === user.id) {
    return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: targetRoles, error: targetRolesError } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', parsedUserId.data)

  if (targetRolesError) {
    console.error('No se pudieron verificar los perfiles del usuario que se quiere eliminar.', targetRolesError)
    return NextResponse.json({ error: 'No se pudieron verificar los perfiles del usuario.' }, { status: 500 })
  }

  if (targetRoles?.some((targetRole) => targetRole.role === 'superadmin')) {
    return NextResponse.json({ error: 'No se puede eliminar una cuenta de superadmin.' }, { status: 403 })
  }

  if (!targetRoles?.some((targetRole) =>
    targetRole.role === 'admin' || targetRole.role === 'gerente_produccion',
  )) {
    return NextResponse.json({ error: 'No se encontró un perfil de empleado para eliminar.' }, { status: 404 })
  }

  const { data: targetUser, error: targetUserError } = await admin.auth.admin.getUserById(parsedUserId.data)
  if (targetUserError || !targetUser.user) {
    console.error('No se pudo cargar la cuenta del usuario que se quiere eliminar.', targetUserError)
    return NextResponse.json({ error: 'No se encontró la cuenta del usuario.' }, { status: 404 })
  }

  if (targetUser.user.app_metadata?.is_active !== false) {
    return NextResponse.json(
      { error: 'Desactiva el usuario antes de eliminarlo.' },
      { status: 409 },
    )
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(parsedUserId.data)
  if (deleteError) {
    console.error('No se pudo eliminar la cuenta del usuario.', deleteError)
    return NextResponse.json({ error: 'No se pudo eliminar la cuenta del usuario.' }, { status: 500 })
  }

  return NextResponse.json({ userId: parsedUserId.data })
}
