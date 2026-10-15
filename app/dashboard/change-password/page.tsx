import { redirect } from 'next/navigation'

import { ChangePasswordForm } from '@/components/change-password-form'
import { createClient } from '@/lib/supabase/server'

export default async function ChangePasswordPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  if (user.app_metadata?.is_active === false) {
    redirect('/account-disabled')
  }

  if (user.app_metadata?.must_change_password !== true) {
    redirect('/dashboard')
  }

  return <ChangePasswordForm />
}
