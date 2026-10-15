import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const createUserSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  role: z.enum(['admin', 'gerente_produccion']),
  branch: z.string().trim().min(1).max(100),
})

export async function POST(request: Request) {
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
    return NextResponse.json({ error: 'No tienes permiso para crear usuarios.' }, { status: 403 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'La solicitud no contiene JSON válido.' }, { status: 400 })
  }

  const parsed = createUserSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Revisa el nombre, el correo y el perfil seleccionado.' },
      { status: 400 },
    )
  }

  const fullName = parsed.data.fullName
  const email = parsed.data.email.toLowerCase()
  const role = parsed.data.role
  const branch = parsed.data.branch
  const admin = createAdminClient()

  const temporaryPassword = randomBytes(24).toString('base64url')
  const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { must_change_password: true, is_active: true },
  })

  if (createError || !createdUser.user) {
    if (createError?.message.toLowerCase().includes('already')) {
      return NextResponse.json(
        { error: 'Ya existe una cuenta con ese correo electrónico.' },
        { status: 409 },
      )
    }

    console.error('No fue posible crear la cuenta en Supabase Auth.', createError)
    return NextResponse.json({ error: 'No se pudo crear la cuenta de usuario.' }, { status: 500 })
  }

  const { error: assignmentError } = await admin
    .from('user_roles')
    .insert({
      user_id: createdUser.user.id,
      role,
      company_id: null,
      assigned_by: user.id,
    })

  if (assignmentError) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(createdUser.user.id)
    if (deleteError) {
      console.error('No se pudo revertir la cuenta creada tras fallar la asignación de rol.', {
        assignmentError,
        deleteError,
      })
    } else {
      console.error('No se pudo asignar el rol al usuario recién creado.', assignmentError)
    }

    return NextResponse.json(
      { error: 'No se pudo asignar el rol. No se completó la creación del usuario.' },
      { status: 500 },
    )
  }

  const { error: profileError } = await admin
    .from('user_profiles')
    .insert({ user_id: createdUser.user.id, branch })

  if (profileError) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(createdUser.user.id)
    if (deleteError) {
      console.error('No se pudo revertir la cuenta tras fallar la creación del perfil.', {
        profileError,
        deleteError,
      })
    } else {
      console.error('No se pudo crear el perfil inicial del usuario.', profileError)
    }

    return NextResponse.json(
      { error: 'No se pudo guardar la sede del usuario. No se completó su creación.' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    user: {
      id: createdUser.user.id,
      email,
      fullName,
      role,
      branch,
      mustChangePassword: true,
      isActive: true,
    },
    temporaryPassword,
  }, { status: 201 })
}
