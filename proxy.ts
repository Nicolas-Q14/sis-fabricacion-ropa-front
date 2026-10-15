import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  let isValidSupabaseUrl = false

  try {
    const url = new URL(supabaseUrl ?? '')
    isValidSupabaseUrl = url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    isValidSupabaseUrl = false
  }

  if (!isValidSupabaseUrl || !supabaseUrl || !supabaseKey) {
    if (request.nextUrl.pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    return NextResponse.next()
  }

  let response = NextResponse.next({ request })
  function redirectWithCookies(path: string) {
    const redirectResponse = NextResponse.redirect(new URL(path, request.url))
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
    return redirectResponse
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard')
  const isLogin = request.nextUrl.pathname === '/login'
  const isAccountDisabled = request.nextUrl.pathname === '/account-disabled'
  const isApi = request.nextUrl.pathname.startsWith('/api/')
  const isPasswordChange = request.nextUrl.pathname === '/dashboard/change-password'

  if (isDashboard && !user) {
    return redirectWithCookies('/login')
  }

  if (!user && isAccountDisabled) {
    return redirectWithCookies('/login')
  }

  if (user?.app_metadata?.is_active === false) {
    if (isApi) {
      const blockedResponse = NextResponse.json(
        { error: 'Tu cuenta está desactivada. Contacta al superadmin.' },
        { status: 403 },
      )
      response.cookies.getAll().forEach((cookie) => blockedResponse.cookies.set(cookie))
      return blockedResponse
    }

    if (!isAccountDisabled) {
      return redirectWithCookies('/account-disabled')
    }
  }

  if (isAccountDisabled && user) {
    return redirectWithCookies('/dashboard')
  }

  if (
    isDashboard
    && user?.app_metadata?.must_change_password === true
    && !isPasswordChange
  ) {
    return redirectWithCookies('/dashboard/change-password')
  }

  if (isPasswordChange && user?.app_metadata?.must_change_password !== true) {
    return redirectWithCookies('/dashboard')
  }

  if (isLogin && user) {
    return redirectWithCookies(
      user.app_metadata?.must_change_password === true
        ? '/dashboard/change-password'
        : '/dashboard',
    )
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*', '/account-disabled', '/login'],
}