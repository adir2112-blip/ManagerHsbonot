import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Service-role client — full DB + Auth-admin bypass access. SERVER-ONLY.
// Reserved for: admin/users provisioning (auth.admin.createUser/updateUserById/deleteUser)
// and the reminders cron endpoint. Never import this from a client component or from any
// route that handles ordinary client/checklist data — those must go through
// lib/supabase/server.ts so RLS actually applies.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export { usernameToEmail, isValidUsername } from '@/lib/username'
