import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-guard'
import { createAdminClient, usernameToEmail, isValidUsername } from '@/lib/supabase/admin'

// last_sign_in_at lives on auth.users, not profiles — only readable via the service-role
// Admin API, so it's merged in here rather than being a normal RLS-visible column.
export async function GET() {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error
  const { ctx } = guard
  const { data, error } = await ctx.supabase.from('profiles').select('*').order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const admin = createAdminClient()
  const { data: authList } = await admin.auth.admin.listUsers({ perPage: 200 })
  const lastSignInById = new Map((authList?.users || []).map(u => [u.id, u.last_sign_in_at]))

  const users = (data || []).map(u => ({ ...u, last_sign_in_at: lastSignInById.get(u.id) || null }))
  return NextResponse.json({ users })
}

export async function POST(req: Request) {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error

  const body = await req.json().catch(() => ({}))
  const { username, password, full_name, role, notification_email } = body || {}

  if (!isValidUsername(username || '')) {
    return NextResponse.json({ error: 'שם משתמש לא תקין — אותיות/ספרות אנגליות, נקודה, מקף וקו תחתון, 3–32 תווים' }, { status: 400 })
  }
  if (!password || String(password).length < 8) {
    return NextResponse.json({ error: 'סיסמה חייבת להכיל לפחות 8 תווים' }, { status: 400 })
  }
  if (!full_name) return NextResponse.json({ error: 'חסר שם מלא' }, { status: 400 })
  if (role !== 'admin' && role !== 'bookkeeper') return NextResponse.json({ error: 'תפקיד לא תקין' }, { status: 400 })

  const admin = createAdminClient()
  const email = usernameToEmail(username)

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // synthetic address can never receive a real confirmation email
    app_metadata: { role },
  })
  if (createErr || !created?.user) {
    return NextResponse.json({ error: createErr?.message || 'יצירת המשתמש נכשלה' }, { status: 400 })
  }

  const { error: profileErr } = await admin.from('profiles').insert({
    id: created.user.id,
    username: username.trim().toLowerCase(),
    full_name,
    role,
    notification_email: notification_email || null,
  })
  if (profileErr) {
    // Roll back the orphaned auth user so a failed provisioning attempt doesn't leave a
    // login-capable account with no profile row (which would fail every role check).
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {})
    return NextResponse.json({ error: profileErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: created.user.id })
}
