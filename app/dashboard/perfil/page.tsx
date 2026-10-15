import { redirect } from 'next/navigation'

import { ProfileEditor } from '@/components/profile-editor'
import { createClient } from '@/lib/supabase/server'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  if (user.app_metadata?.is_active === false) {
    redirect('/account-disabled')
  }

  const fullName = typeof user.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name
    : typeof user.user_metadata?.name === 'string'
      ? user.user_metadata.name
      : ''

  return (
    <ProfileEditor
      avatarUrl={typeof user.user_metadata?.avatar_url === 'string'
        ? user.user_metadata.avatar_url
        : null}
      email={user.email ?? ''}
      fullName={fullName}
      userId={user.id}
    />
  )
}
