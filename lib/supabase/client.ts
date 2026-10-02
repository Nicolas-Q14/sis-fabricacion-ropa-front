import { createBrowserClient } from '@supabase/ssr'

export function createClient(rememberMe = true) {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        maxAge: rememberMe ? 60 * 60 * 24 * 365 : undefined,
      },
    }
  )
}