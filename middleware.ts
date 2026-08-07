import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api/auth', '/api/cron']

export async function middleware(request: NextRequest) {
  // Headers we're about to trust downstream — always strip any client-supplied values first
  // so nothing can spoof them.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete('x-user-id')
  requestHeaders.delete('x-user-role')
  requestHeaders.delete('x-user-email')

  const cookiesToForward: { name: string; value: string; options: Record<string, unknown> }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToForward.push(...cookiesToSet)
        },
      },
    }
  )

  // Always getUser() (revalidates against the auth server), never getSession() —
  // getSession() trusts the local cookie without checking it's still valid, which is
  // not safe to base an authorization decision on. This is the ONE place per request that
  // pays that network round trip — see lib/supabase/server.ts for why it's only once.
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isPublic = PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/')) || path.startsWith('/_next') || path === '/favicon.ico'

  function withCookies(res: NextResponse) {
    cookiesToForward.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
    return res
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return withCookies(NextResponse.redirect(url))
  }

  if (user) {
    const role = (user.app_metadata?.role as string) || 'bookkeeper'
    if (path.startsWith('/admin') && role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return withCookies(NextResponse.redirect(url))
    }
    // Already validated here — downstream Server Components/Route Handlers trust these
    // instead of calling getUser() again, which was silently doubling every single request's
    // auth-server round trip and was the actual cause of "everything feels slow".
    requestHeaders.set('x-user-id', user.id)
    requestHeaders.set('x-user-role', role)
    if (user.email) requestHeaders.set('x-user-email', user.email)
  }

  return withCookies(NextResponse.next({ request: { headers: requestHeaders } }))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
