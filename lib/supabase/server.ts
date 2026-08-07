import { cookies, headers } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

// Session-scoped server client for Server Components / Route Handlers — reads the caller's
// own auth cookie, so auth.uid() is real and RLS is the actual enforcement layer.
// Never use this for /admin/* provisioning or the cron endpoint — those need
// lib/supabase/admin.ts (service-role, bypasses RLS) instead.
export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // called from a Server Component that can't set cookies — middleware refreshes
            // the session on the next request, so this is safe to ignore.
          }
        },
      },
    }
  )
}

// Returns { user, role } for the current request, or null if not authenticated.
// role comes from the JWT app_metadata (see lib/supabase/admin.ts) — no extra DB query,
// and no recursive RLS lookup against profiles.
//
// Trusts x-user-id/x-user-role/x-user-email set by middleware.ts, which already called
// supabase.auth.getUser() (a real network round trip to the Auth server) for this exact
// request. Calling getUser() again here doubled that round trip on literally every page and
// API route — that redundant second call was the actual cause of the app feeling sluggish,
// not slow database queries. The matcher in middleware.ts covers every route this app serves,
// so the headers are always present in practice; the fallback below only matters if that ever
// changes.
export async function getCurrentUser() {
  const supabase = await createClient()
  const headersList = await headers()
  const userId = headersList.get('x-user-id')

  if (userId) {
    const role = headersList.get('x-user-role') || 'bookkeeper'
    const email = headersList.get('x-user-email') || undefined
    return { user: { id: userId, email } as { id: string; email?: string }, role, supabase }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const role = (user.app_metadata?.role as string) || 'bookkeeper'
  return { user, role, supabase }
}
