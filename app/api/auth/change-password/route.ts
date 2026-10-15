import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const passwordSchema = z.object({
  password: z.string().min(12).max(128),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Tu sesión expiró. Inicia sesión de nuevo.' }, { status: 401 })
  }

  if (user.app_metadata?.is_active === false) {
    return NextResponse.json(
      { error: 'Tu cuenta está desactivada. Contacta al superadmin.' },
      { status: 403 },
    )
  }

  if (user.app_metadata?.must_change_password !== true) {
    return NextResponse.json({ error: 'No tienes un cambio de contraseña pendiente.' }, { status: 403 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'La solicitud no contiene JSON válido.' }, { status: 400 })
  }

  const parsed = passwordSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'La contraseña debe tener entre 12 y 128 caracteres.' },
      { status: 400 },
    )
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password: parsed.data.password,
    app_metadata: {
      ...user.app_metadata,
      must_change_password: false,
    },
  })

  if (error) {
    console.error('No fue posible cambiar la contraseña inicial.', error)
    return NextResponse.json({ error: 'No se pudo actualizar la contraseña.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
